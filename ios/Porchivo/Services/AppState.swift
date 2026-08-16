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
    private let biometricPrefKey = "porchivo_biometric_unlock_enabled"
    private let biometricDeclinedKey = "porchivo_biometric_enrollment_declined"
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init() {
        isSupabaseConfigured = supabase.isConfiguredSync
        encoder.dateEncodingStrategy = .iso8601
        decoder.dateDecodingStrategy = .iso8601
        availableBiometry = BiometricAuthService.availableType()
        biometricUnlockEnabled = UserDefaults.standard.bool(forKey: biometricPrefKey)
        biometricEnrollmentDeclined = UserDefaults.standard.bool(forKey: biometricDeclinedKey)
        // Language is loaded in LanguageManager.init() — nothing to do here,
        // but we reference it so the @Observable state is live.
        _ = languageManager
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
    @MainActor
    func sendMagicLink(email: String) async -> Bool {
        if !isSupabaseConfigured {
            // Demo mode — pretend the link was sent.
            return true
        }
        return await supabase.sendMagicLink(email.trimmingCharacters(in: .whitespaces))
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
        await supabase.signOut()
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

    @MainActor
    private func loadInitialData(userId: String) async {
        await loadProfile(userId: userId)
        await loadShipments(userId: userId)
        await loadNotifications(userId: userId)
        await loadOrgContext(userId: userId)
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
        orgLoadState = .loading
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
            } else {
                orgMembership = nil
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
