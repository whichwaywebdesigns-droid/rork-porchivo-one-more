//
//  TabReselectMonitor.swift
//  Porchivo
//
//  SwiftUI TabView exposes no reselect event, so re-taps of the already-
//  selected tab are detected in MainTabView's selection binding (UIKit fires
//  the setter even when the value doesn't change) and recorded here as a
//  per-tab stamp. RouteViews observe their tab's stamp and clear the
//  navigation path — re-tapping a tab always returns to its menu.
//

import SwiftUI

@Observable
final class TabReselectMonitor {
    static let shared = TabReselectMonitor()

    private var stamps: [Int: Int] = [:]

    func recordReselect(_ tab: Int) {
        stamps[tab, default: 0] += 1
    }

    func stamp(for tab: Int) -> Int {
        stamps[tab] ?? 0
    }
}

/// Identifies which bottom tab a view lives in (nil = not in the tab bar).
private struct TabIndexKey: EnvironmentKey {
    static let defaultValue: Int? = nil
}

extension EnvironmentValues {
    var pvTabIndex: Int? {
        get { self[TabIndexKey.self] }
        set { self[TabIndexKey.self] = newValue }
    }
}
