//
//  RevenueCatService.swift
//  Porchivo
//
//  Wraps the RevenueCat SDK for real IAP — fetches offerings, processes
//  purchases and restores, and maps entitlements to SubscriptionTier.
//

import Foundation
import RevenueCat

/// Simple string-wrapped error for RevenueCat purchase/restore failures.
struct PurchaseError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

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
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            Purchases.shared.getOfferings { offerings, error in
                if let error {
                    self.lastError = error.localizedDescription
                } else {
                    self.offerings = offerings
                }
                continuation.resume()
            }
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
    func purchase(_ plan: UpgradePlan) async -> Result<SubscriptionTier, PurchaseError> {
        guard isConfigured else {
            return .failure(PurchaseError(message: "In-app purchases are not available in this build."))
        }
        guard let package = package(for: plan) else {
            return .failure(PurchaseError(message: "This plan is currently unavailable. Please try again later."))
        }
        return await withCheckedContinuation { (continuation: CheckedContinuation<Result<SubscriptionTier, PurchaseError>, Never>) in
            Purchases.shared.purchase(package: package) { transaction, customerInfo, error, userCancelled in
                if userCancelled {
                    continuation.resume(returning: .failure(PurchaseError(message: "cancelled")))
                    return
                }
                if let error {
                    continuation.resume(returning: .failure(PurchaseError(message: error.localizedDescription)))
                    return
                }
                guard let customerInfo else {
                    continuation.resume(returning: .failure(PurchaseError(message: "Purchase completed but customer info was unavailable.")))
                    return
                }
                let tier = self.tierFromCustomerInfo(customerInfo)
                continuation.resume(returning: .success(tier))
            }
        }
    }

    /// Restores previous purchases. Returns the resolved tier or an error.
    func restorePurchases() async -> Result<SubscriptionTier, PurchaseError> {
        guard isConfigured else {
            return .failure(PurchaseError(message: "In-app purchases are not available in this build."))
        }
        return await withCheckedContinuation { (continuation: CheckedContinuation<Result<SubscriptionTier, PurchaseError>, Never>) in
            Purchases.shared.restorePurchases { customerInfo, error in
                if let error {
                    continuation.resume(returning: .failure(PurchaseError(message: error.localizedDescription)))
                    return
                }
                guard let customerInfo else {
                    continuation.resume(returning: .failure(PurchaseError(message: "Could not retrieve customer info.")))
                    return
                }
                let tier = self.tierFromCustomerInfo(customerInfo)
                if tier == .free {
                    continuation.resume(returning: .failure(PurchaseError(message: "No active subscriptions were found to restore.")))
                    return
                }
                continuation.resume(returning: .success(tier))
            }
        }
    }

    /// Checks the current entitlements and returns the active tier.
    func currentTier() async -> SubscriptionTier {
        guard isConfigured else { return .free }
        return await withCheckedContinuation { (continuation: CheckedContinuation<SubscriptionTier, Never>) in
            Purchases.shared.getCustomerInfo { customerInfo, error in
                guard let customerInfo, error == nil else {
                    continuation.resume(returning: .free)
                    return
                }
                continuation.resume(returning: self.tierFromCustomerInfo(customerInfo))
            }
        }
    }

    /// Maps RevenueCat entitlements to our SubscriptionTier enum.
    nonisolated private func tierFromCustomerInfo(_ info: CustomerInfo) -> SubscriptionTier {
        if info.entitlements["lifetime"]?.isActive == true {
            return .lifetime
        }
        if info.entitlements["family_household"]?.isActive == true {
            return .family
        }
        if info.entitlements["premium"]?.isActive == true {
            return .premium
        }
        return .free
    }
}

/// Plan types for legacy IAP (unused in hybrid model — kept for compatibility).
enum UpgradePlan: String, CaseIterable, Identifiable {
    case monthly, annual, family, lifetime
    var id: String { rawValue }
}
