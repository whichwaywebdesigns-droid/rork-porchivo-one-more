//
//  Mappers.swift
//  Porchivo
//
//  DTO → domain mappers mirroring expo/lib/mappers.ts and android Mappers.kt.
//

import Foundation

enum Mappers {
    private static let isoFMTs: [ISO8601DateFormatter] = {
        let f1 = ISO8601DateFormatter()
        f1.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let f2 = ISO8601DateFormatter()
        f2.formatOptions = [.withInternetDateTime]
        return [f1, f2]
    }()

    static func parseISO(_ string: String?) -> Date {
        guard let s = string, !s.isEmpty else { return Date(timeIntervalSince1970: 0) }
        for f in isoFMTs { if let d = f.date(from: s) { return d } }
        // Postgres may emit "YYYY-MM-DDTHH:mm:ss.SSSSSS+00:00" — strip sub-seconds beyond ms.
        if let r = s.range(of: "\\.(\\d+)", options: .regularExpression) {
            let trimmed = s.replacingCharacters(in: r, with: ".000")
            for f in isoFMTs { if let d = f.date(from: trimmed) { return d } }
        }
        return Date(timeIntervalSince1970: 0)
    }

    static func toISO(_ date: Date) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.string(from: date)
    }

    static func parseUserRole(_ raw: String?) -> UserRole {
        switch (raw ?? "").lowercased() {
        case "partner": return .partner
        case "both": return .both
        default: return .homeowner
        }
    }

    static func parseCarrier(_ raw: String?) -> Carrier {
        switch (raw ?? "").lowercased() {
        case "amazon": return .amazon
        case "ups": return .ups
        case "usps": return .usps
        case "fedex": return .fedex
        default: return .other
        }
    }

    static func parseShipmentStatus(_ raw: String?) -> ShipmentStatus {
        switch (raw ?? "").lowercased() {
        case "accepted": return .accepted
        case "completed": return .completed
        case "cancelled": return .cancelled
        default: return .open
        }
    }

    static func parseDeliveryStatus(_ raw: String?) -> DeliveryStatus {
        switch (raw ?? "").lowercased() {
        case "in_transit": return .inTransit
        case "out_for_delivery": return .outForDelivery
        case "delivered": return .delivered
        case "delivered_to_homeowner": return .deliveredToHomeowner
        default: return .pending
        }
    }

    static func parseNotificationType(_ raw: String?) -> NotificationType {
        switch (raw ?? "").lowercased() {
        case "tracking_added": return .trackingAdded
        case "partner_pickup_alert": return .partnerPickupAlert
        case "partner_completed": return .partnerCompleted
        case "package_out_for_delivery": return .packageOutForDelivery
        case "package_picked_up": return .packagePickedUp
        default: return .packageDelivered
        }
    }

    static func toUser(_ p: DbProfile) -> User {
        User(
            id: p.id,
            name: p.name ?? "",
            phone: p.phone ?? "",
            email: p.email ?? "",
            role: parseUserRole(p.role),
            address: p.address ?? "",
            avatarUrl: p.avatarUrl,
            hasLocationConsent: p.hasLocationConsent ?? false,
            hasPreciseLocationConsent: p.hasPreciseLocationConsent ?? false,
            isPremium: p.isPremium ?? false,
            subscriptionTier: parseTier(p.subscriptionTier, p.isPremium ?? false),
            isOnboarded: p.isOnboarded ?? false
        )
    }

    static func parseTier(_ raw: String?, _ isPremium: Bool) -> SubscriptionTier {
        if let raw, let t = SubscriptionTier(rawValue: raw.lowercased()) { return t }
        return isPremium ? .premium : .free
    }

    static func toShipment(_ s: DbShipment) -> Shipment {
        Shipment(
            id: s.id,
            homeownerId: s.homeownerId,
            homeownerName: s.homeownerName,
            partnerId: s.partnerId,
            partnerName: s.partnerName,
            status: parseShipmentStatus(s.status),
            carrier: parseCarrier(s.carrier),
            packagesExpected: s.packagesExpected,
            deliveryWindowStart: parseISO(s.deliveryWindowStart),
            deliveryWindowEnd: parseISO(s.deliveryWindowEnd),
            addressText: s.addressText ?? "",
            homeLocationVisibleToPartner: s.homeLocationVisibleToPartner ?? false,
            notes: s.notes ?? "",
            preferredReturnTime: s.preferredReturnTime ?? "Anytime",
            trackingNumber: s.trackingNumber,
            deliveryStatus: parseDeliveryStatus(s.deliveryStatus),
            completionPhotoUrl: s.completionPhotoUrl,
            createdAt: parseISO(s.createdAt),
            updatedAt: parseISO(s.updatedAt)
        )
    }

    static func toNotification(_ n: DbNotification) -> DeliveryNotification {
        DeliveryNotification(
            id: n.id,
            shipmentId: n.shipmentId,
            type: parseNotificationType(n.type),
            title: n.title,
            message: n.message,
            read: n.read,
            createdAt: parseISO(n.createdAt)
        )
    }

    static func toDirectoryEntry(_ r: DbDirectoryRow) -> DirectoryEntry {
        DirectoryEntry(
            id: r.id,
            name: r.name ?? "",
            role: parseUserRole(r.role),
            address: r.address ?? "",
            avatarUrl: r.avatarUrl,
            isPremium: r.isPremium ?? false
        )
    }

    static func toChatMessage(_ m: DbChatMessage, currentUserId: String) -> ChatMessage {
        ChatMessage(
            id: m.id,
            senderId: m.senderId,
            senderName: m.senderName ?? "",
            senderAvatarUrl: m.senderAvatarUrl,
            body: m.body ?? "",
            createdAt: parseISO(m.createdAt),
            isMine: m.senderId == currentUserId
        )
    }
}
