//
//  SupabaseService.swift
//  Porchivo
//
//  Direct Supabase REST + Auth client over URLSession — mirrors the Android
//  SupabaseClient. No SDK dependency; same tables/RPCs/RLS as the Expo app.
//
//  Concurrency: DTOs are `nonisolated` Codable structs; the service is an
//  actor so token/session state is serialized.
//

import Foundation
import os.log

// MARK: - DTOs (nonisolated for background decode/encode)

nonisolated struct AuthSession: Codable, Equatable, Sendable {
    var accessToken: String
    var refreshToken: String
    var expiresIn: TimeInterval
    var expiresAt: TimeInterval
    var tokenType: String
    var user: AuthUser?

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresIn = "expires_in"
        case expiresAt = "expires_at"
        case tokenType = "token_type"
        case user
    }

    init(accessToken: String, refreshToken: String, expiresIn: TimeInterval,
         expiresAt: TimeInterval, tokenType: String = "bearer", user: AuthUser? = nil) {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.expiresIn = expiresIn
        self.expiresAt = expiresAt
        self.tokenType = tokenType
        self.user = user
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        accessToken = try c.decode(String.self, forKey: .accessToken)
        refreshToken = try c.decodeIfPresent(String.self, forKey: .refreshToken) ?? ""
        expiresIn = try c.decodeIfPresent(TimeInterval.self, forKey: .expiresIn) ?? 0
        expiresAt = try c.decodeIfPresent(TimeInterval.self, forKey: .expiresAt) ?? 0
        tokenType = try c.decodeIfPresent(String.self, forKey: .tokenType) ?? "bearer"
        user = try c.decodeIfPresent(AuthUser.self, forKey: .user)
    }
}

nonisolated struct AuthUser: Codable, Equatable, Sendable {
    let id: String
    let email: String?
    let aud: String?
    let role: String?

    enum CodingKeys: String, CodingKey {
        case id, email, aud, role
    }

    init(id: String, email: String? = nil, aud: String? = nil, role: String? = nil) {
        self.id = id
        self.email = email
        self.aud = aud
        self.role = role
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        email = try c.decodeIfPresent(String.self, forKey: .email)
        aud = try c.decodeIfPresent(String.self, forKey: .aud)
        role = try c.decodeIfPresent(String.self, forKey: .role)
    }
}

nonisolated struct DbProfile: Codable, Sendable {
    let id: String
    var name: String?
    var phone: String?
    var email: String?
    var avatarUrl: String?
    var role: String?
    var address: String?
    var hasLocationConsent: Bool?
    var hasPreciseLocationConsent: Bool?
    var isPremium: Bool?
    var subscriptionTier: String?
    var isOnboarded: Bool?
    var createdAt: String?
    var updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, name, phone, email
        case avatarUrl = "avatar_url"
        case role, address
        case hasLocationConsent = "has_location_consent"
        case hasPreciseLocationConsent = "has_precise_location_consent"
        case isPremium = "is_premium"
        case subscriptionTier = "subscription_tier"
        case isOnboarded = "is_onboarded"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

nonisolated struct DbShipment: Codable, Sendable {
    let id: String
    let homeownerId: String
    let homeownerName: String
    var partnerId: String?
    var partnerName: String?
    var status: String
    var carrier: String
    var packagesExpected: String
    var deliveryWindowStart: String
    var deliveryWindowEnd: String
    var addressText: String?
    var homeLocationVisibleToPartner: Bool?
    var notes: String?
    var preferredReturnTime: String?
    var trackingNumber: String?
    var deliveryStatus: String
    var completionPhotoUrl: String?
    var createdAt: String?
    var updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case homeownerId = "homeowner_id"
        case homeownerName = "homeowner_name"
        case partnerId = "partner_id"
        case partnerName = "partner_name"
        case status, carrier
        case packagesExpected = "packages_expected"
        case deliveryWindowStart = "delivery_window_start"
        case deliveryWindowEnd = "delivery_window_end"
        case addressText = "address_text"
        case homeLocationVisibleToPartner = "home_location_visible_to_partner"
        case notes
        case preferredReturnTime = "preferred_return_time"
        case trackingNumber = "tracking_number"
        case deliveryStatus = "delivery_status"
        case completionPhotoUrl = "completion_photo_url"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

nonisolated struct DbNotification: Codable, Sendable {
    let id: String
    let shipmentId: String
    let type: String
    let title: String
    let message: String
    let recipientId: String
    var read: Bool
    var createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case shipmentId = "shipment_id"
        case type, title, message
        case recipientId = "recipient_id"
        case read
        case createdAt = "created_at"
    }
}

nonisolated struct DbDirectoryRow: Codable, Sendable {
    let id: String
    let name: String?
    let role: String?
    let address: String?
    let avatarUrl: String?
    let isPremium: Bool?

    enum CodingKeys: String, CodingKey {
        case id, name, role, address
        case avatarUrl = "avatar_url"
        case isPremium = "is_premium"
    }
}

nonisolated struct DbChatMessage: Codable, Sendable {
    let id: String
    let senderId: String
    let senderName: String?
    let senderAvatarUrl: String?
    let body: String?
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case senderId = "sender_id"
        case senderName = "sender_name"
        case senderAvatarUrl = "sender_avatar_url"
        case body
        case createdAt = "created_at"
    }
}

/// Org context row from `get_my_org_context` RPC — mirrors OrgContextRow in Expo.
nonisolated struct DbOrgContextRow: Codable, Sendable {
    let membershipId: String
    let orgId: String
    let orgName: String
    let orgType: String?
    let orgLogoUrl: String?
    let orgIsVerified: Bool?
    let unitId: String?
    let unitNumber: String?
    let role: String
    let status: String
    let joinedAt: String?

    enum CodingKeys: String, CodingKey {
        case membershipId = "membership_id"
        case orgId = "org_id"
        case orgName = "org_name"
        case orgType = "org_type"
        case orgLogoUrl = "org_logo_url"
        case orgIsVerified = "org_is_verified"
        case unitId = "unit_id"
        case unitNumber = "unit_number"
        case role
        case status
        case joinedAt = "joined_at"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        membershipId = try c.decodeIfPresent(String.self, forKey: .membershipId) ?? ""
        orgId = try c.decodeIfPresent(String.self, forKey: .orgId) ?? ""
        orgName = try c.decodeIfPresent(String.self, forKey: .orgName) ?? ""
        orgType = try c.decodeIfPresent(String.self, forKey: .orgType)
        orgLogoUrl = try c.decodeIfPresent(String.self, forKey: .orgLogoUrl)
        orgIsVerified = try c.decodeIfPresent(Bool.self, forKey: .orgIsVerified)
        unitId = try c.decodeIfPresent(String.self, forKey: .unitId)
        unitNumber = try c.decodeIfPresent(String.self, forKey: .unitNumber)
        role = try c.decodeIfPresent(String.self, forKey: .role) ?? "resident"
        status = try c.decodeIfPresent(String.self, forKey: .status) ?? "pending"
        joinedAt = try c.decodeIfPresent(String.self, forKey: .joinedAt)
    }
}

/// Lightweight org membership for AppState.
nonisolated struct OrgMembership: Equatable, Sendable {
    let orgId: String
    let orgName: String
    let role: String
    let status: String
    let inviteCode: String?

    var isActive: Bool { status == "active" }
    var isPending: Bool { status == "pending" }
    var isAdmin: Bool {
        let adminRoles: Set<String> = ["hoa_admin", "property_manager", "board_member"]
        return isActive && adminRoles.contains(role)
    }
}

// MARK: - Announcements

nonisolated struct DbAnnouncement: Codable, Sendable {
    let id: String
    var orgId: String?
    var authorId: String?
    var authorDisplayName: String?
    var title: String
    var body: String
    var priority: String?
    var category: String?
    var isPinned: Bool?
    var expiresAt: String?
    var scheduledAt: String?
    var viewCount: Int?
    var createdAt: String?
    var updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case orgId = "org_id"
        case authorId = "author_id"
        case authorDisplayName = "author_display_name"
        case title, body, priority, category
        case isPinned = "is_pinned"
        case expiresAt = "expires_at"
        case scheduledAt = "scheduled_at"
        case viewCount = "view_count"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? ""
        orgId = try c.decodeIfPresent(String.self, forKey: .orgId)
        authorId = try c.decodeIfPresent(String.self, forKey: .authorId)
        authorDisplayName = try c.decodeIfPresent(String.self, forKey: .authorDisplayName)
        title = try c.decodeIfPresent(String.self, forKey: .title) ?? ""
        body = try c.decodeIfPresent(String.self, forKey: .body) ?? ""
        priority = try c.decodeIfPresent(String.self, forKey: .priority)
        category = try c.decodeIfPresent(String.self, forKey: .category)
        isPinned = try c.decodeIfPresent(Bool.self, forKey: .isPinned)
        expiresAt = try c.decodeIfPresent(String.self, forKey: .expiresAt)
        scheduledAt = try c.decodeIfPresent(String.self, forKey: .scheduledAt)
        viewCount = try c.decodeIfPresent(Int.self, forKey: .viewCount)
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
        updatedAt = try c.decodeIfPresent(String.self, forKey: .updatedAt)
    }
}

// MARK: - Maintenance RPC row

/// Row returned by `get_my_maintenance_requests` RPC (resident-facing, fewer fields).
nonisolated struct DbMyMaintenanceRequest: Codable, Sendable {
    let id: String
    var category: String?
    var priority: String?
    var status: String?
    var title: String?
    var description: String?
    var locationDetail: String?
    var residentVisibleNote: String?
    var resolutionCode: String?
    var scheduledFor: String?
    var completedAt: String?
    var commentCount: Int?
    var createdAt: String?
    var updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, category, priority, status, title, description
        case locationDetail = "location_detail"
        case residentVisibleNote = "resident_visible_note"
        case resolutionCode = "resolution_code"
        case scheduledFor = "scheduled_for"
        case completedAt = "completed_at"
        case commentCount = "comment_count"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? ""
        category = try c.decodeIfPresent(String.self, forKey: .category)
        priority = try c.decodeIfPresent(String.self, forKey: .priority)
        status = try c.decodeIfPresent(String.self, forKey: .status)
        title = try c.decodeIfPresent(String.self, forKey: .title)
        description = try c.decodeIfPresent(String.self, forKey: .description)
        locationDetail = try c.decodeIfPresent(String.self, forKey: .locationDetail)
        residentVisibleNote = try c.decodeIfPresent(String.self, forKey: .residentVisibleNote)
        resolutionCode = try c.decodeIfPresent(String.self, forKey: .resolutionCode)
        scheduledFor = try c.decodeIfPresent(String.self, forKey: .scheduledFor)
        completedAt = try c.decodeIfPresent(String.self, forKey: .completedAt)
        commentCount = try c.decodeIfPresent(Int.self, forKey: .commentCount)
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
        updatedAt = try c.decodeIfPresent(String.self, forKey: .updatedAt)
    }
}

// MARK: - SupabaseService

actor SupabaseService {
    private let baseURL: URL
    private let anonKey: String
    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    private(set) var currentSession: AuthSession?

    static let shared: SupabaseService = {
        let urlStr = Config.EXPO_PUBLIC_SUPABASE_URL.trimmingCharacters(in: .whitespaces)
        let key = Config.EXPO_PUBLIC_SUPABASE_ANON_KEY
        let fallbackURL = URL(string: "https://placeholder.supabase.co")
            ?? URL(string: "https://example.com")!
        return SupabaseService(baseURL: URL(string: urlStr) ?? fallbackURL,
                               anonKey: key)
    }()

    init(baseURL: URL, anonKey: String) {
        self.baseURL = baseURL
        self.anonKey = anonKey
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = 20
        cfg.timeoutIntervalForResource = 25
        cfg.waitsForConnectivity = true
        self.session = URLSession(configuration: cfg)
        self.decoder = JSONDecoder()
        self.encoder = JSONEncoder()
    }

    var isConfigured: Bool {
        !anonKey.isEmpty && baseURL.host?.contains("placeholder") == false
    }

    var currentUserId: String? { currentSession?.user?.id }
    var isAuthenticated: Bool { currentSession != nil }

    // MARK: Session persistence

    func restoreSession() async -> AuthSession? {
        if let saved = currentSession { return saved }
        guard let data = (try? KeychainStore.loadSession()) ?? nil else { return nil }
        guard let session = try? decoder.decode(AuthSession.self, from: data) else {
            KeychainStore.clearSession()
            return nil
        }
        let now = Date().timeIntervalSince1970
        if session.expiresAt > 0 && session.expiresAt - 60 < now {
            if let refreshed = await refreshSession(session.refreshToken) {
                currentSession = refreshed
                return refreshed
            }
            KeychainStore.clearSession()
            return nil
        }
        currentSession = session
        return session
    }

    private func persist(_ session: AuthSession) async {
        currentSession = session
        if let data = try? encoder.encode(session) {
            try? KeychainStore.saveSession(data)
        }
    }

    // MARK: Auth

    func signInWithEmail(_ email: String, _ password: String) async -> Result<AuthSession, Error> {
        let body: [String: Any] = ["email": email, "password": password]
        return await authPost("token?grant_type=password", body: body) { [weak self] data in
            guard let self else { throw URLError(.cannotConnectToHost) }
            var session = try self.decoder.decode(AuthSession.self, from: data)
            if session.expiresAt == 0, session.expiresIn > 0 {
                session.expiresAt = Date().timeIntervalSince1970 + session.expiresIn
            }
            // Fetch user
            if let user = try? await self.fetchUser(token: session.accessToken) {
                session.user = user
            }
            await self.persist(session)
            return session
        }
    }

    func signUpWithEmail(_ email: String, _ password: String) async -> Result<AuthSession, Error> {
        let body: [String: Any] = ["email": email, "password": password]
        return await authPost("signup", body: body) { [weak self] data in
            guard let self else { throw URLError(.cannotConnectToHost) }
            let session = try self.decoder.decode(AuthSession.self, from: data)
            if !session.accessToken.isEmpty {
                await self.persist(session)
            }
            return session
        }
    }

    // MARK: Magic link / OTP auth

    /// Sends a magic link email to the given address. The email contains a
    /// 6-digit OTP code the user enters in-app — no deep link required.
    /// Returns the real error message from Supabase on failure.
    func sendMagicLink(_ email: String) async -> Result<Void, Error> {
        var req = URLRequest(url: baseURL.appendingPathComponent("auth/v1/otp"))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        req.httpBody = try? JSONSerialization.data(withJSONObject: [
            "email": email,
            "options": ["should_create_user": true],
        ])
        do {
            let (data, resp) = try await session.data(for: req)
            guard let http = resp as? HTTPURLResponse else {
                return .failure(URLError(.badServerResponse))
            }
            guard (200..<300).contains(http.statusCode) else {
                let msg = errorMessage(from: data) ?? "Request failed (\(http.statusCode))."
                return .failure(NSError(domain: "SupabaseAuth", code: http.statusCode,
                                         userInfo: [NSLocalizedDescriptionKey: msg]))
            }
            return .success(())
        } catch {
            return .failure(error)
        }
    }

    /// Verifies the 6-digit OTP code Supabase emailed and establishes a session.
    /// On success the session is persisted to Keychain and returned.
    func verifyOtp(email: String, token: String) async -> Result<AuthSession, Error> {
        let body: [String: Any] = [
            "email": email,
            "token": token,
            "type": "magiclink",
        ]
        return await authPost("token?grant_type=otp", body: body) { [weak self] data in
            guard let self else { throw URLError(.cannotConnectToHost) }
            var session = try self.decoder.decode(AuthSession.self, from: data)
            if session.expiresAt == 0, session.expiresIn > 0 {
                session.expiresAt = Date().timeIntervalSince1970 + session.expiresIn
            }
            if let user = try? await self.fetchUser(token: session.accessToken) {
                session.user = user
            }
            await self.persist(session)
            return session
        }
    }

    private func refreshSession(_ refreshToken: String) async -> AuthSession? {
        let body: [String: Any] = ["refresh_token": refreshToken]
        let result: Result<AuthSession, Error> = await authPost("token?grant_type=refresh_token", body: body) { [weak self] data in
            guard let self else { throw URLError(.cannotConnectToHost) }
            var session = try self.decoder.decode(AuthSession.self, from: data)
            if session.expiresAt == 0, session.expiresIn > 0 {
                session.expiresAt = Date().timeIntervalSince1970 + session.expiresIn
            }
            if let old = await self.currentSession {
                session.user = old.user
            }
            await self.persist(session)
            return session
        }
        return try? result.get()
    }

    private func fetchUser(token: String) async throws -> AuthUser? {
        var req = URLRequest(url: baseURL.appendingPathComponent("auth/v1/user"))
        req.httpMethod = "GET"
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        let (data, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else { return nil }
        return try decoder.decode(AuthUser.self, from: data)
    }

    func signOut() {
        currentSession = nil
        KeychainStore.clearSession()
    }

    // MARK: REST queries

    /// Fetch the authenticated user's profile row.
    func fetchProfile(userId: String) async -> Result<DbProfile?, Error> {
        guard let comps = URLComponents(url: baseURL.appendingPathComponent("rest/v1/profiles"), resolvingAgainstBaseURL: false),
              let url = comps.url else { return .failure(URLError(.badURL)) }
        var c = comps
        c.queryItems = [URLQueryItem(name: "id", value: "eq.\(userId)"), URLQueryItem(name: "limit", value: "1")]
        return await restGet(url: c.url ?? url, singleton: true)
    }

    /// Persist a native iOS APNS device token to the user's profile so the
    /// backend can send Apple Push Notification service alerts.
    func saveAPNSToken(userId: String, token: String) async {
        let result = await updateProfile(userId: userId, ["apns_token": token])
        switch result {
        case .success:
            os_log("APNS token saved for user %{private}@", log: .default, type: .info, String(userId.suffix(8)))
        case .failure(let err):
            os_log("APNS token save error: %@", log: .default, type: .error, err.localizedDescription)
        }
    }

    func updateProfile(userId: String, _ updates: [String: Any?]) async -> Result<DbProfile, Error> {
        guard let comps = URLComponents(url: baseURL.appendingPathComponent("rest/v1/profiles"), resolvingAgainstBaseURL: false),
              let url = comps.url else { return .failure(URLError(.badURL)) }
        var c = comps
        c.queryItems = [URLQueryItem(name: "id", value: "eq.\(userId)")]
        return await restPatch(url: c.url ?? url, body: updates, singleton: true)
    }

    func fetchShipments(userId: String) async -> Result<[DbShipment], Error> {
        guard let comps = URLComponents(url: baseURL.appendingPathComponent("rest/v1/shipments"), resolvingAgainstBaseURL: false),
              let url = comps.url else { return .failure(URLError(.badURL)) }
        var c = comps
        c.queryItems = [
            URLQueryItem(name: "or", value: "(homeowner_id.eq.\(userId),partner_id.eq.\(userId),status.eq.open)"),
            URLQueryItem(name: "order", value: "created_at.desc"),
        ]
        return await restGet(url: c.url ?? url)
    }

    func insertShipment(_ body: [String: Any?]) async -> Result<DbShipment, Error> {
        await restPost(url: baseURL.appendingPathComponent("rest/v1/shipments"), body: body, singleton: true)
    }

    func updateShipment(id: String, _ updates: [String: Any?]) async -> Result<DbShipment, Error> {
        guard let comps = URLComponents(url: baseURL.appendingPathComponent("rest/v1/shipments"), resolvingAgainstBaseURL: false),
              let url = comps.url else { return .failure(URLError(.badURL)) }
        var c = comps
        c.queryItems = [URLQueryItem(name: "id", value: "eq.\(id)")]
        return await restPatch(url: c.url ?? url, body: updates, singleton: true)
    }

    func fetchNotifications(userId: String) async -> Result<[DbNotification], Error> {
        guard let comps = URLComponents(url: baseURL.appendingPathComponent("rest/v1/notifications"), resolvingAgainstBaseURL: false),
              let url = comps.url else { return .failure(URLError(.badURL)) }
        var c = comps
        c.queryItems = [
            URLQueryItem(name: "recipient_id", value: "eq.\(userId)"),
            URLQueryItem(name: "order", value: "created_at.desc"),
        ]
        return await restGet(url: c.url ?? url)
    }

    func markNotificationRead(id: String) async -> Result<Void, Error> {
        guard let comps = URLComponents(url: baseURL.appendingPathComponent("rest/v1/notifications"), resolvingAgainstBaseURL: false),
              let url = comps.url else { return .failure(URLError(.badURL)) }
        var c = comps
        c.queryItems = [URLQueryItem(name: "id", value: "eq.\(id)")]
        return await restPatchMinimal(url: c.url ?? url, body: ["read": true])
    }

    func markAllNotificationsRead(userId: String) async -> Result<Void, Error> {
        guard let comps = URLComponents(url: baseURL.appendingPathComponent("rest/v1/notifications"), resolvingAgainstBaseURL: false),
              let url = comps.url else { return .failure(URLError(.badURL)) }
        var c = comps
        c.queryItems = [
            URLQueryItem(name: "recipient_id", value: "eq.\(userId)"),
            URLQueryItem(name: "read", value: "eq.false"),
        ]
        return await restPatchMinimal(url: c.url ?? url, body: ["read": true])
    }

    func acceptShipment(id: String) async -> Result<Void, Error> {
        await rpcVoid("accept_shipment", body: ["p_shipment_id": id])
    }

    func fetchDirectory(orgMemberId: String) async -> Result<[DbDirectoryRow], Error> {
        await rpc("get_org_directory", body: ["p_org_id": orgMemberId])
    }

    /// Fetches the current user's org memberships via `get_my_org_context` RPC.
    /// Returns active + pending memberships. Empty array if the user belongs
    /// to no org or the RPC is unavailable.
    func fetchOrgContext() async -> Result<[DbOrgContextRow], Error> {
        await rpc("get_my_org_context", body: [:])
    }

    func fetchChatMessages(threadId: String, limit: Int = 100) async -> Result<[DbChatMessage], Error> {
        guard let comps = URLComponents(url: baseURL.appendingPathComponent("rest/v1/chat_messages"), resolvingAgainstBaseURL: false),
              let url = comps.url else { return .failure(URLError(.badURL)) }
        var c = comps
        c.queryItems = [
            URLQueryItem(name: "thread_id", value: "eq.\(threadId)"),
            URLQueryItem(name: "order", value: "created_at.asc"),
            URLQueryItem(name: "limit", value: String(limit)),
        ]
        return await restGet(url: c.url ?? url)
    }

    func sendChatMessage(threadId: String, body: String, sender: User) async -> Result<DbChatMessage, Error> {
        let payload: [String: Any?] = [
            "thread_id": threadId,
            "sender_id": sender.id,
            "sender_name": sender.name,
            "sender_avatar_url": sender.avatarUrl,
            "body": body,
        ]
        return await restPost(url: baseURL.appendingPathComponent("rest/v1/chat_messages"), body: payload, singleton: true)
    }

    // MARK: - Announcements (direct table read/write — RLS handles permissions)

    /// Fetches published announcements for the user's org, ordered pinned-first then newest.
    func fetchAnnouncements(orgId: String) async -> Result<[DbAnnouncement], Error> {
        guard let comps = URLComponents(url: baseURL.appendingPathComponent("rest/v1/org_announcements"), resolvingAgainstBaseURL: false),
              let url = comps.url else { return .failure(URLError(.badURL)) }
        var c = comps
        c.queryItems = [
            URLQueryItem(name: "org_id", value: "eq.\(orgId)"),
            URLQueryItem(name: "or", value: "(scheduled_at.is.null,scheduled_at.lte.now())"),
            URLQueryItem(name: "order", value: "is_pinned.desc,created_at.desc"),
            URLQueryItem(name: "limit", value: "30"),
        ]
        return await restGet(url: c.url ?? url)
    }

    /// Posts a new announcement to the org_announcements table. Staff/admin only (enforced by RLS).
    func insertAnnouncement(_ body: [String: Any?]) async -> Result<DbAnnouncement, Error> {
        await restPost(url: baseURL.appendingPathComponent("rest/v1/org_announcements"), body: body, singleton: true)
    }

    // MARK: - Maintenance RPCs

    /// Submits a new maintenance request via the `submit_maintenance_request` RPC.
    /// Returns the new request UUID.
    func submitMaintenanceRequest(orgId: String, category: String, priority: String,
                                  title: String, description: String?, location: String?) async -> Result<String, Error> {
        let body: [String: Any?] = [
            "p_org_id": orgId,
            "p_category": category,
            "p_priority": priority,
            "p_title": title,
            "p_description": description,
            "p_location": location,
        ]
        let result: Result<String, Error> = await rpc("submit_maintenance_request", body: body)
        return result
    }

    /// Fetches the current user's maintenance requests via `get_my_maintenance_requests` RPC.
    func fetchMyMaintenanceRequests(orgId: String) async -> Result<[DbMyMaintenanceRequest], Error> {
        await rpc("get_my_maintenance_requests", body: ["p_org_id": orgId])
    }

    // MARK: Storage (avatars)

    /// Uploads avatar bytes to the `avatars` bucket under `<userId>/<uuid>.<ext>`.
    /// Returns the public URL of the uploaded object.
    func uploadAvatar(userId: String, data: Data, ext: String) async -> Result<String, Error> {
        let objectPath = "\(userId)/\(UUID().uuidString).\(ext)"
        var req = URLRequest(url: baseURL.appendingPathComponent("storage/v1/object/avatars/\(objectPath)"))
        req.httpMethod = "POST"
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        if let token = currentSession?.accessToken {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        req.setValue("image/\(ext)", forHTTPHeaderField: "Content-Type")
        req.setValue("public-read", forHTTPHeaderField: "x-upsert")
        req.httpBody = data
        do {
            let (_, resp) = try await session.data(for: req)
            guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                return .failure(URLError(.cannotWriteToFile))
            }
            let publicURL = baseURL
                .appendingPathComponent("storage/v1/object/public/avatars/\(objectPath)")
            return .success(publicURL.absoluteString)
        } catch {
            return .failure(error)
        }
    }

    /// Best-effort delete of an avatar object extracted from a public URL.
    func deleteAvatar(publicURL: String) async {
        guard let url = URL(string: publicURL) else { return }
        // public URL: .../storage/v1/object/public/avatars/<path>
        let path = url.path
        guard let range = path.range(of: "/public/avatars/") else { return }
        let objectPath = String(path[range.upperBound...])
        var req = URLRequest(url: baseURL.appendingPathComponent("storage/v1/object/avatars/\(objectPath)"))
        req.httpMethod = "DELETE"
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        if let token = currentSession?.accessToken {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        _ = try? await session.data(for: req)
    }

    // MARK: Low-level helpers

    private func authHeaders(includeBearer: Bool) -> [String: String] {
        var h = ["apikey": anonKey, "Content-Type": "application/json"]
        if includeBearer, let token = currentSession?.accessToken {
            h["Authorization"] = "Bearer \(token)"
        }
        return h
    }

    private func authPost<T: Decodable>(_ path: String, body: [String: Any],
                                        parse: @escaping (Data) async throws -> T) async -> Result<T, Error> {
        var req = URLRequest(url: baseURL.appendingPathComponent("auth/v1/\(path)"))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        do {
            let (data, resp) = try await session.data(for: req)
            guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                let msg = errorMessage(from: data) ?? "Authentication failed."
                return .failure(NSError(domain: "SupabaseAuth", code: 1, userInfo: [NSLocalizedDescriptionKey: msg]))
            }
            let parsed = try await parse(data)
            return .success(parsed)
        } catch {
            return .failure(error)
        }
    }

    private func restGet<T: Decodable>(url: URL, singleton: Bool = false) async -> Result<T, Error> {
        var req = URLRequest(url: url)
        req.httpMethod = "GET"
        for (k, v) in authHeaders(includeBearer: true) { req.setValue(v, forHTTPHeaderField: k) }
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if singleton {
            req.setValue("application/vnd.pgrst.object+json", forHTTPHeaderField: "Accept")
        }
        do {
            let (data, resp) = try await session.data(for: req)
            guard let http = resp as? HTTPURLResponse else { return .failure(URLError(.badServerResponse)) }
            if singleton && http.statusCode == 406 {
                // No row found — safe-cast nil for Optional<T> callers
                if let nilResult = Optional<T>.none as? T {
                    return .success(nilResult)
                }
                return .failure(NSError(domain: "SupabaseREST", code: 406,
                                         userInfo: [NSLocalizedDescriptionKey: "No row found"]))
            }
            guard (200..<300).contains(http.statusCode) else {
                let msg = errorMessage(from: data) ?? "Request failed (\(http.statusCode))."
                return .failure(NSError(domain: "SupabaseREST", code: http.statusCode, userInfo: [NSLocalizedDescriptionKey: msg]))
            }
            let decoded = try decoder.decode(T.self, from: data)
            return .success(decoded)
        } catch {
            return .failure(error)
        }
    }

    private func restPost<T: Decodable>(url: URL, body: [String: Any?], singleton: Bool = false) async -> Result<T, Error> {
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        for (k, v) in authHeaders(includeBearer: true) { req.setValue(v, forHTTPHeaderField: k) }
        req.setValue("return=representation", forHTTPHeaderField: "Prefer")
        if singleton { req.setValue("application/vnd.pgrst.object+json", forHTTPHeaderField: "Accept") }
        req.httpBody = try? JSONSerialization.data(withJSONObject: body.compactMapValues { $0 ?? NSNull() })
        return await runRequest(req, singleton: singleton)
    }

    private func restPatch<T: Decodable>(url: URL, body: [String: Any?], singleton: Bool = false) async -> Result<T, Error> {
        var req = URLRequest(url: url)
        req.httpMethod = "PATCH"
        for (k, v) in authHeaders(includeBearer: true) { req.setValue(v, forHTTPHeaderField: k) }
        req.setValue("return=representation", forHTTPHeaderField: "Prefer")
        if singleton { req.setValue("application/vnd.pgrst.object+json", forHTTPHeaderField: "Accept") }
        req.httpBody = try? JSONSerialization.data(withJSONObject: body.compactMapValues { $0 ?? NSNull() })
        return await runRequest(req, singleton: singleton)
    }

    private func restPatchMinimal(url: URL, body: [String: Any?]) async -> Result<Void, Error> {
        var req = URLRequest(url: url)
        req.httpMethod = "PATCH"
        for (k, v) in authHeaders(includeBearer: true) { req.setValue(v, forHTTPHeaderField: k) }
        req.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        req.httpBody = try? JSONSerialization.data(withJSONObject: body.compactMapValues { $0 ?? NSNull() })
        do {
            let (_, resp) = try await session.data(for: req)
            guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                return .failure(URLError(.badServerResponse))
            }
            return .success(())
        } catch {
            return .failure(error)
        }
    }

    private func rpc<T: Decodable>(_ name: String, body: [String: Any?]) async -> Result<T, Error> {
        var req = URLRequest(url: baseURL.appendingPathComponent("rest/v1/rpc/\(name)"))
        req.httpMethod = "POST"
        for (k, v) in authHeaders(includeBearer: true) { req.setValue(v, forHTTPHeaderField: k) }
        req.httpBody = try? JSONSerialization.data(withJSONObject: body.compactMapValues { $0 ?? NSNull() })
        return await runRequest(req, singleton: false)
    }

    private func rpcVoid(_ name: String, body: [String: Any?]) async -> Result<Void, Error> {
        var req = URLRequest(url: baseURL.appendingPathComponent("rest/v1/rpc/\(name)"))
        req.httpMethod = "POST"
        for (k, v) in authHeaders(includeBearer: true) { req.setValue(v, forHTTPHeaderField: k) }
        req.httpBody = try? JSONSerialization.data(withJSONObject: body.compactMapValues { $0 ?? NSNull() })
        do {
            let (_, resp) = try await session.data(for: req)
            guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                return .failure(URLError(.badServerResponse))
            }
            return .success(())
        } catch {
            return .failure(error)
        }
    }

    // MARK: Edge Functions

    /// Invokes a Supabase Edge Function by name. POSTs to
    /// `{baseURL}/functions/v1/{name}` with auth headers + JSON body.
    /// Returns the raw response data on success.
    func invokeEdgeFunction(_ name: String, body: [String: Any]) async -> Result<Data, Error> {
        var req = URLRequest(url: baseURL.appendingPathComponent("functions/v1/\(name)"))
        req.httpMethod = "POST"
        for (k, v) in authHeaders(includeBearer: true) { req.setValue(v, forHTTPHeaderField: k) }
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        do {
            let (data, resp) = try await session.data(for: req)
            guard let http = resp as? HTTPURLResponse else {
                return .failure(URLError(.badServerResponse))
            }
            guard (200..<300).contains(http.statusCode) else {
                let msg = errorMessage(from: data) ?? "Function \(name) failed (\(http.statusCode))."
                return .failure(NSError(domain: "EdgeFunction", code: http.statusCode,
                                         userInfo: [NSLocalizedDescriptionKey: msg]))
            }
            return .success(data)
        } catch {
            return .failure(error)
        }
    }

    // MARK: Org checkout (B2B Stripe Checkout)

    nonisolated struct OrgCheckoutResponse: Decodable, Sendable {
        let checkoutUrl: String
        let sessionId: String
        let orgId: String
    }

    nonisolated struct OrgConfirmResponse: Decodable, Sendable {
        let success: Bool?
        let error: String?
        let org: OrgConfirmOrg?
    }

    nonisolated struct OrgConfirmOrg: Decodable, Sendable {
        let id: String?
        let name: String?
        let inviteCode: String?
        let planTier: String?
    }

    /// Calls `create-org-checkout` edge function to create a pending org + Stripe Checkout session.
    /// Returns the checkout URL, session ID, and org ID.
    func createOrgCheckout(
        name: String, type: String, address: String, city: String, state: String,
        zip: String, totalUnits: Int?, planTier: String, billingCycle: String,
        returnUrl: String
    ) async -> Result<OrgCheckoutResponse, Error> {
        let body: [String: Any] = [
            "name": name,
            "type": type,
            "address": address,
            "city": city,
            "state": state,
            "zip": zip,
            "totalUnits": totalUnits ?? NSNull(),
            "planTier": planTier,
            "billingCycle": billingCycle,
            "returnUrl": returnUrl,
        ]
        let result = await invokeEdgeFunction("create-org-checkout", body: body)
        switch result {
        case .success(let data):
            do {
                let decoded = try decoder.decode(OrgCheckoutResponse.self, from: data)
                return .success(decoded)
            } catch {
                return .failure(error)
            }
        case .failure(let err):
            return .failure(err)
        }
    }

    /// Calls `confirm-org-signup` edge function to verify payment and activate the org.
    func confirmOrgSignup(sessionId: String, orgId: String) async -> Result<OrgConfirmResponse, Error> {
        let body: [String: Any] = [
            "sessionId": sessionId,
            "orgId": orgId,
        ]
        let result = await invokeEdgeFunction("confirm-org-signup", body: body)
        switch result {
        case .success(let data):
            do {
                let decoded = try decoder.decode(OrgConfirmResponse.self, from: data)
                return .success(decoded)
            } catch {
                return .failure(error)
            }
        case .failure(let err):
            return .failure(err)
        }
    }

    // MARK: Account deletion (graceful — 30-day deactivation)

    struct DeletionResult: Decodable, Sendable {
        let success: Bool
        let error: String?
        let email: String?
    }

    func requestAccountDeletion() async -> Result<DeletionResult, Error> {
        let result: Result<DeletionResult, Error> = await rpc(
            "request_account_deletion",
            body: [:]
        )
        return result
    }

    private func runRequest<T: Decodable>(_ req: URLRequest, singleton: Bool) async -> Result<T, Error> {
        do {
            let (data, resp) = try await session.data(for: req)
            guard let http = resp as? HTTPURLResponse else { return .failure(URLError(.badServerResponse)) }
            guard (200..<300).contains(http.statusCode) else {
                let msg = errorMessage(from: data) ?? "Request failed (\(http.statusCode))."
                return .failure(NSError(domain: "SupabaseREST", code: http.statusCode, userInfo: [NSLocalizedDescriptionKey: msg]))
            }
            let decoded = try decoder.decode(T.self, from: data)
            return .success(decoded)
        } catch {
            return .failure(error)
        }
    }

    // MARK: - Offline queue replay

    /// Replay a queued action against Supabase REST. Used by the offline
    /// action queue when connectivity is restored. Returns true on HTTP success.
    func replayQueuedAction(
        type: String,
        target: String,
        payload: Data,
        filter: [String: String]?
    ) async -> Bool {
        do {
            switch type {
            case "insert":
                let url = baseURL.appendingPathComponent("rest/v1/\(target)")
                var req = URLRequest(url: url)
                req.httpMethod = "POST"
                for (k, v) in authHeaders(includeBearer: true) {
                    req.setValue(v, forHTTPHeaderField: k)
                }
                req.setValue("return=minimal", forHTTPHeaderField: "Prefer")
                req.httpBody = payload
                let (_, response) = try await session.data(for: req)
                if let http = response as? HTTPURLResponse {
                    return http.statusCode < 400
                }
                return false

            case "update":
                var urlString = baseURL.absoluteString
                if urlString.hasSuffix("/") { urlString.removeLast() }
                urlString += "/rest/v1/\(target)"
                if let filter {
                    var parts: [String] = []
                    for (key, value) in filter {
                        parts.append("\(key)=eq.\(value)")
                    }
                    if !parts.isEmpty {
                        urlString += "?" + parts.joined(separator: "&")
                    }
                }
                guard let url = URL(string: urlString) else { return false }
                var req = URLRequest(url: url)
                req.httpMethod = "PATCH"
                for (k, v) in authHeaders(includeBearer: true) {
                    req.setValue(v, forHTTPHeaderField: k)
                }
                req.setValue("return=minimal", forHTTPHeaderField: "Prefer")
                req.httpBody = payload
                let (_, response) = try await session.data(for: req)
                if let http = response as? HTTPURLResponse {
                    return http.statusCode < 400
                }
                return false

            case "rpc":
                let url = baseURL.appendingPathComponent("rest/v1/rpc/\(target)")
                var req = URLRequest(url: url)
                req.httpMethod = "POST"
                for (k, v) in authHeaders(includeBearer: true) {
                    req.setValue(v, forHTTPHeaderField: k)
                }
                req.httpBody = payload
                let (_, response) = try await session.data(for: req)
                if let http = response as? HTTPURLResponse {
                    return http.statusCode < 400
                }
                return false

            default:
                return false
            }
        } catch {
            return false
        }
    }

    private func errorMessage(from data: Data) -> String? {
        guard let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        if let msg = obj["message"] as? String { return msg }
        if let error = obj["error"] as? String { return error }
        return nil
    }
}
