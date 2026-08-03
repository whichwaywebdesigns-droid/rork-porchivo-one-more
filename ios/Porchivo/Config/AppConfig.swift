//
//  AppConfig.swift
//  Porchivo
//
//  Founder control panel — mirrors expo/config/app.ts and android AppConfig.kt.
//  Prices are DISPLAY labels only; real prices live in App Store Connect.
//

import Foundation

enum AppConfig {
    enum Pricing {
        static let monthlyDisplay = "$13.99"
        static let monthlyPerMonth = "$13.99/mo"
        static let monthlyProductID = "premium_monthly"

        static let annualDisplay = "$99.99"
        static let annualPerMonth = "$8.33/mo"
        static let annualProductID = "premium_annual"
        static let annualTrialDays = 7
        static let annualSavingsLabel = "Save 40%"

        static let lifetimeDisplay = "$500"
        static let lifetimeProductID = "porchivo_lifetime"

        static let winbackLabel = "Save 40% for 3 months"
        static let winbackDisplay = "$7.99/mo"
    }

    enum FamilyPlan {
        static let maxMembers = 5
        static let monthlyDisplay = "$23.99"
        static let monthlyProductID = "family_monthly"
        static let annualDisplay = "$179.99"
        static let annualPerMonth = "$15.00/mo"
        static let annualSavingsLabel = "Save 37%"
        static let annualProductID = "family_annual"
        static let annualTrialDays = 7
    }

    enum FreeLimits {
        /// Free users can track 1 package — the second hits the upgrade wall.
        static let maxPackages = 1
    }

    enum RiskThresholds {
        static let high = 65
        static let medium = 35
        static let baseScore = 30
    }

    enum Support {
        static let email = "support@porchivo.com"
        static let websiteURL = "https://porchivo.com"
        static let privacyPolicyURL = "https://porchivo.com/privacy"
        static let termsURL = "https://porchivo.com/terms"
    }

    enum SocialProof {
        static let packagesStolenStat = "119M"
        static let stolenRatio = "1 in 5"
    }
}
