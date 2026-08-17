import Foundation

/**
 * A user action queued for later replay against Supabase when connectivity is restored.
 * Persisted to UserDefaults via ``PendingActionStore`` so it survives app restarts.
 */
struct PendingAction: Codable, Sendable {
    let id: String
    /// "insert", "update", or "rpc".
    let type: String
    /// Table name (insert/update) or RPC function name (rpc).
    let target: String
    /// JSON-encoded request body.
    let payload: Data
    /// Column → value eq-filters for updates (e.g. {"id": "abc"}).
    let filter: [String: String]?
    /// Which data set to re-fetch after a successful replay (e.g. "shipments").
    let refreshKey: String?
    let timestamp: Date
    var retryCount: Int = 0
    let maxRetries: Int = 3
}
