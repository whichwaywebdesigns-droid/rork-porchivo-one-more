package com.rork.porchivo

import android.app.Application
import com.rork.porchivo.data.AppRepositoryHolder
import com.rork.porchivo.data.RevenueCatService

/**
 * Application entry point — initializes the AppRepository singleton
 * with application context for EncryptedSharedPreferences, and
 * configures RevenueCat for real IAP.
 */
class PorchivoApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        AppRepositoryHolder.init(this)
        RevenueCatService.configure(this)
    }
}
