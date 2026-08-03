package com.rork.porchivo.config

/**
 * Mirrors expo/config/app.ts — the founder control panel.
 * Prices are DISPLAY labels only; real prices live in Google Play Console.
 */
object AppConfig {

    object Pricing {
        const val MONTHLY_DISPLAY = "$13.99"
        const val MONTHLY_PER_MONTH = "$13.99/mo"
        const val MONTHLY_PRODUCT_ID = "premium_monthly"

        const val ANNUAL_DISPLAY = "$99.99"
        const val ANNUAL_PER_MONTH = "$8.33/mo"
        const val ANNUAL_PRODUCT_ID = "premium_annual"
        const val ANNUAL_TRIAL_DAYS = 7
        const val ANNUAL_SAVINGS_LABEL = "Save 40%"

        const val LIFETIME_DISPLAY = "$500"
        const val LIFETIME_PRODUCT_ID = "porchivo_lifetime"

        const val WINBACK_LABEL = "Save 40% for 3 months"
        const val WINBACK_DISPLAY = "$7.99/mo"
    }

    object FamilyPlan {
        const val MAX_MEMBERS = 5
        const val MONTHLY_DISPLAY = "$23.99"
        const val MONTHLY_PRODUCT_ID = "family_monthly"
        const val ANNUAL_DISPLAY = "$179.99"
        const val ANNUAL_PER_MONTH = "$15.00/mo"
        const val ANNUAL_SAVINGS_LABEL = "Save 37%"
        const val ANNUAL_PRODUCT_ID = "family_annual"
        const val ANNUAL_TRIAL_DAYS = 7
    }

    object FreeLimits {
        /** Free users can track 1 package — the second hits the upgrade wall. */
        const val MAX_PACKAGES = 1
    }

    object RiskThresholds {
        const val HIGH = 65
        const val MEDIUM = 35
        const val BASE_SCORE = 30
    }

    object Support {
        const val EMAIL = "support@porchivo.com"
        const val WEBSITE_URL = "https://porchivo.com"
        const val PRIVACY_POLICY_URL = "https://porchivo.com/privacy"
        const val TERMS_URL = "https://porchivo.com/terms"
    }

    object SocialProof {
        const val PACKAGES_STOLEN_STAT = "119M"
        const val STOLEN_RATIO = "1 in 5"
    }
}
