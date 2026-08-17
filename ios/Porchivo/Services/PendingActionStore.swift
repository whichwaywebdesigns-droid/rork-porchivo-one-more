import Foundation

/**
 * UserDefaults-backed queue for ``PendingAction``s.
 * Serialises the entire array as a single `Data` blob so it survives app restarts.
 */
final class PendingActionStore {

    private let defaults = UserDefaults.standard
    private let key = "porchivo_pending_actions"
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init() {
        encoder.dateEncodingStrategy = .iso8601
        decoder.dateDecodingStrategy = .iso8601
    }

    /// Load all queued actions from disk.
    func loadActions() -> [PendingAction] {
        guard let data = defaults.data(forKey: key) else { return [] }
        return (try? decoder.decode([PendingAction].self, from: data)) ?? []
    }

    /// Persist the full action list to disk.
    func saveActions(_ actions: [PendingAction]) {
        if let data = try? encoder.encode(actions) {
            defaults.set(data, forKey: key)
        }
    }

    /// Remove all queued actions (called on sign-out).
    func clear() {
        defaults.removeObject(forKey: key)
    }
}
