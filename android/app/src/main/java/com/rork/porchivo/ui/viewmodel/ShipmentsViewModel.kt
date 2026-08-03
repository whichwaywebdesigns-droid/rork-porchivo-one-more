package com.rork.porchivo.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.rork.porchivo.data.AppRepositoryHolder
import com.rork.porchivo.data.AuthState
import com.rork.porchivo.data.LoadState
import com.rork.porchivo.model.Shipment
import com.rork.porchivo.model.ShipmentStatus
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/**
 * Mirrors ShipmentsContext from the Expo app.
 * Fetches shipments from Supabase `shipments` table via AppRepository.
 */
class ShipmentsViewModel : ViewModel() {

    private val repo = AppRepositoryHolder.get()

    val shipments: StateFlow<List<Shipment>> = repo.shipments
    val shipmentsLoadState: StateFlow<LoadState<Unit>> = repo.shipmentsLoadState

    /** Shipments the current user posted as homeowner. */
    val myShipments: StateFlow<List<Shipment>> = shipments
        .map { list -> list.filter { it.homeownerId == currentUserId() } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    /** Active shipments where the user is either homeowner or the assigned partner. */
    val activeShipments: StateFlow<List<Shipment>> = shipments
        .map { list ->
            list.filter {
                (it.homeownerId == currentUserId() || it.partnerId == currentUserId()) &&
                    (it.status == ShipmentStatus.OPEN || it.status == ShipmentStatus.ACCEPTED)
            }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val completedShipments: StateFlow<List<Shipment>> = shipments
        .map { list ->
            list.filter {
                (it.homeownerId == currentUserId() || it.partnerId == currentUserId()) &&
                    it.status == ShipmentStatus.COMPLETED
            }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    private fun currentUserId(): String =
        (repo.authState.value as? AuthState.Authenticated)?.userId ?: ""

    fun shipmentById(id: String): Shipment? = shipments.value.firstOrNull { it.id == id }

    fun addShipment(
        carrier: com.rork.porchivo.model.Carrier,
        packagesExpected: String,
        trackingNumber: String?,
        notes: String,
        preferredReturnTime: String,
        homeLocationVisibleToPartner: Boolean,
    ) {
        viewModelScope.launch {
            repo.addShipment(
                carrier = carrier,
                packagesExpected = packagesExpected,
                trackingNumber = trackingNumber,
                notes = notes,
                preferredReturnTime = preferredReturnTime,
                homeLocationVisibleToPartner = homeLocationVisibleToPartner,
            )
        }
    }

    fun completeShipment(id: String) {
        viewModelScope.launch { repo.completeShipment(id) }
    }

    fun acceptShipment(id: String) {
        viewModelScope.launch { repo.acceptShipment(id) }
    }

    fun refresh() {
        val userId = currentUserId()
        if (userId.isNotBlank()) {
            viewModelScope.launch { repo.loadShipments(userId) }
        }
    }
}
