package com.rork.porchivo.data

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Realtime network connectivity monitor using [ConnectivityManager.registerDefaultNetworkCallback].
 *
 * Exposes a [StateFlow] that updates immediately when the device gains or loses
 * internet access. Requires the ACCESS_NETWORK_STATE permission.
 */
class NetworkMonitor(context: Context) {

    private val connectivityManager =
        context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    private val _isOnline = MutableStateFlow(true)
    val isOnline: StateFlow<Boolean> = _isOnline.asStateFlow()

    private val callback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            _isOnline.value = true
        }

        override fun onLost(network: Network) {
            _isOnline.value = false
        }

        override fun onUnavailable() {
            _isOnline.value = false
        }
    }

    /** Begin listening for network changes. Call from [AppRepository] init. */
    fun start() {
        try {
            connectivityManager.registerDefaultNetworkCallback(callback)
        } catch (e: Exception) {
            // If the callback can't be registered (e.g. no connectivity service),
            // default to "online" so the app still tries to make requests.
        }
    }

    /** Stop listening. Call when the repository is being torn down. */
    fun stop() {
        try {
            connectivityManager.unregisterNetworkCallback(callback)
        } catch (e: Exception) {
            // Ignore — callback might not be registered.
        }
    }
}
