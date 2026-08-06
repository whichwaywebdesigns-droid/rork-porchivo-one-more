//
//  Models.swift
//  Porchivo
//
//  Domain models mirroring android/.../model/*.kt and expo/types/index.ts.
//  Timestamps are epoch millis (Date) to match the rest of the platform.
//

import Foundation

nonisolated enum Carrier: String, CaseIterable, Identifiable, Codable {
    case amazon, ups, usps, fedex, other
    var id: String { rawValue }
    var label: String {
        switch self {
        case .amazon: "Amazon"
        case .ups: "UPS"
        case .usps: "USPS"
        case .fedex: "FedEx"
        case .other: "Other"
        }
    }
    var sfSymbol: String {
        switch self {
        case .amazon: "a.circle.fill"
        case .ups: "u.circle.fill"
        case .usps: "p.circle.fill"
        case .fedex: "f.circle.fill"
        case .other: "shippingbox.fill"
        }
    }
}

nonisolated enum ShipmentStatus: String, CaseIterable, Codable {
    case open, accepted, completed, cancelled
}

nonisolated enum DeliveryStatus: String, CaseIterable, Codable {
    case pending, inTransit, outForDelivery, delivered, deliveredToHomeowner
    var label: String {
        switch self {
        case .pending: "Pending"
        case .inTransit: "In Transit"
        case .outForDelivery: "Out for Delivery"
        case .delivered: "Delivered"
        case .deliveredToHomeowner: "Delivered"
        }
    }
}

nonisolated enum PackageTrackingStatus: String, CaseIterable, Codable {
    case ordered, shipped, outForDelivery, delivered, pickedUp, returned
    var label: String {
        switch self {
        case .ordered: "Ordered"
        case .shipped: "Shipped"
        case .outForDelivery: "Out for Delivery"
        case .delivered: "Delivered"
        case .pickedUp: "Picked Up"
        case .returned: "Returned"
        }
    }
}

nonisolated enum UserRole: String, CaseIterable, Identifiable, Codable {
    case homeowner, partner, both
    var id: String { rawValue }
    var label: String {
        switch self {
        case .homeowner: "Homeowner"
        case .partner: "Porch Partner"
        case .both: "Homeowner & Partner"
        }
    }
}

nonisolated enum SubscriptionTier: String, CaseIterable, Codable {
    case free, premium, family, lifetime
    var label: String {
        switch self {
        case .free: "Free Plan"
        case .premium: "Premium"
        case .family: "Family Plan"
        case .lifetime: "Lifetime"
        }
    }
}

nonisolated enum NotificationType: String, CaseIterable, Codable {
    case trackingAdded, packageDelivered, partnerPickupAlert, partnerCompleted, packageOutForDelivery, packagePickedUp
    var sfSymbol: String {
        switch self {
        case .trackingAdded: "barcode.viewfinder"
        case .packageDelivered: "checkmark.seal.fill"
        case .partnerPickupAlert: "hand.raised.fill"
        case .partnerCompleted: "star.fill"
        case .packageOutForDelivery: "truck.box.fill"
        case .packagePickedUp: "arrow.up.circle.fill"
        }
    }
}

nonisolated enum AddressNickname: String, CaseIterable, Identifiable, Codable {
    case home, work, other
    var id: String { rawValue }
    var label: String {
        switch self {
        case .home: "Home"
        case .work: "Work"
        case .other: "Other"
        }
    }
}

/// Auth user profile — mirrors `profiles` table + `User` domain model.
nonisolated struct User: Identifiable, Equatable, Sendable {
    let id: String
    var name: String
    var phone: String
    var email: String
    var role: UserRole
    var address: String
    var avatarUrl: String?
    var hasLocationConsent: Bool
    var hasPreciseLocationConsent: Bool
    var isPremium: Bool
    var subscriptionTier: SubscriptionTier
    var isOnboarded: Bool
}

nonisolated struct Shipment: Identifiable, Equatable, Sendable {
    let id: String
    let homeownerId: String
    let homeownerName: String
    var partnerId: String?
    var partnerName: String?
    var status: ShipmentStatus
    var carrier: Carrier
    var packagesExpected: String
    var deliveryWindowStart: Date
    var deliveryWindowEnd: Date
    var addressText: String
    var homeLocationVisibleToPartner: Bool
    var notes: String
    var preferredReturnTime: String
    var trackingNumber: String?
    var deliveryStatus: DeliveryStatus
    var createdAt: Date
    var updatedAt: Date
}

nonisolated struct PackageStatusEvent: Identifiable, Equatable, Sendable {
    let id = UUID()
    let status: PackageTrackingStatus
    let timestamp: Date?
    let completed: Bool
}

nonisolated struct TrackedPackage: Identifiable, Equatable, Codable {
    let id: String
    var name: String
    var carrier: Carrier
    var trackingNumber: String
    var expectedDeliveryDate: Date
    var currentStatus: PackageTrackingStatus
    var addressNickname: AddressNickname
    var customAddressLabel: String?
    var notesForPartner: String
    var statusHistory: [PackageStatusEvent]
    var createdAt: Date

    private enum CodingKeys: String, CodingKey {
        case id, name, carrier, trackingNumber, expectedDeliveryDate,
             currentStatus, addressNickname, customAddressLabel,
             notesForPartner, statusHistory, createdAt
    }

    // PackageStatusEvent isn't Codable (UUID id + Date?); encode as a lightweight tuple.
    init(id: String, name: String, carrier: Carrier, trackingNumber: String,
         expectedDeliveryDate: Date, currentStatus: PackageTrackingStatus,
         addressNickname: AddressNickname, customAddressLabel: String? = nil,
         notesForPartner: String = "", statusHistory: [PackageStatusEvent] = [],
         createdAt: Date) {
        self.id = id
        self.name = name
        self.carrier = carrier
        self.trackingNumber = trackingNumber
        self.expectedDeliveryDate = expectedDeliveryDate
        self.currentStatus = currentStatus
        self.addressNickname = addressNickname
        self.customAddressLabel = customAddressLabel
        self.notesForPartner = notesForPartner
        self.statusHistory = statusHistory
        self.createdAt = createdAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        carrier = try c.decode(Carrier.self, forKey: .carrier)
        trackingNumber = try c.decode(String.self, forKey: .trackingNumber)
        expectedDeliveryDate = try c.decode(Date.self, forKey: .expectedDeliveryDate)
        currentStatus = try c.decode(PackageTrackingStatus.self, forKey: .currentStatus)
        addressNickname = try c.decode(AddressNickname.self, forKey: .addressNickname)
        customAddressLabel = try c.decodeIfPresent(String.self, forKey: .customAddressLabel)
        notesForPartner = try c.decodeIfPresent(String.self, forKey: .notesForPartner) ?? ""
        createdAt = try c.decode(Date.self, forKey: .createdAt)
        let raw = try c.decodeIfPresent([StatusEventDTO].self, forKey: .statusHistory) ?? []
        statusHistory = raw.map { $0.toEvent() }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(name, forKey: .name)
        try c.encode(carrier, forKey: .carrier)
        try c.encode(trackingNumber, forKey: .trackingNumber)
        try c.encode(expectedDeliveryDate, forKey: .expectedDeliveryDate)
        try c.encode(currentStatus, forKey: .currentStatus)
        try c.encode(addressNickname, forKey: .addressNickname)
        try c.encodeIfPresent(customAddressLabel, forKey: .customAddressLabel)
        try c.encode(notesForPartner, forKey: .notesForPartner)
        try c.encode(createdAt, forKey: .createdAt)
        try c.encode(statusHistory.map { StatusEventDTO($0) }, forKey: .statusHistory)
    }
}

private nonisolated struct StatusEventDTO: Codable, Sendable {
    let status: PackageTrackingStatus
    let timestamp: Double?
    let completed: Bool
    init(_ e: PackageStatusEvent) {
        status = e.status
        timestamp = e.timestamp?.timeIntervalSince1970
        completed = e.completed
    }
    func toEvent() -> PackageStatusEvent {
        PackageStatusEvent(
            status: status,
            timestamp: timestamp.map { Date(timeIntervalSince1970: $0) },
            completed: completed
        )
    }
}

nonisolated struct DeliveryNotification: Identifiable, Equatable, Sendable {
    let id: String
    let shipmentId: String
    let type: NotificationType
    let title: String
    let message: String
    var read: Bool
    let createdAt: Date
}

/// Resident directory entry — mirrors `get_org_directory` RPC output.
nonisolated struct DirectoryEntry: Identifiable, Equatable, Sendable {
    let id: String
    let name: String
    let role: UserRole
    let address: String
    let avatarUrl: String?
    let isPremium: Bool
}

/// Chat message — mirrors `chat_messages` table.
nonisolated struct ChatMessage: Identifiable, Equatable, Sendable {
    let id: String
    let senderId: String
    let senderName: String
    let senderAvatarUrl: String?
    let body: String
    let createdAt: Date
    let isMine: Bool
}
