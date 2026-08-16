package com.rork.porchivo.data.dto

import kotlinx.serialization.Serializable

/**
 * Announcement row from `org_announcements` table (direct REST read, RLS-gated).
 */
@Serializable
data class DbAnnouncement(
    val id: String = "",
    val orgId: String? = null,
    val authorId: String? = null,
    val authorDisplayName: String? = null,
    val title: String = "",
    val body: String = "",
    val priority: String? = null,
    val category: String? = null,
    val isPinned: Boolean? = null,
    val expiresAt: String? = null,
    val scheduledAt: String? = null,
    val viewCount: Int? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null,
)

/**
 * Row returned by `get_my_maintenance_requests` RPC (resident-facing, fewer fields).
 */
@Serializable
data class DbMyMaintenanceRequest(
    val id: String = "",
    val category: String? = null,
    val priority: String? = null,
    val status: String? = null,
    val title: String? = null,
    val description: String? = null,
    val locationDetail: String? = null,
    val residentVisibleNote: String? = null,
    val resolutionCode: String? = null,
    val scheduledFor: String? = null,
    val completedAt: String? = null,
    val commentCount: Int? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null,
)
