//
//  RevenueCatService.swift
//  Porchivo
//
//  Wraps the RevenueCat SDK for real IAP — fetches offerings, processes
//  purchases and restores, and maps entitlements to SubscriptionTier.
//

import Foundation
import RevenueCat

@MainActor
@Observable
final class RevenueCatService {
    static let shared = RevenueCatService()

    private(set) var offerings: Offerings?
    private(set) var isConfigured = false
    private(set) var isLoading = false
    private(set) var lastError: String?

    private init() {}

    /// Configures the RevenueCat SDK. Call once on app launch when Supabase
    /// is configured (real API key present). In demo mode this is a no-op.
    func configure() {
        guard !isConfigured else { return }
        let apiKey = Config.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
        guard !apiKey.isEmpty else { return }
        Purchases.logLevel = .warn
        Purchases.configure(withAPIKey: apiKey)
        isConfigured = true
        Task { await refreshOfferings() }
    }

    /// Fetches the latest offerings from RevenueCat.
    func refreshOfferings() async {
        guard isConfigured else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            offerings = try await Purchases.shared.getOfferings()
        } catch {
            lastError = error.localizedDescription
        }
    }

    /// Returns the Package for a given plan, or nil if offerings aren't loaded.
    func package(for plan: UpgradePlan) -> Package? {
        guard let offerings else { return nil }
        let offering = offerings.current
        switch plan {
        case .monthly:
            return offering?.availablePackages.first { $0.storeProduct.productIdentifier == AppConfig.Pricing.monthlyProductID }
        case .annual:
            return offering?.availablePackages.first { $0.storeProduct.productIdentifier == AppConfig.Pricing.annualProductID }
        case .family:
            return offering?.availablePackages.first { $0.storeProduct.productIdentifier == AppConfig.FamilyPlan.annualProductID }
        case .lifetime:
            return offering?.availablePackages.first { $0.storeProduct.productIdentifier == AppConfig.Pricing.lifetimeProductID }
        }
    }

    /// Purchases the given package. Returns the resulting SubscriptionTier on
    /// success, or an error message on failure.
    func purchase(_ plan: UpgradePlan) async -> Result<SubscriptionTier, String> {
        guard isConfigured else {
            return .failure("In-app purchases are not available in this build.")
        }
        guard let package = package(for: plan) else {
            return .failure("This plan is currently unavailable. Please try again later.")
        }
        do {
            let result = try await Purchases.shared.purchase(package: package)
            return .success(tierFromCustomerInfo(result.customerInfo))
        } catch let error as ErrorCode {
            if error == .purchaseCancelledError {
                return .failure("cancelled")
            }
            return .failure(error.localizedDescription)
        } catch {
            return .failure(error.localizedDescription)
        }
    }

    /// Restores previous purchases. Returns the resolved tier or an error.
    func restorePurchases() async -> Result<SubscriptionTier, String> {
        guard isConfigured else {
            return .failure("In-app purchases are not available in this build.")
        }
        do {
            let info = try await Purchases.shared.restorePurchases()
            let tier = tierFromCustomerInfo(info)
            if tier == .free {
                return .failure("No active subscriptions were found to restore.")
            }
            return .success(tier)
        } catch {
            return .failure(error.localizedDescription)
        }
    }

    /// Checks the current entitlements and returns the active tier.
    func currentTier() async -> SubscriptionTier {
        guard isConfigured else { return .free }
        do {
            let info = try await Purchases.shared.getCustomerInfo()
            return tierFromCustomerInfo(info)
        } catch {
            return .free
        }
    }

    /// Maps RevenueCat entitlements to our SubscriptionTier enum.
    private func tierFromCustomerInfo(_ info: CustomerInfo) -> SubscriptionTier {
        if info.entitlements["lifetime"]?.isActive == true {
            return .lifetime
        }
        if info.entitlements["family"]?.isActive == true {
            return .family
        }
        if info.entitlements["premium"]?.isActive == true {
            return .premium
        }
        return .free
    }
}

/// Plan types matching the UpgradeScreen picker.
enum UpgradePlan: String, CaseIterable, Identifiable {
    case monthly, annual, family, lifetime
    var id: String { rawValue }
}
