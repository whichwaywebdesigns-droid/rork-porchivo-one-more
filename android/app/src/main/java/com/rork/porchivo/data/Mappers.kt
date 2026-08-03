package com.rork.porchivo.data

import com.rork.porchivo.data.dto.DbNotification
import com.rork.porchivo.data.dto.DbProfile
import com.rork.porchivo.data.dto.DbShipment
import com.rork.porchivo.model.Carrier
import com.rork.porchivo.model.DeliveryNotification
import com.rork.porchivo.model.DeliveryStatus
import com.rork.porchivo.model.NotificationType
import com.rork.porchivo.model.Shipment
import com.rork.porchivo.model.ShipmentStatus
import com.rork.porchivo.model.User
import com.rork.porchivo.model.UserRole
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * DTO → domain model mappers — mirrors expo/lib/mappers.ts.
 */
object Mappers {

    private val isoParser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }
    private val isoParserNoMillis = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }

    /** Parse an ISO-8601 timestamp to epoch millis. Returns 0L on failure. */
    fun parseIsoToMillis(iso: String?): Long {
        if (iso.isNullOrBlank()) return 0L
        return try {
            isoParser.parse(iso)?.time ?: isoParserNoMillis.parse(iso)?.time ?: 0L
        } catch (e: Exception) {
            try { isoParserNoMillis.parse(iso)?.time ?: 0L } catch (e2: Exception) { 0L }
        }
    }

    /** Format epoch millis to ISO-8601 for DB inserts. */
    fun millisToIso(millis: Long): String {
        return isoParser.format(Date(millis))
    }

    fun dbProfileToUser(p: DbProfile): User = User(
        id = p.id,
        name = p.name,
        phone = p.phone,
        email = p.email,
        role = parseUserRole(p.role),
        address = p.address,
        hasLocationConsent = p.hasLocationConsent,
        isOnboarded = p.isOnboarded,
    )

    fun dbShipmentToShipment(s: DbShipment): Shipment = Shipment(
        id = s.id,
        homeownerId = s.homeownerId,
        homeownerName = s.homeownerName,
        partnerId = s.partnerId,
        partnerName = s.partnerName,
        status = parseShipmentStatus(s.status),
        carrier = parseCarrier(s.carrier),
        packagesExpected = s.packagesExpected,
        deliveryWindowStart = parseIsoToMillis(s.deliveryWindowStart),
        deliveryWindowEnd = parseIsoToMillis(s.deliveryWindowEnd),
        addressText = s.addressText,
        homeLocationVisibleToPartner = s.homeLocationVisibleToPartner,
        notes = s.notes,
        preferredReturnTime = s.preferredReturnTime,
        trackingNumber = s.trackingNumber,
        deliveryStatus = parseDeliveryStatus(s.deliveryStatus),
        createdAt = parseIsoToMillis(s.createdAt),
        updatedAt = parseIsoToMillis(s.updatedAt),
    )

    fun dbNotificationToNotification(n: DbNotification): DeliveryNotification = DeliveryNotification(
        id = n.id,
        shipmentId = n.shipmentId,
        type = parseNotificationType(n.type),
        title = n.title,
        message = n.message,
        read = n.read,
        createdAt = parseIsoToMillis(n.createdAt),
    )

    // ── Enum parsers (DB stores lowercase strings) ─────────────────────

    fun parseUserRole(role: String): UserRole = when (role.lowercase()) {
        "homeowner" -> UserRole.HOMEOWNER
        "partner" -> UserRole.PARTNER
        "both" -> UserRole.BOTH
        else -> UserRole.HOMEOWNER
    }

    fun parseShipmentStatus(status: String): ShipmentStatus = when (status.lowercase()) {
        "open" -> ShipmentStatus.OPEN
        "accepted" -> ShipmentStatus.ACCEPTED
        "completed" -> ShipmentStatus.COMPLETED
        "cancelled" -> ShipmentStatus.CANCELLED
        else -> ShipmentStatus.OPEN
    }

    fun parseCarrier(carrier: String): Carrier = when (carrier.lowercase()) {
        "amazon" -> Carrier.AMAZON
        "ups" -> Carrier.UPS
        "usps" -> Carrier.USPS
        "fedex" -> Carrier.FEDEX
        else -> Carrier.OTHER
    }

    fun parseDeliveryStatus(status: String): DeliveryStatus = when (status.lowercase()) {
        "pending" -> DeliveryStatus.PENDING
        "in_transit" -> DeliveryStatus.IN_TRANSIT
        "out_for_delivery" -> DeliveryStatus.OUT_FOR_DELIVERY
        "delivered" -> DeliveryStatus.DELIVERED
        "delivered_to_homeowner" -> DeliveryStatus.DELIVERED_TO_HOMEOWNER
        else -> DeliveryStatus.PENDING
    }

    fun parseNotificationType(type: String): NotificationType = when (type.lowercase()) {
        "tracking_added" -> NotificationType.TRACKING_ADDED
        "package_delivered" -> NotificationType.PACKAGE_DELIVERED
        "partner_pickup_alert" -> NotificationType.PARTNER_PICKUP_ALERT
        "partner_completed" -> NotificationType.PARTNER_COMPLETED
        "package_out_for_delivery" -> NotificationType.PACKAGE_OUT_FOR_DELIVERY
        "package_picked_up" -> NotificationType.PACKAGE_PICKED_UP
        else -> NotificationType.PACKAGE_DELIVERED
    }
}
