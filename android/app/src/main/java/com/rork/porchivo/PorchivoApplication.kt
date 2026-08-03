package com.rork.porchivo

import android.app.Application
import com.rork.porchivo.data.AppRepositoryHolder

/**
 * Application entry point — initializes the AppRepository singleton
 * with application context for EncryptedSharedPreferences.
 */
class PorchivoApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        AppRepositoryHolder.init(this)
    }
}
