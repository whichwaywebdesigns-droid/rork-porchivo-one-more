package com.rork.porchivo.data

import android.content.Context

/**
 * Singleton holder for AppRepository — initialized once in Application/ApplicationActivity.
 *
 * The repository needs a Context for EncryptedSharedPreferences and SharedPreferences,
 * but ViewModels access it via [get] without any context dependency.
 */
object AppRepositoryHolder {

    @Volatile
    private var instance: AppRepository? = null

    fun init(context: Context) {
        if (instance == null) {
            synchronized(this) {
                if (instance == null) {
                    instance = AppRepository(context.applicationContext)
                }
            }
        }
    }

    fun get(): AppRepository = instance ?: throw IllegalStateException(
        "AppRepositoryHolder not initialized. Call init(context) in Application.onCreate()."
    )
}
