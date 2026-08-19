//
//  AppState.swift
//  Porchivo
//
//  Single source of truth for app data — mirrors the Expo context providers
//  and android AppRepository. @Observable so SwiftUI views update reactively.
//

import Foundation
import SwiftUI

enum AuthState: Equatable {
    case loading
    case unauthenticated
    case authenticated(String) // userId
    case locked(String) // userId — session restored, awaiting biometric unlock
    case error(String)
}

enum LoadState<T: Equatable>: Equatable {
    case idle
    case loading
    case success(T)
    case error(String)
}

@Observable
final class AppState {
    // Auth
    var authState: AuthState = .loading
    var authError: String?

    // User & tier
    var user: User?
    var tier: SubscriptionTier = .free

    // Server data
    var shipments: [Shipment] = []
    var shipmentsLoadState: LoadState<Unit> = .idle
    var notifications: [DeliveryNotification] = []
    var notificationsLoadState: LoadState<Unit> = .idle
    var directory: [DirectoryEntry] = []

    // Org membership — determines Free vs Community tier
    var orgMembership: OrgMembership? = nil
    var orgLoadState: LoadState<Unit> = .idle

    var isOrgMember: Bool { orgMembership?.isActive == true }
    var isOrgPending: Bool { orgMembership?.isPending == true }
    var isOrgAdmin: Bool { orgMembership?.isAdmin == true }

    // Announcements (loaded when org member)
    var announcements: [Announcement] = []
    var announcementsLoadState: LoadState<Unit> = .idle

    // Maintenance requests (loaded when org member)
    var maintenanceRequests: [MaintenanceRequest] = []
    var maintenanceLoadState: LoadState<Unit> = .idle

    // Local data (UserDefaults — mirrors AsyncStorage/SharedPreferences)
    var packages: [TrackedPackage] = []

    // Theme
    var darkThemeOverride: Bool? = nil

    // Language — auto-detects system language on first launch, restores saved pref on subsequent launches.
    var languageManager: LanguageManager = LanguageManager.shared

    // Backend readiness
    var isSupabaseConfigured: Bool = false

    // Biometrics — when true and a session is restorable, app cold-starts into
    // `.locked` and requires a Face ID / Touch ID prompt before loading data.
    var biometricUnlockEnabled: Bool = false
    var availableBiometry: BiometryType = .none

    // Biometric enrollment — set to true after a fresh magic-link login so
    // RootView can present the enrollment prompt before the dashboard.
    // Cleared once the user enrolls or explicitly skips.
    var needsBiometricEnrollment: Bool = false
    var biometricEnrollmentDeclined: Bool = false

    // Push notifications — deep-link shipment id set when the user taps a push.
    var pendingDeepLinkShipmentId: String? = nil

    // Foreground re-lock — when biometric unlock is enabled, the app re-locks
    // after being backgrounded for longer than `relockInterval`. This prevents
    // someone from picking up a device that was briefly set down and seeing
    // package data without re-authenticating.
    var isForegroundLocked: Bool = false
    private var backgroundedAt: Date? = nil
    private let relockInterval: TimeInterval = 30  // 30 seconds in background → re-lock

    // Per-screen biometric guard — sensitive screens (package detail, shipment
    // detail) require re-auth if the user hasn't authenticated within this
    // window. Reset on each successful unlock.
    private var lastBiometricSuccessAt: Date? = nil
    let biometricReauthInterval: TimeInterval = 300  // 5 minutes

    private let supabase = SupabaseService.shared
    private let packagesKey = "porchivo_tracked_packages"
    private let orgCacheKeyPrefix = "porchivo_org_cache_"
    private let biometricPrefKey = "porchivo_biometric_unlock_enabled"
    private let biometricDeclinedKey = "porchivo_biometric_enrollment_declined"
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    // Offline action queue
    var isOnline = true
    var pendingActions: [PendingAction] = []
    private let pendingActionStore = PendingActionStore()
    private let networkMonitor = NetworkMonitor()

    init() {
        isSupabaseConfigured = supabase.isConfiguredSync
        encoder.dateEncodingStrategy = .iso8601
        decoder.dateDecodingStrategy = .iso8601
        availableBiometry = BiometricAuthService.availableType()
        biometricUnlockEnabled = UserDefaults.standard.bool(forKey: biometricPrefKey)
        biometricEnrollmentDeclined = UserDefaults.standard.bool(forKey: biometricDeclinedKey)
        _ = languageManager
        // Start network monitoring and load pending actions from disk.
        networkMonitor.onStatusChange = { [weak self] online in
            guard let self else { return }
            self.isOnline = online
            if online && !self.pendingActions.isEmpty {
                Task { await self.processPendingActions() }
            }
        }
        networkMonitor.start()
        pendingActions = pendingActionStore.loadActions()
    }

    // MARK: - Offline action queue

    private func enqueueAction(
        type: String,
        target: String,
        payload: [String: Any?],
        filter: [String: String]? = nil,
        refreshKey: String? = nil
    ) {
        let serializable: [String: Any] = payload.mapValues { $0 ?? NSNull() }
        let payloadData = try? JSONSerialization.data(withJSONObject: serializable)
        let action = PendingAction(
            id: "action_\(Int(Date().timeIntervalSince1970))_\(UUID().uuidString)",
            type: type,
            target: target,
            payload: payloadData ?? Data(),
            filter: filter,
            refreshKey: refreshKey,
            timestamp: Date()
        )
        pendingActions.append(action)
        pendingActionStore.saveActions(pendingActions)
    }

    func processPendingActions() async {
        guard isSupabaseConfigured, !pendingActions.isEmpty else { return }
        var remaining: [PendingAction] = []
        for action in pendingActions {
            let ok = await supabase.replayQueuedAction(
                type: action.type,
                target: action.target,
                payload: action.payload,
                filter: action.filter
            )
            if ok {
                if let key = action.refreshKey {
                    await refreshData(key)
                }
            } else {
                var updated = action
                updated.retryCount += 1
                if updated.retryCount < updated.maxRetries {
                    remaining.append(updated)
                }
            }
        }
        pendingActions = remaining
        pendingActionStore.saveActions(remaining)
    }

    private func clearPendingActions() {
        pendingActions = []
        pendingActionStore.clear()
    }

    private func refreshData(_ key: String) async {
        let userId: String
        if case .authenticated(let id) = authState {
            userId = id
        } else {
            return
        }
        switch key {
        case "shipments": await loadShipments(userId: userId)
        case "notifications": await loadNotifications(userId: userId)
        case "announcements":
            if let orgId = orgMembership?.orgId {
                await loadAnnouncements(orgId: orgId)
            }
        case "maintenance":
            if let orgId = orgMembership?.orgId {
                await loadMaintenanceRequests(orgId: orgId)
            }
        case "profile": await loadProfile(userId: userId)
        default: break
        }
    }

    // MARK: - Session restore

    @MainActor
    func restoreSession() async {
        authState = .loading
        if !isSupabaseConfigured {
            // Demo mode — no backend. Drop straight into login; on auth we seed mock.
            authState = .unauthenticated
            return
        }
        // Race the session restore against a timeout so users on poor connectivity
        // don't see a frozen splash indefinitely.
        let restoreTask = Task { await supabase.restoreSession() }
        let timeoutTask = Task {
            try? await Task.sleep(for: .seconds(8))
            restoreTask.cancel()
        }
        let session = await restoreTask.value
        timeoutTask.cancel()
        guard let session else {
            authState = .unauthenticated
            return
        }
        let userId = session.user?.id ?? ""
        // Re-evaluate biometric availability in case the user changed Face ID
        // settings since the last cold start.
        availableBiometry = BiometricAuthService.availableType()
        if biometricUnlockEnabled && availableBiometry != .none {
            // Gate the restored session behind biometrics. Data loads only after unlock.
            authState = .locked(userId)
        } else {
            // Biometrics disabled or no longer enrolled — skip the gate rather
            // than locking the user out. Biometrics is a convenience, not a hard wall.
            authState = .authenticated(userId)
            await loadInitialData(userId: userId)
        }
    }

    /// Called by the unlock screen after a successful biometric prompt (or a
    /// user-chosen "use password" fallback). Promotes `.locked` → `.authenticated`
    /// and loads the user's data.
    @MainActor
    func unlockSession() async {
        guard case .locked(let userId) = authState else { return }
        authState = .authenticated(userId)
        await loadInitialData(userId: userId)
    }

    /// Prompts Face ID / Touch ID and unlocks on success.
    @MainActor
    func performBiometricUnlock() async -> Bool {
        guard availableBiometry != .none else { return false }
        let ok = await BiometricAuthService.authenticate(
            reason: "Unlock Porchivo to continue to your porch."
        )
        if ok {
            Haptics.success()
            lastBiometricSuccessAt = Date()
            await unlockSession()
        } else {
            Haptics.error()
        }
        return ok
    }

    /// Toggles the biometric-unlock preference. When enabling, runs an immediate
    /// biometric prompt so the user authorizes the change; on success the
    /// preference is persisted. Returns the final (possibly unchanged) value.
    @MainActor
    func setBiometricUnlockEnabled(_ enabled: Bool) async -> Bool {
        if enabled {
            guard availableBiometry != .none else { return false }
            let ok = await BiometricAuthService.authenticate(
                reason: "Allow Porchivo to unlock with \(availableBiometry.label)."
            )
            guard ok else { return biometricUnlockEnabled }
            biometricUnlockEnabled = true
            lastBiometricSuccessAt = Date()
            UserDefaults.standard.set(true, forKey: biometricPrefKey)
            Haptics.success()
        } else {
            biometricUnlockEnabled = false
            UserDefaults.standard.set(false, forKey: biometricPrefKey)
            Haptics.selection()
        }
        return biometricUnlockEnabled
    }

    // MARK: - Magic link auth

    /// Sends a magic link email with a 6-digit OTP code. Returns `true` if
    /// Supabase accepted the request — the user then enters the code in-app.
    /// On failure, sets `authError` with the real Supabase error message.
    @MainActor
    func sendMagicLink(email: String) async -> Bool {
        authError = nil
        if !isSupabaseConfigured {
            // Demo mode — pretend the link was sent.
            return true
        }
        let result = await supabase.sendMagicLink(email.trimmingCharacters(in: .whitespaces))
        switch result {
        case .success:
            return true
        case .failure(let err):
            authError = err.localizedDescription
            return false
        }
    }

    /// Developer sign-in via the dev-confirm-user edge function + single
    /// signInWithPassword. Avoids Supabase Auth rate limits by doing all
    /// account setup (create / confirm / set password) server-side via the
    /// Admin API, then making exactly one auth call from the client.
    /// Falls back to local demo mode if Supabase isn't configured.
    @MainActor
    func developerLogin() async {
        authError = nil

        guard isSupabaseConfigured else {
            seedDemoUser()
            flagBiometricEnrollment()
            return
        }

        let qaEmail = "qa@porchivo.dev"
        let qaPassword = "PorchivoQA2025!"

        // ── Step 1: Ensure QA account exists + confirmed + password set ─────
        // Uses the Admin API server-side, not subject to Auth rate limits.
        let ensureResult = await supabase.invokeEdgeFunction(
            "dev-confirm-user",
            body: ["email": qaEmail, "password": qaPassword]
        )
        if case .failure(let err) = ensureResult {
            authError = "Dev setup failed: \(err.localizedDescription). Make sure dev-confirm-user is deployed."
            Haptics.error()
            return
        }

        // ── Step 2: Single signInWithPassword with retry on rate limit ────
        let backoffSeconds: [Double] = [0, 2, 5, 10]
        for attempt in 0..<4 {
            if attempt > 0 {
                try? await Task.sleep(for: .seconds(backoffSeconds[attempt]))
            }
            let result = await supabase.signInWithEmail(qaEmail, qaPassword)
            switch result {
            case .success(let session):
                authState = .authenticated(session.user?.id ?? "")
                await loadInitialData(userId: session.user?.id ?? "")
                flagBiometricEnrollment()
                return
            case .failure(let err):
                let msg = err.localizedDescription.lowercased()
                let isRateLimit = msg.contains("rate limit") || msg.contains("too many") || msg.contains("over_request")
                if !isRateLimit || attempt == 3 {
                    authError = err.localizedDescription
                    Haptics.error()
                    return
                }
                // Rate-limited — retry with backoff on next iteration
            }
        }
    }

    /// Verifies the 6-digit OTP code from the magic link email. On success,
    /// establishes a session and flags for biometric enrollment.
    @MainActor
    func verifyOtp(email: String, token: String) async -> Bool {
        authError = nil
        if !isSupabaseConfigured {
            // Demo mode — any 6-digit code signs in.
            seedDemoUser()
            flagBiometricEnrollment()
            return true
        }
        let result = await supabase.verifyOtp(
            email: email.trimmingCharacters(in: .whitespaces),
            token: token.trimmingCharacters(in: .whitespaces)
        )
        switch result {
        case .success(let session):
            authState = .authenticated(session.user?.id ?? "")
            await loadInitialData(userId: session.user?.id ?? "")
            flagBiometricEnrollment()
            return true
        case .failure(let err):
            authError = err.localizedDescription
            Haptics.error()
            return false
        }
    }

    /// After a fresh login, prompt for biometric enrollment if the device
    /// supports it and the user hasn't already enabled or declined it.
    private func flagBiometricEnrollment() {
        let shouldEnroll = availableBiometry != .none
            && !biometricUnlockEnabled
            && !biometricEnrollmentDeclined
        needsBiometricEnrollment = shouldEnroll
    }

    /// Called by the enrollment screen when the user successfully enrolls.
    @MainActor
    func completeBiometricEnrollment() async {
        needsBiometricEnrollment = false
        Haptics.success()
    }

    /// Called by the enrollment screen when the user taps "Skip".
    @MainActor
    func skipBiometricEnrollment() {
        needsBiometricEnrollment = false
        biometricEnrollmentDeclined = true
        UserDefaults.standard.set(true, forKey: biometricDeclinedKey)
        Haptics.selection()
    }

    // MARK: - Auth (legacy email/password — kept for fallback)

    @MainActor
    func signIn(email: String, password: String) async -> Bool {
        authError = nil
        if !isSupabaseConfigured {
            // Demo mode
            seedDemoUser()
            return true
        }
        let result = await supabase.signInWithEmail(email.trimmingCharacters(in: .whitespaces), password)
        switch result {
        case .success(let session):
            authState = .authenticated(session.user?.id ?? "")
            await loadInitialData(userId: session.user?.id ?? "")
            return true
        case .failure(let err):
            authError = err.localizedDescription
            return false
        }
    }

    @MainActor
    func signUp(email: String, password: String) async -> Bool {
        authError = nil
        if !isSupabaseConfigured {
            seedDemoUser()
            return true
        }
        let result = await supabase.signUpWithEmail(email.trimmingCharacters(in: .whitespaces), password)
        switch result {
        case .success(let session):
            if session.user != nil {
                authState = .authenticated(session.user?.id ?? "")
                await loadInitialData(userId: session.user?.id ?? "")
            } else {
                authError = "Check your email to confirm your account, then sign in."
            }
            return true
        case .failure(let err):
            authError = err.localizedDescription
            return false
        }
    }

    @MainActor
    func signOut() async {
        let userId = currentUserId
        await supabase.signOut()
        clearPendingActions()
        if let userId {
            UserDefaults.standard.removeObject(forKey: orgCacheKeyPrefix + userId)
        }
        biometricUnlockEnabled = false
        UserDefaults.standard.set(false, forKey: biometricPrefKey)
        biometricEnrollmentDeclined = false
        UserDefaults.standard.set(false, forKey: biometricDeclinedKey)
        needsBiometricEnrollment = false
        authState = .unauthenticated
        user = nil
        tier = .free
        shipments = []
        notifications = []
        directory = []
        orgMembership = nil
        orgLoadState = .idle
        announcements = []
        announcementsLoadState = .idle
        maintenanceRequests = []
        maintenanceLoadState = .idle
        shipmentsLoadState = .idle
        notificationsLoadState = .idle
    }

    private func seedDemoUser() {
        user = MockData.user
        tier = .free
        shipments = MockData.shipments
        notifications = MockData.notifications
        packages = MockData.trackedPackages
        saveLocalPackages()
        authState = .authenticated(MockData.currentUserID)
    }

    /// Loads cached org membership from UserDefaults so the correct tier
    /// (Free vs Community) renders instantly on launch without waiting for
    /// the network fetch. The RPC fetch still runs and updates if the data
    /// has changed.
    func loadCachedOrgContext(userId: String) {
        let key = orgCacheKeyPrefix + userId
        guard let data = UserDefaults.standard.data(forKey: key),
              let cached = try? decoder.decode(OrgMembership.self, from: data) else { return }
        orgMembership = cached
        orgLoadState = .success(Unit())
    }

    @MainActor
    private func loadInitialData(userId: String) async {
        loadCachedOrgContext(userId: userId)
        await loadProfile(userId: userId)
        await loadShipments(userId: userId)
        await loadNotifications(userId: userId)
        await loadOrgContext(userId: userId)
        if isOrgMember, let orgId = orgMembership?.orgId {
            await loadAnnouncements(orgId: orgId)
            await loadMaintenanceRequests(orgId: orgId)
        }
        loadLocalPackages()
    }

    // MARK: - Profile

    @MainActor
    func loadProfile(userId: String) async {
        guard isSupabaseConfigured else { return }
        let result = await supabase.fetchProfile(userId: userId)
        if case .success(let db?) = result {
            user = Mappers.toUser(db)
            tier = Mappers.parseTier(db.subscriptionTier, db.isPremium ?? false)
        }
    }

    @MainActor
    func updateRole(_ role: UserRole) async {
        guard isSupabaseConfigured, var u = user else { return }
        let result = await supabase.updateProfile(userId: u.id, ["role": role.rawValue])
        if case .success(let db) = result {
            u.role = Mappers.parseUserRole(db.role)
            user = u
        }
    }

    @MainActor
    func setLocationConsent(_ granted: Bool) async {
        guard isSupabaseConfigured, var u = user else { return }
        let result = await supabase.updateProfile(userId: u.id, ["has_location_consent": granted])
        if case .success(let db) = result {
            u.hasLocationConsent = db.hasLocationConsent ?? granted
            user = u
        }
    }

    @MainActor
    func setPreciseLocationConsent(_ granted: Bool) async {
        guard isSupabaseConfigured, var u = user else { return }
        let result = await supabase.updateProfile(userId: u.id, ["has_precise_location_consent": granted])
        if case .success(let db) = result {
            u.hasPreciseLocationConsent = db.hasPreciseLocationConsent ?? granted
            user = u
        }
    }

    /// Updates profile fields during onboarding without marking the user fully
    /// onboarded. Used by the setup screen so the rest of the onboarding flow
    /// can still run before `completeOnboarding` flips `is_onboarded`.
    @MainActor
    func updateProfileInfo(name: String, phone: String, address: String,
                           role: UserRole, hasLocationConsent: Bool) async {
        guard isSupabaseConfigured else {
            if user == nil { user = MockData.user }
            user?.name = name
            user?.phone = phone
            user?.address = address
            user?.role = role
            user?.hasLocationConsent = hasLocationConsent
            return
        }
        guard let userId = currentUserId else { return }
        let updates: [String: Any?] = [
            "name": name,
            "phone": phone,
            "address": address,
            "role": role.rawValue,
            "has_location_consent": hasLocationConsent,
        ]
        let result = await supabase.updateProfile(userId: userId, updates)
        if case .success(let db) = result {
            user = Mappers.toUser(db)
        }
    }

    @MainActor
    func completeOnboarding(name: String, phone: String, address: String,
                            role: UserRole, hasLocationConsent: Bool) async {
        guard isSupabaseConfigured else {
            // Demo mode — just set local user
            if user == nil { user = MockData.user }
            user?.name = name
            user?.phone = phone
            user?.address = address
            user?.role = role
            user?.hasLocationConsent = hasLocationConsent
            user?.isOnboarded = true
            return
        }
        guard let userId = currentUserId else { return }
        let updates: [String: Any?] = [
            "name": name,
            "phone": phone,
            "address": address,
            "role": role.rawValue,
            "has_location_consent": hasLocationConsent,
            "is_onboarded": true,
        ]
        if !isOnline {
            enqueueAction(
                type: "update", target: "profiles",
                payload: updates, filter: ["id": userId], refreshKey: "profile"
            )
            user?.name = name
            user?.phone = phone
            user?.address = address
            user?.role = role
            user?.hasLocationConsent = hasLocationConsent
            user?.isOnboarded = true
            return
        }
        let result = await supabase.updateProfile(userId: userId, updates)
        if case .success(let db) = result {
            user = Mappers.toUser(db)
        }
    }

    /// Updates avatar_url on the profile; also deletes the previous object.
    @MainActor
    func updateAvatarUrl(_ url: String?, removeOld: Bool = false) async {
        guard let u = user else { return }
        if removeOld, let old = u.avatarUrl {
            await supabase.deleteAvatar(publicURL: old)
        }
        if isSupabaseConfigured {
            _ = await supabase.updateProfile(userId: u.id, ["avatar_url": url])
        }
        user?.avatarUrl = url
    }

    /// Uploads avatar data and persists the new public URL.
    @MainActor
    func uploadAvatar(data: Data, ext: String) async -> Bool {
        guard let u = user, isSupabaseConfigured else { return false }
        let result = await supabase.uploadAvatar(userId: u.id, data: data, ext: ext)
        switch result {
        case .success(let url):
            await updateAvatarUrl(url, removeOld: true)
            return true
        case .failure:
            return false
        }
    }

    var currentUserId: String? {
        if case .authenticated(let id) = authState { return id }
        return user?.id
    }

    var isAuthenticated: Bool {
        if case .authenticated = authState { return true }
        return false
    }

    var isOnboarded: Bool { user?.isOnboarded == true }

    // MARK: - Push notifications

    /// Persist an Apple Push Notification service (APNS) device token to the
    /// user's profile. Supabase can use this token to send native iOS pushes.
    @MainActor
    func registerAPNSToken(_ token: String) async {
        guard isSupabaseConfigured, let userId = currentUserId else { return }
        await supabase.saveAPNSToken(userId: userId, token: token)
    }

    // MARK: - Shipments

    @MainActor
    func loadShipments(userId: String) async {
        guard isSupabaseConfigured else { return }
        shipmentsLoadState = .loading
        let result = await supabase.fetchShipments(userId: userId)
        switch result {
        case .success(let rows):
            shipments = rows.map { Mappers.toShipment($0) }
            shipmentsLoadState = .success(Unit())
        case .failure(let err):
            shipmentsLoadState = .error(err.localizedDescription)
        }
    }

    @MainActor
    func addShipment(carrier: Carrier, packagesExpected: String, trackingNumber: String?,
                     notes: String, preferredReturnTime: String,
                     homeLocationVisibleToPartner: Bool) async -> Bool {
        guard isSupabaseConfigured, let u = user else { return false }
        let now = Date()
        let body: [String: Any?] = [
            "homeowner_id": u.id,
            "homeowner_name": u.name,
            "status": "open",
            "carrier": carrier.label,
            "packages_expected": packagesExpected,
            "delivery_window_start": Mappers.toISO(now.addingTimeInterval(2 * 3600)),
            "delivery_window_end": Mappers.toISO(now.addingTimeInterval(6 * 3600)),
            "address_text": u.address,
            "home_location_visible_to_partner": homeLocationVisibleToPartner,
            "notes": notes,
            "preferred_return_time": preferredReturnTime.isEmpty ? "Anytime" : preferredReturnTime,
            "tracking_number": trackingNumber?.takeIf { !$0.isEmpty },
            "delivery_status": "pending",
        ]
        if !isOnline {
            enqueueAction(
                type: "insert", target: "shipments",
                payload: body, refreshKey: "shipments"
            )
            return true
        }
        let result = await supabase.insertShipment(body)
        if case .success(let row) = result {
            shipments.insert(Mappers.toShipment(row), at: 0)
            return true
        }
        return false
    }

    @MainActor
    func completeShipment(id: String) async -> Bool {
        guard isSupabaseConfigured else {
            shipments = shipments.map { $0.id == id ? $0 : $0 } // noop demo
            return false
        }
        if !isOnline {
            enqueueAction(
                type: "update", target: "shipments",
                payload: ["status": "completed", "delivery_status": "delivered_to_homeowner"],
                filter: ["id": id], refreshKey: "shipments"
            )
            return true
        }
        let result = await supabase.updateShipment(id: id, ["status": "completed", "delivery_status": "delivered_to_homeowner"])
        if case .success(let row) = result {
            shipments = shipments.map { $0.id == id ? Mappers.toShipment(row) : $0 }
            return true
        }
        return false
    }

    @MainActor
    func acceptShipment(id: String) async -> Bool {
        guard isSupabaseConfigured else { return false }
        if !isOnline {
            enqueueAction(
                type: "rpc", target: "accept_shipment",
                payload: ["p_shipment_id": id], refreshKey: "shipments"
            )
            return true
        }
        let result = await supabase.acceptShipment(id: id)
        if case .success = result {
            if let u = user {
                shipments = shipments.map {
                    if $0.id == id {
                        var c = $0
                        c.status = .accepted
                        c.partnerId = u.id
                        c.partnerName = u.name
                        return c
                    }
                    return $0
                }
            }
            return true
        }
        return false
    }

    // MARK: - Tracked packages (local)

    func loadLocalPackages() {
        guard let data = UserDefaults.standard.data(forKey: packagesKey),
              let list = try? decoder.decode([TrackedPackage].self, from: data) else { return }
        packages = list
    }

    func saveLocalPackages() {
        if let data = try? encoder.encode(packages) {
            UserDefaults.standard.set(data, forKey: packagesKey)
        }
    }

    func canAddPackage() -> Bool {
        if tier != .free { return true }
        return packages.count < AppConfig.FreeLimits.maxPackages
    }

    func addPackage(_ pkg: TrackedPackage) {
        packages.insert(pkg, at: 0)
        saveLocalPackages()
    }

    func deletePackage(id: String) {
        packages.removeAll { $0.id == id }
        saveLocalPackages()
    }

    // MARK: - Notifications

    @MainActor
    func loadNotifications(userId: String) async {
        guard isSupabaseConfigured else { return }
        notificationsLoadState = .loading
        let result = await supabase.fetchNotifications(userId: userId)
        switch result {
        case .success(let rows):
            notifications = rows.map { Mappers.toNotification($0) }
            notificationsLoadState = .success(Unit())
        case .failure(let err):
            notificationsLoadState = .error(err.localizedDescription)
        }
    }

    @MainActor
    func markNotificationRead(id: String) async {
        guard isSupabaseConfigured else {
            notifications = notifications.map { $0.id == id ? DeliveryNotification(id: $0.id, shipmentId: $0.shipmentId, type: $0.type, title: $0.title, message: $0.message, read: true, createdAt: $0.createdAt) : $0 }
            return
        }
        if !isOnline {
            enqueueAction(
                type: "update", target: "notifications",
                payload: ["read": true], filter: ["id": id], refreshKey: "notifications"
            )
            notifications = notifications.map { $0.id == id ? DeliveryNotification(id: $0.id, shipmentId: $0.shipmentId, type: $0.type, title: $0.title, message: $0.message, read: true, createdAt: $0.createdAt) : $0 }
            return
        }
        let result = await supabase.markNotificationRead(id: id)
        if case .success = result {
            notifications = notifications.map { $0.id == id ? DeliveryNotification(id: $0.id, shipmentId: $0.shipmentId, type: $0.type, title: $0.title, message: $0.message, read: true, createdAt: $0.createdAt) : $0 }
        }
    }

    @MainActor
    func markAllNotificationsRead() async {
        guard let userId = currentUserId else { return }
        guard isSupabaseConfigured else {
            notifications = notifications.map { DeliveryNotification(id: $0.id, shipmentId: $0.shipmentId, type: $0.type, title: $0.title, message: $0.message, read: true, createdAt: $0.createdAt) }
            return
        }
        if !isOnline {
            enqueueAction(
                type: "update", target: "notifications",
                payload: ["read": true],
                filter: ["recipient_id": userId, "read": "false"], refreshKey: "notifications"
            )
            notifications = notifications.map { DeliveryNotification(id: $0.id, shipmentId: $0.shipmentId, type: $0.type, title: $0.title, message: $0.message, read: true, createdAt: $0.createdAt) }
            return
        }
        let result = await supabase.markAllNotificationsRead(userId: userId)
        if case .success = result {
            notifications = notifications.map { DeliveryNotification(id: $0.id, shipmentId: $0.shipmentId, type: $0.type, title: $0.title, message: $0.message, read: true, createdAt: $0.createdAt) }
        }
    }

    var unreadCount: Int { notifications.filter { !$0.read }.count }

    // MARK: - Directory + chat (loaded lazily by screens)

    @MainActor
    func loadDirectory() async {
        guard isSupabaseConfigured, let userId = currentUserId else { return }
        let result = await supabase.fetchDirectory(orgMemberId: userId)
        if case .success(let rows) = result {
            directory = rows.map { Mappers.toDirectoryEntry($0) }
        }
    }

    // MARK: - Org membership (Free vs Community tier)

    @MainActor
    func loadOrgContext(userId: String) async {
        guard isSupabaseConfigured else { return }
        // Skip the loading indicator when we have cached data — the network
        // fetch updates silently without a flash.
        if orgMembership == nil {
            orgLoadState = .loading
        }
        let result = await supabase.fetchOrgContext()
        switch result {
        case .success(let rows):
            let active = rows.first(where: { $0.status == "active" })
                ?? rows.first(where: { $0.status == "pending" })
            if let row = active {
                orgMembership = OrgMembership(
                    orgId: row.orgId,
                    orgName: row.orgName,
                    role: row.role,
                    status: row.status,
                    inviteCode: nil
                )
                // Persist to UserDefaults for instant tier resolution on next launch
                if let data = try? encoder.encode(orgMembership) {
                    UserDefaults.standard.set(data, forKey: orgCacheKeyPrefix + userId)
                }
            } else {
                orgMembership = nil
                // Clear stale cache so a removed member doesn't see Community tier
                UserDefaults.standard.removeObject(forKey: orgCacheKeyPrefix + userId)
            }
            orgLoadState = .success(Unit())
        case .failure:
            orgMembership = nil
            orgLoadState = .idle
        }
    }

    @MainActor
    func refreshOrgContext() async {
        guard let userId = currentUserId else { return }
        await loadOrgContext(userId: userId)
        if isOrgMember, let orgId = orgMembership?.orgId {
            await loadAnnouncements(orgId: orgId)
            await loadMaintenanceRequests(orgId: orgId)
        }
    }

    // MARK: - Announcements

    @MainActor
    func loadAnnouncements(orgId: String) async {
        guard isSupabaseConfigured else { return }
        announcementsLoadState = .loading
        let result = await supabase.fetchAnnouncements(orgId: orgId)
        switch result {
        case .success(let rows):
            announcements = rows.map { Mappers.toAnnouncement($0) }
            announcementsLoadState = .success(Unit())
        case .failure(let err):
            announcementsLoadState = .error(err.localizedDescription)
        }
    }

    @MainActor
    func postAnnouncement(title: String, body: String, priority: AnnouncementPriority) async -> Bool {
        guard isSupabaseConfigured, let orgId = orgMembership?.orgId, let userId = currentUserId else { return false }
        let payload: [String: Any?] = [
            "org_id": orgId,
            "author_id": userId,
            "title": title,
            "body": body,
            "priority": priority.rawValue,
            "category": "general",
            "is_pinned": false,
        ]
        if !isOnline {
            enqueueAction(
                type: "insert", target: "org_announcements",
                payload: payload, refreshKey: "announcements"
            )
            return true
        }
        let result = await supabase.insertAnnouncement(payload)
        if case .success(let row) = result {
            announcements.insert(Mappers.toAnnouncement(row), at: 0)
            return true
        }
        return false
    }

    // MARK: - Maintenance

    @MainActor
    func loadMaintenanceRequests(orgId: String) async {
        guard isSupabaseConfigured else { return }
        maintenanceLoadState = .loading
        let result = await supabase.fetchMyMaintenanceRequests(orgId: orgId)
        switch result {
        case .success(let rows):
            maintenanceRequests = rows.map { Mappers.toMaintenanceRequest($0) }
            maintenanceLoadState = .success(Unit())
        case .failure(let err):
            maintenanceLoadState = .error(err.localizedDescription)
        }
    }

    @MainActor
    func submitMaintenanceRequest(category: MaintenanceCategory, priority: MaintenancePriority,
                                   title: String, description: String?, location: String?) async -> Bool {
        guard isSupabaseConfigured, let orgId = orgMembership?.orgId else { return false }
        if !isOnline {
            enqueueAction(
                type: "rpc", target: "submit_maintenance_request",
                payload: [
                    "p_org_id": orgId,
                    "p_category": category.rawValue,
                    "p_priority": priority.rawValue,
                    "p_title": title,
                    "p_description": description,
                    "p_location": location,
                ],
                refreshKey: "maintenance"
            )
            return true
        }
        let result = await supabase.submitMaintenanceRequest(
            orgId: orgId, category: category.rawValue, priority: priority.rawValue,
            title: title, description: description, location: location
        )
        if case .success = result {
            await loadMaintenanceRequests(orgId: orgId)
            return true
        }
        return false
    }

    // MARK: - Org checkout (B2B Stripe Checkout)

    func createOrgCheckout(
        name: String, type: String, address: String, city: String, state: String,
        zip: String, totalUnits: Int?, planTier: String, billingCycle: String,
        returnUrl: String
    ) async -> Result<SupabaseService.OrgCheckoutResponse, Error> {
        await supabase.createOrgCheckout(
            name: name, type: type, address: address, city: city, state: state,
            zip: zip, totalUnits: totalUnits, planTier: planTier,
            billingCycle: billingCycle, returnUrl: returnUrl
        )
    }

    func confirmOrgSignup(sessionId: String, orgId: String) async -> Result<SupabaseService.OrgConfirmResponse, Error> {
        await supabase.confirmOrgSignup(sessionId: sessionId, orgId: orgId)
    }

    // MARK: - Theme

    func setDarkTheme(_ dark: Bool) { darkThemeOverride = dark }
    func upgradeTier(_ newTier: SubscriptionTier) { tier = newTier }

    // MARK: - Language

    func setLanguage(_ language: AppLanguage) {
        languageManager.setLanguage(language)
    }

    var currentLanguage: AppLanguage { languageManager.current }
    var isLanguageRTL: Bool { languageManager.isRTL }

    // MARK: - Foreground re-lock (scene phase)

    /// Called when the app enters the background. Records the timestamp so we
    /// can decide whether to re-lock on return.
    func handleEnterBackground() {
        backgroundedAt = Date()
    }

    /// Called when the app returns to the foreground. If biometric unlock is
    /// enabled and the app was backgrounded longer than `relockInterval`, the
    /// session is re-locked so the user must authenticate again.
    @MainActor
    func handleEnterForeground() {
        // Re-evaluate biometric availability — the user may have enrolled or
        // unenrolled Face ID while the app was backgrounded.
        availableBiometry = BiometricAuthService.availableType()
        guard biometricUnlockEnabled,
              case .authenticated(let userId) = authState,
              availableBiometry != .none else { return }
        if let bgAt = backgroundedAt {
            let elapsed = Date().timeIntervalSince(bgAt)
            if elapsed >= relockInterval {
                isForegroundLocked = true
                authState = .locked(userId)
            }
        }
        backgroundedAt = nil
    }

    /// Called when the app is about to be captured for the app switcher
    /// screenshot. The privacy shield handles the visual blur; this just
    /// marks the state so we know a re-lock may be needed on return.
    func handleSceneInactive() {
        // Nothing to do here — the privacy shield modifier handles the visual
        // blur. The re-lock decision happens in handleEnterForeground.
    }

    // MARK: - Per-screen biometric guard

    /// Returns `true` if enough time has passed since the last biometric
    /// success that a sensitive screen should require re-authentication.
    var needsReauthForSensitiveContent: Bool {
        guard biometricUnlockEnabled, availableBiometry != .none else {
            return false
        }
        guard let last = lastBiometricSuccessAt else {
            // No prior auth in this session — require it.
            return true
        }
        return Date().timeIntervalSince(last) >= biometricReauthInterval
    }

    /// Re-authenticates for a sensitive screen (package/shipment detail).
    /// On success, refreshes the timestamp and returns `true`.
    @MainActor
    func performBiometricReauth(reason: String) async -> Bool {
        guard availableBiometry != .none else { return true }
        let ok = await BiometricAuthService.authenticate(reason: reason)
        if ok {
            lastBiometricSuccessAt = Date()
            Haptics.success()
        } else {
            Haptics.error()
        }
        return ok
    }
}

/// Unit type for LoadState when there's no payload.
struct Unit: Equatable, Sendable {
    init() {}
}

extension String {
    func takeIf(_ predicate: (String) -> Bool) -> String? {
        predicate(self) ? self : nil
    }
}

extension SupabaseService {
    /// Synchronous accessor for `isConfigured` from a non-async context.
    nonisolated var isConfiguredSync: Bool {
        Config.EXPO_PUBLIC_SUPABASE_URL.trimmingCharacters(in: .whitespaces).isEmpty == false
    }
}
