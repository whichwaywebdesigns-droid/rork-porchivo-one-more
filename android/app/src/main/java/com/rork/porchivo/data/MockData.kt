package com.rork.porchivo.data

import com.rork.porchivo.model.AddressNickname
import com.rork.porchivo.model.Carrier
import com.rork.porchivo.model.DeliveryNotification
import com.rork.porchivo.model.DeliveryStatus
import com.rork.porchivo.model.NotificationType
import com.rork.porchivo.model.PackageStatusEvent
import com.rork.porchivo.model.PackageTrackingStatus
import com.rork.porchivo.model.Shipment
import com.rork.porchivo.model.ShipmentStatus
import com.rork.porchivo.model.TrackedPackage
import com.rork.porchivo.model.User
import com.rork.porchivo.model.UserRole

/** Seed data mirroring expo/mocks/shipments.ts and the demo user. */
object MockData {

    private const val HOUR = 3_600_000L
    private val now = System.currentTimeMillis()

    const val CURRENT_USER_ID = "user-1"

    val user = User(
        id = CURRENT_USER_ID,
        name = "Sarah Mitchell",
        phone = "(555) 012-3456",
        email = "sarah@porchivo.com",
        role = UserRole.BOTH,
        address = "742 Maple Street",
        hasLocationConsent = false,
        isOnboarded = true,
    )

    val shipments: List<Shipment> = listOf(
        Shipment(
            id = "1",
            homeownerId = "user-1",
            homeownerName = "Sarah M.",
            status = ShipmentStatus.OPEN,
            carrier = Carrier.AMAZON,
            packagesExpected = "2 boxes, one medium, one small",
            deliveryWindowStart = now + 2 * HOUR,
            deliveryWindowEnd = now + 6 * HOUR,
            addressText = "742 Maple Street",
            notes = "Please leave behind the planter by the front door",
            preferredReturnTime = "After 6 PM",
            deliveryStatus = DeliveryStatus.IN_TRANSIT,
            createdAt = now - 2 * HOUR,
            updatedAt = now - HOUR,
        ),
        Shipment(
            id = "2",
            homeownerId = "user-1",
            homeownerName = "Sarah M.",
            partnerId = "user-2",
            partnerName = "James K.",
            status = ShipmentStatus.ACCEPTED,
            carrier = Carrier.UPS,
            packagesExpected = "1 large box",
            deliveryWindowStart = now - 2 * HOUR,
            deliveryWindowEnd = now + 2 * HOUR,
            addressText = "742 Maple Street",
            homeLocationVisibleToPartner = true,
            notes = "Fragile electronics - handle with care",
            preferredReturnTime = "Before 8 PM",
            trackingNumber = "1Z999AA10123456784",
            deliveryStatus = DeliveryStatus.OUT_FOR_DELIVERY,
            createdAt = now - 24 * HOUR,
            updatedAt = now - 2 * HOUR,
        ),
        Shipment(
            id = "3",
            homeownerId = "user-3",
            homeownerName = "Linda R.",
            partnerId = "user-1",
            partnerName = "Sarah M.",
            status = ShipmentStatus.COMPLETED,
            carrier = Carrier.FEDEX,
            packagesExpected = "3 packages",
            deliveryWindowStart = now - 48 * HOUR,
            deliveryWindowEnd = now - 44 * HOUR,
            addressText = "88 Oak Avenue",
            homeLocationVisibleToPartner = true,
            preferredReturnTime = "Evening",
            trackingNumber = "794644790132",
            deliveryStatus = DeliveryStatus.DELIVERED_TO_HOMEOWNER,
            createdAt = now - 72 * HOUR,
            updatedAt = now - 44 * HOUR,
        ),
        Shipment(
            id = "4",
            homeownerId = "user-4",
            homeownerName = "Tom W.",
            status = ShipmentStatus.OPEN,
            carrier = Carrier.USPS,
            packagesExpected = "1 small envelope",
            deliveryWindowStart = now + HOUR,
            deliveryWindowEnd = now + 5 * HOUR,
            addressText = "205 Birch Lane",
            notes = "Ring doorbell when picking up",
            preferredReturnTime = "Anytime after 5 PM",
            deliveryStatus = DeliveryStatus.PENDING,
            createdAt = now - HOUR,
            updatedAt = now - HOUR / 2,
        ),
        Shipment(
            id = "5",
            homeownerId = "user-5",
            homeownerName = "Maria G.",
            status = ShipmentStatus.OPEN,
            carrier = Carrier.AMAZON,
            packagesExpected = "4 boxes",
            deliveryWindowStart = now - 4 * HOUR,
            deliveryWindowEnd = now + HOUR,
            addressText = "1020 Elm Drive",
            notes = "Will be at work all day, please hold until evening",
            preferredReturnTime = "After 7 PM",
            deliveryStatus = DeliveryStatus.IN_TRANSIT,
            createdAt = now - 2 * HOUR,
            updatedAt = now - HOUR,
        ),
    )

    val trackedPackages: List<TrackedPackage> = listOf(
        TrackedPackage(
            id = "pkg-1",
            name = "Running Shoes",
            carrier = Carrier.AMAZON,
            trackingNumber = "TBA309912345678",
            expectedDeliveryDate = now + 4 * HOUR,
            currentStatus = PackageTrackingStatus.OUT_FOR_DELIVERY,
            addressNickname = AddressNickname.HOME,
            notesForPartner = "Leave behind the planter",
            statusHistory = listOf(
                PackageStatusEvent(PackageTrackingStatus.ORDERED, now - 72 * HOUR, true),
                PackageStatusEvent(PackageTrackingStatus.SHIPPED, now - 30 * HOUR, true),
                PackageStatusEvent(PackageTrackingStatus.OUT_FOR_DELIVERY, now - 3 * HOUR, true),
                PackageStatusEvent(PackageTrackingStatus.DELIVERED, null, false),
            ),
            createdAt = now - 72 * HOUR,
        ),
        TrackedPackage(
            id = "pkg-2",
            name = "Bluetooth Headphones",
            carrier = Carrier.UPS,
            trackingNumber = "1Z999AA10123456784",
            expectedDeliveryDate = now + 26 * HOUR,
            currentStatus = PackageTrackingStatus.SHIPPED,
            addressNickname = AddressNickname.HOME,
            statusHistory = listOf(
                PackageStatusEvent(PackageTrackingStatus.ORDERED, now - 50 * HOUR, true),
                PackageStatusEvent(PackageTrackingStatus.SHIPPED, now - 20 * HOUR, true),
                PackageStatusEvent(PackageTrackingStatus.OUT_FOR_DELIVERY, null, false),
                PackageStatusEvent(PackageTrackingStatus.DELIVERED, null, false),
            ),
            createdAt = now - 50 * HOUR,
        ),
        TrackedPackage(
            id = "pkg-3",
            name = "Birthday Gift for Mom",
            carrier = Carrier.FEDEX,
            trackingNumber = "794644790132",
            expectedDeliveryDate = now - 20 * HOUR,
            currentStatus = PackageTrackingStatus.DELIVERED,
            addressNickname = AddressNickname.WORK,
            statusHistory = listOf(
                PackageStatusEvent(PackageTrackingStatus.ORDERED, now - 96 * HOUR, true),
                PackageStatusEvent(PackageTrackingStatus.SHIPPED, now - 60 * HOUR, true),
                PackageStatusEvent(PackageTrackingStatus.OUT_FOR_DELIVERY, now - 26 * HOUR, true),
                PackageStatusEvent(PackageTrackingStatus.DELIVERED, now - 20 * HOUR, true),
            ),
            createdAt = now - 96 * HOUR,
        ),
    )

    val notifications: List<DeliveryNotification> = listOf(
        DeliveryNotification(
            id = "notif-1",
            shipmentId = "2",
            type = NotificationType.PACKAGE_OUT_FOR_DELIVERY,
            title = "Out for delivery",
            message = "Your UPS package is out for delivery. James K. is on standby.",
            read = false,
            createdAt = now - HOUR,
        ),
        DeliveryNotification(
            id = "notif-2",
            shipmentId = "2",
            type = NotificationType.TRACKING_ADDED,
            title = "Tracking added",
            message = "Tracking #1Z999AA10123456784 linked to your shipment.",
            read = false,
            createdAt = now - 12 * HOUR,
        ),
        DeliveryNotification(
            id = "notif-3",
            shipmentId = "3",
            type = NotificationType.PARTNER_COMPLETED,
            title = "Hold completed",
            message = "You returned 3 packages to Linda R. Nice work!",
            read = true,
            createdAt = now - 44 * HOUR,
        ),
    )

    val theftFacts: List<String> = listOf(
        "119 million packages were stolen in the US last year — 1 in 5 households hit.",
        "Most porch thefts happen between 10 AM and 3 PM, while residents are at work.",
        "Packages left over 2 hours are 3× more likely to be stolen.",
        "A visible neighbor pickup reduces theft risk by up to 90%.",
        "Thieves follow delivery trucks — the first 30 minutes matter most.",
    )
}
