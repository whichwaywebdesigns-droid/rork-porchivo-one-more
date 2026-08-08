package com.rork.porchivo.data

import android.app.Activity
import android.content.Context
import com.revenuecat.purchases.CustomerInfo
import com.revenuecat.purchases.Offerings
import com.revenuecat.purchases.Package
import com.revenuecat.purchases.Purchases
import com.revenuecat.purchases.PurchasesConfiguration
import com.revenuecat.purchases.PurchaseParams
import com.revenuecat.purchases.PurchasesError
import com.revenuecat.purchases.PurchasesErrorCode
import com.revenuecat.purchases.getOfferingsWith
import com.revenuecat.purchases.purchaseWith
import com.revenuecat.purchases.restorePurchasesWith
import com.revenuecat.purchases.models.StoreTransaction
import com.rork.porchivo.BuildConfig
import com.rork.porchivo.config.AppConfig
import com.rork.porchivo.model.SubscriptionTier
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

/**
 * Wraps the RevenueCat SDK for real IAP on Android — fetches offerings,
 * processes purchases and restores, and maps entitlements to SubscriptionTier.
 *
 * Call [configure] once from [PorchivoApplication.onCreate]. In demo mode
 * (empty API key) this is a no-op and all operations return failure.
 */
object RevenueCatService {

    private var isConfigured = false

    /** Plan types matching the UpgradeScreen picker. */
    enum class Plan(val productId: String) {
        MONTHLY(AppConfig.Pricing.MONTHLY_PRODUCT_ID),
        ANNUAL(AppConfig.Pricing.ANNUAL_PRODUCT_ID),
        FAMILY(AppConfig.FamilyPlan.ANNUAL_PRODUCT_ID),
        LIFETIME(AppConfig.Pricing.LIFETIME_PRODUCT_ID),
    }

    data class PurchaseResult(val tier: SubscriptionTier?, val error: String? = null)

    data class RestoreResult(val tier: SubscriptionTier?, val error: String? = null)

    /** Configures RevenueCat. No-op if the API key is empty (demo mode). */
    fun configure(context: Context) {
        if (isConfigured) return
        val apiKey = BuildConfig.REVENUECAT_ANDROID_API_KEY
        if (apiKey.isBlank()) return
        Purchases.configure(PurchasesConfiguration.Builder(context, apiKey).build())
        isConfigured = true
    }

    /** Fetches offerings via callback-based API wrapped in a coroutine. */
    private suspend fun fetchOfferings(): Result<Offerings> =
        suspendCancellableCoroutine { cont ->
            Purchases.sharedInstance.getOfferingsWith(
                onError = { error -> cont.resume(Result.failure(Exception(error.message))) },
                onSuccess = { offerings -> cont.resume(Result.success(offerings)) },
            )
        }

    /** Purchases the given plan via RevenueCat. Returns tier on success. */
    suspend fun purchase(activity: Activity, plan: Plan): PurchaseResult {
        if (!isConfigured) {
            return PurchaseResult(null, "In-app purchases are not available in this build.")
        }
        val offeringsResult = fetchOfferings()
        val offerings = offeringsResult.getOrElse {
            return PurchaseResult(null, it.message ?: "Failed to load plans.")
        }
        val offering = offerings.current
            ?: return PurchaseResult(null, "Plans are currently unavailable. Please try again later.")
        val pkg: Package = offering.availablePackages.firstOrNull { pkg ->
            pkg.product.id == plan.productId
        } ?: return PurchaseResult(null, "This plan is currently unavailable. Please try again later.")

        return suspendCancellableCoroutine { cont ->
            val params = PurchaseParams.Builder(activity, pkg).build()
            Purchases.sharedInstance.purchaseWith(
                params,
                onError = { error: PurchasesError, userCancelled: Boolean ->
                    if (userCancelled) {
                        cont.resume(PurchaseResult(null, "cancelled"))
                    } else {
                        cont.resume(PurchaseResult(null, error.message))
                    }
                },
                onSuccess = { _: StoreTransaction?, customerInfo: CustomerInfo ->
                    cont.resume(PurchaseResult(tierFromCustomerInfo(customerInfo)))
                },
            )
        }
    }

    /** Restores previous purchases. Returns the resolved tier. */
    suspend fun restorePurchases(): RestoreResult {
        if (!isConfigured) {
            return RestoreResult(null, "In-app purchases are not available in this build.")
        }
        return suspendCancellableCoroutine { cont ->
            Purchases.sharedInstance.restorePurchasesWith(
                onError = { error: PurchasesError ->
                    cont.resume(RestoreResult(null, error.message))
                },
                onSuccess = { customerInfo: CustomerInfo ->
                    val tier = tierFromCustomerInfo(customerInfo)
                    if (tier == SubscriptionTier.FREE) {
                        cont.resume(RestoreResult(null, "No active subscriptions were found to restore."))
                    } else {
                        cont.resume(RestoreResult(tier))
                    }
                },
            )
        }
    }

    /** Maps RevenueCat entitlements to our SubscriptionTier enum. */
    private fun tierFromCustomerInfo(info: CustomerInfo): SubscriptionTier {
        if (info.entitlements["lifetime"]?.isActive == true) return SubscriptionTier.LIFETIME
        if (info.entitlements["family_household"]?.isActive == true) return SubscriptionTier.FAMILY
        if (info.entitlements["premium"]?.isActive == true) return SubscriptionTier.PREMIUM
        return SubscriptionTier.FREE
    }
}
