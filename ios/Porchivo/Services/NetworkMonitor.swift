import Foundation
import Network

/**
 * Realtime network connectivity monitor using ``NWPathMonitor``.
 *
 * Calls ``onStatusChange`` on the main actor whenever the device gains or
 * loses internet access. The ``AppState`` uses this to trigger automatic
 * queue replay when connectivity is restored.
 */
final class NetworkMonitor {

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "com.porchivo.networkmonitor")

    /// Called on the main actor with `true` when online, `false` when offline.
    var onStatusChange: (@MainActor (Bool) -> Void)?

    /// Current connectivity state (updated on the main actor).
    private(set) var isOnline = true

    /// Begin listening for network changes. Call from AppState.init.
    func start() {
        monitor.pathUpdateHandler = { [weak self] path in
            let online = path.status == .satisfied
            Task { @MainActor in
                self?.isOnline = online
                self?.onStatusChange?(online)
            }
        }
        monitor.start(queue: queue)
    }

    /// Stop listening. Call when the AppState is being torn down.
    func stop() {
        monitor.cancel()
    }
}
