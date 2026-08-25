import Foundation

/// Debug helper that prints the loaded Supabase configuration at startup.
/// Only emits output in DEBUG builds and never prints the full API key.
enum SupabaseConfigDebug {
    static func logConfiguration() {
        #if DEBUG
        let url = Config.EXPO_PUBLIC_SUPABASE_URL
        let anonKey = Config.EXPO_PUBLIC_SUPABASE_ANON_KEY
        let publishableKey = Config.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY

        let urlSet = !url.isEmpty && !url.contains("placeholder")
        print("[SupabaseConfig] URL: \(urlSet ? "set" : "missing") (\(url.count) chars)")
        print("[SupabaseConfig] Anon key length: \(anonKey.count)")
        print("[SupabaseConfig] Publishable key length: \(publishableKey.count)")

        let activeKey = publishableKey.isEmpty ? anonKey : publishableKey
        print("[SupabaseConfig] Active key type: \(keyType(activeKey)) (length: \(activeKey.count))")
        #endif
    }

    private static func keyType(_ key: String) -> String {
        if key.isEmpty { return "empty" }
        if key.hasPrefix("eyJ"), key.split(separator: ".").count == 3 {
            return "publishable JWT"
        }
        return "legacy / opaque"
    }
}
