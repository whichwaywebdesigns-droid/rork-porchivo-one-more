package com.rork.porchivo.model

/** Mirrors the User type from expo/types/index.ts. */
data class User(
    val id: String,
    val name: String,
    val phone: String,
    val email: String,
    val role: UserRole,
    val address: String,
    val hasLocationConsent: Boolean = false,
    val isOnboarded: Boolean = false,
)
