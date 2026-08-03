package com.rork.porchivo.ui.viewmodel

import androidx.lifecycle.ViewModel
import com.rork.porchivo.data.AppRepositoryHolder
import com.rork.porchivo.model.TrackedPackage
import kotlinx.coroutines.flow.StateFlow

/**
 * Mirrors PackagesContext from the Expo app, including the free-tier package limit.
 * Tracked packages are stored locally (SharedPreferences) — no DB table exists,
 * matching the Expo app's AsyncStorage behavior.
 */
class PackagesViewModel : ViewModel() {

    private val repo = AppRepositoryHolder.get()

    val packages: StateFlow<List<TrackedPackage>> = repo.packages

    fun packageById(id: String): TrackedPackage? = packages.value.firstOrNull { it.id == id }

    fun canAddPackage(): Boolean = repo.canAddPackage()

    fun addPackage(pkg: TrackedPackage) = repo.addPackage(pkg)

    fun deletePackage(id: String) = repo.deletePackage(id)
}
