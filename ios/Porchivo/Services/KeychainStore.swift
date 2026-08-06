//
//  KeychainStore.swift
//  Porchivo
//
//  Secure session storage via iOS Keychain — the Swift analog of Android's
//  EncryptedSharedPreferences. Stores the Supabase auth session JSON so users
//  stay logged in across app restarts.
//

import Foundation
import Security

nonisolated enum KeychainError: Error, Sendable {
    case unhandled(OSStatus)
    case decode
}

nonisolated enum KeychainStore {
    private static let service = "com.whichwayweblabs.porchivo"
    private static let sessionAccount = "supabase_session"

    static func saveSession(_ data: Data) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: sessionAccount,
        ]
        SecItemDelete(query as CFDictionary)
        var add = query
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        let status = SecItemAdd(add as CFDictionary, nil)
        guard status == errSecSuccess else { throw KeychainError.unhandled(status) }
    }

    static func loadSession() throws -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: sessionAccount,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess else { throw KeychainError.unhandled(status) }
        return item as? Data
    }

    static func clearSession() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: sessionAccount,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
