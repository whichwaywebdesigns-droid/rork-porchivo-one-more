//
//  MockData.swift
//  Porchivo
//
//  Seed data mirroring expo/mocks and android MockData.kt — used when the
//  backend isn't configured so the UI is still explorable in previews/simulator.
//

import Foundation

enum MockData {
    private static let HOUR: TimeInterval = 3600
    private static var now: Date { Date() }

    static let currentUserID = "user-1"

    static let user = User(
        id: currentUserID,
        name: "Sarah Mitchell",
        phone: "(555) 012-3456",
        email: "sarah@porchivo.com",
        role: .both,
        address: "742 Maple Street",
        avatarUrl: nil,
        hasLocationConsent: false,
        hasPreciseLocationConsent: false,
        isPremium: false,
        subscriptionTier: .free,
        isOnboarded: true
    )

    static let shipments: [Shipment] = {
        let n = now
        return [
            Shipment(id: "1", homeownerId: "user-1", homeownerName: "Sarah M.",
                     partnerId: nil, partnerName: nil, status: .open, carrier: .amazon,
                     packagesExpected: "2 boxes, one medium, one small",
                     deliveryWindowStart: n.addingTimeInterval(2 * HOUR),
                     deliveryWindowEnd: n.addingTimeInterval(6 * HOUR),
                     addressText: "742 Maple Street",
                     homeLocationVisibleToPartner: false,
                     notes: "Please leave behind the planter by the front door",
                     preferredReturnTime: "After 6 PM",
                     trackingNumber: nil,
                     deliveryStatus: .inTransit,
                     createdAt: n.addingTimeInterval(-2 * HOUR),
                     updatedAt: n.addingTimeInterval(-HOUR)),
            Shipment(id: "2", homeownerId: "user-1", homeownerName: "Sarah M.",
                     partnerId: "user-2", partnerName: "James K.", status: .accepted,
                     carrier: .ups, packagesExpected: "1 large box",
                     deliveryWindowStart: n.addingTimeInterval(-2 * HOUR),
                     deliveryWindowEnd: n.addingTimeInterval(2 * HOUR),
                     addressText: "742 Maple Street",
                     homeLocationVisibleToPartner: true,
                     notes: "Fragile electronics - handle with care",
                     preferredReturnTime: "Before 8 PM",
                     trackingNumber: "1Z999AA10123456784",
                     deliveryStatus: .outForDelivery,
                     createdAt: n.addingTimeInterval(-24 * HOUR),
                     updatedAt: n.addingTimeInterval(-2 * HOUR)),
            Shipment(id: "3", homeownerId: "user-3", homeownerName: "Linda R.",
                     partnerId: "user-1", partnerName: "Sarah M.", status: .completed,
                     carrier: .fedex, packagesExpected: "3 packages",
                     deliveryWindowStart: n.addingTimeInterval(-48 * HOUR),
                     deliveryWindowEnd: n.addingTimeInterval(-44 * HOUR),
                     addressText: "88 Oak Avenue",
                     homeLocationVisibleToPartner: true,
                     notes: "",
                     preferredReturnTime: "Evening",
                     trackingNumber: "794644790132",
                     deliveryStatus: .deliveredToHomeowner,
                     completionPhotoUrl: "https://images.unsplash.com/photo-1586768359841-59e5c6c0a5b0?w=600",
                     createdAt: n.addingTimeInterval(-72 * HOUR),
                     updatedAt: n.addingTimeInterval(-44 * HOUR)),
        ]
    }()

    static let trackedPackages: [TrackedPackage] = {
        let n = now
        return [
            TrackedPackage(id: "pkg-1", name: "Running Shoes", carrier: .amazon,
                           trackingNumber: "TBA309912345678",
                           expectedDeliveryDate: n.addingTimeInterval(4 * HOUR),
                           currentStatus: .outForDelivery,
                           addressNickname: .home,
                           notesForPartner: "Leave behind the planter",
                           statusHistory: [
                               PackageStatusEvent(status: .ordered, timestamp: n.addingTimeInterval(-72 * HOUR), completed: true),
                               PackageStatusEvent(status: .shipped, timestamp: n.addingTimeInterval(-30 * HOUR), completed: true),
                               PackageStatusEvent(status: .outForDelivery, timestamp: n.addingTimeInterval(-3 * HOUR), completed: true),
                               PackageStatusEvent(status: .delivered, timestamp: nil, completed: false),
                           ],
                           createdAt: n.addingTimeInterval(-72 * HOUR)),
            TrackedPackage(id: "pkg-2", name: "Bluetooth Headphones", carrier: .ups,
                           trackingNumber: "1Z999AA10123456784",
                           expectedDeliveryDate: n.addingTimeInterval(26 * HOUR),
                           currentStatus: .shipped,
                           addressNickname: .home,
                           statusHistory: [
                               PackageStatusEvent(status: .ordered, timestamp: n.addingTimeInterval(-50 * HOUR), completed: true),
                               PackageStatusEvent(status: .shipped, timestamp: n.addingTimeInterval(-20 * HOUR), completed: true),
                               PackageStatusEvent(status: .outForDelivery, timestamp: nil, completed: false),
                               PackageStatusEvent(status: .delivered, timestamp: nil, completed: false),
                           ],
                           createdAt: n.addingTimeInterval(-50 * HOUR)),
        ]
    }()

    static let notifications: [DeliveryNotification] = {
        let n = now
        return [
            DeliveryNotification(id: "notif-1", shipmentId: "2", type: .packageOutForDelivery,
                                 title: "Out for delivery",
                                 message: "Your UPS package is out for delivery. James K. is on standby.",
                                 read: false, createdAt: n.addingTimeInterval(-HOUR)),
            DeliveryNotification(id: "notif-2", shipmentId: "2", type: .trackingAdded,
                                 title: "Tracking added",
                                 message: "Tracking #1Z999AA10123456784 linked to your shipment.",
                                 read: false, createdAt: n.addingTimeInterval(-12 * HOUR)),
            DeliveryNotification(id: "notif-3", shipmentId: "3", type: .partnerCompleted,
                                 title: "Hold completed",
                                 message: "You returned 3 packages to Linda R. Nice work!",
                                 read: true, createdAt: n.addingTimeInterval(-44 * HOUR)),
        ]
    }()

    static let theftFacts: [String] = [
        "119 million packages were stolen in the US last year — 1 in 5 households hit.",
        "Most porch thefts happen between 10 AM and 3 PM, while residents are at work.",
        "Packages left over 2 hours are 3× more likely to be stolen.",
        "A visible neighbor pickup reduces theft risk by up to 90%.",
        "Thieves follow delivery trucks — the first 30 minutes matter most.",
    ]

    static var theftFactOfDay: String {
        let day = Calendar.current.ordinality(of: .day, in: .year, for: Date()) ?? 1
        return theftFacts[(day - 1) % theftFacts.count]
    }
}
