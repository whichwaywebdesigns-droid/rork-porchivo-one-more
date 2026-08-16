package com.rork.porchivo.model

/**
 * Announcement domain model — mirrors `org_announcements` table.
 */
data class Announcement(
    val id: String,
    val orgId: String,
    val authorId: String?,
    val authorDisplayName: String?,
    val title: String,
    val body: String,
    val priority: AnnouncementPriority,
    val category: String,
    val isPinned: Boolean,
    val viewCount: Int,
    val createdAt: Long,
)

enum class AnnouncementPriority(val label: String) {
    LOW("Low"), NORMAL("Normal"), HIGH("High"), URGENT("Urgent");

    companion object {
        fun from(raw: String?): AnnouncementPriority = when (raw?.lowercase()) {
            "low" -> LOW
            "high" -> HIGH
            "urgent" -> URGENT
            else -> NORMAL
        }
    }
}

/**
 * Maintenance request domain model — mirrors `get_my_maintenance_requests` RPC output.
 */
data class MaintenanceRequest(
    val id: String,
    val category: MaintenanceCategory,
    val priority: MaintenancePriority,
    val status: MaintenanceStatus,
    val title: String,
    val description: String?,
    val locationDetail: String?,
    val residentVisibleNote: String?,
    val scheduledFor: Long?,
    val completedAt: Long?,
    val commentCount: Int,
    val createdAt: Long,
    val updatedAt: Long,
)

enum class MaintenanceCategory(val label: String) {
    PLUMBING("Plumbing"),
    ELECTRICAL("Electrical"),
    HVAC("HVAC"),
    STRUCTURAL("Structural"),
    PEST_CONTROL("Pest Control"),
    LANDSCAPING("Landscaping"),
    COMMON_AREA("Common Area"),
    APPLIANCE("Appliance"),
    SECURITY("Security"),
    PARKING("Parking"),
    ELEVATOR("Elevator"),
    AMENITY("Amenity"),
    OTHER("Other");

    companion object {
        fun from(raw: String?): MaintenanceCategory = when (raw?.lowercase()?.replace("-", "_")) {
            "plumbing" -> PLUMBING
            "electrical" -> ELECTRICAL
            "hvac" -> HVAC
            "structural" -> STRUCTURAL
            "pest_control" -> PEST_CONTROL
            "landscaping" -> LANDSCAPING
            "common_area" -> COMMON_AREA
            "appliance" -> APPLIANCE
            "security" -> SECURITY
            "parking" -> PARKING
            "elevator" -> ELEVATOR
            "amenity" -> AMENITY
            else -> OTHER
        }
    }
}

enum class MaintenancePriority(val label: String) {
    LOW("Low"), NORMAL("Normal"), HIGH("High"), EMERGENCY("Emergency");

    companion object {
        fun from(raw: String?): MaintenancePriority = when (raw?.lowercase()) {
            "low" -> LOW
            "high" -> HIGH
            "emergency" -> EMERGENCY
            else -> NORMAL
        }
    }
}

enum class MaintenanceStatus(val label: String) {
    SUBMITTED("Submitted"),
    ACKNOWLEDGED("Acknowledged"),
    SCHEDULED("Scheduled"),
    IN_PROGRESS("In Progress"),
    ON_HOLD("On Hold"),
    COMPLETED("Completed"),
    CANCELLED("Cancelled");

    val isActive: Boolean get() = this != COMPLETED && this != CANCELLED

    companion object {
        fun from(raw: String?): MaintenanceStatus = when (raw?.lowercase()?.replace("-", "_")) {
            "submitted" -> SUBMITTED
            "acknowledged" -> ACKNOWLEDGED
            "scheduled" -> SCHEDULED
            "in_progress" -> IN_PROGRESS
            "on_hold" -> ON_HOLD
            "completed" -> COMPLETED
            "cancelled" -> CANCELLED
            else -> SUBMITTED
        }
    }
}
