package com.rork.porchivo.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.rork.porchivo.data.AppRepositoryHolder
import com.rork.porchivo.model.DeliveryNotification
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/**
 * Mirrors NotificationsContext from the Expo app.
 * Fetches notifications from Supabase `notifications` table via AppRepository.
 */
class NotificationsViewModel : ViewModel() {

    private val repo = AppRepositoryHolder.get()

    val notifications: StateFlow<List<DeliveryNotification>> = repo.notifications

    val unreadCount: StateFlow<Int> = notifications
        .map { list -> list.count { !it.read } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0)

    fun markRead(id: String) {
        viewModelScope.launch { repo.markNotificationRead(id) }
    }

    fun markAllRead() {
        viewModelScope.launch { repo.markAllNotificationsRead() }
    }
}
