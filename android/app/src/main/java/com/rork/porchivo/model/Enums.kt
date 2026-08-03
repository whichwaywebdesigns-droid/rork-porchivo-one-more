package com.rork.porchivo.model

import kotlinx.serialization.Serializable

/** Mirrors expo/types/index.ts enums. */

@Serializable
enum class Carrier(val label: String) {
    AMAZON("Amazon"),
    UPS("UPS"),
    USPS("USPS"),
    FEDEX("FedEx"),
    OTHER("Other"),
}

@Serializable
enum class ShipmentStatus {
    OPEN, ACCEPTED, COMPLETED, CANCELLED
}

@Serializable
enum class DeliveryStatus(val label: String) {
    PENDING("Pending"),
    IN_TRANSIT("In Transit"),
    OUT_FOR_DELIVERY("Out for Delivery"),
    DELIVERED("Delivered"),
    DELIVERED_TO_HOMEOWNER("Delivered"),
}

@Serializable
enum class PackageTrackingStatus(val label: String) {
    ORDERED("Ordered"),
    SHIPPED("Shipped"),
    OUT_FOR_DELIVERY("Out for Delivery"),
    DELIVERED("Delivered"),
    PICKED_UP("Picked Up"),
    RETURNED("Returned"),
}

@Serializable
enum class UserRole(val label: String) {
    HOMEOWNER("Homeowner"),
    PARTNER("Porch Partner"),
    BOTH("Homeowner & Partner"),
}

@Serializable
enum class SubscriptionTier(val label: String) {
    FREE("Free Plan"),
    PREMIUM("Premium"),
    FAMILY("Family Plan"),
    LIFETIME("Lifetime"),
}

@Serializable
enum class NotificationType {
    TRACKING_ADDED,
    PACKAGE_DELIVERED,
    PARTNER_PICKUP_ALERT,
    PARTNER_COMPLETED,
    PACKAGE_OUT_FOR_DELIVERY,
    PACKAGE_PICKED_UP,
}

@Serializable
enum class AddressNickname(val label: String) {
    HOME("Home"),
    WORK("Work"),
    OTHER("Other"),
}
