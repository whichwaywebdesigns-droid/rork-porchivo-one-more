//
//  LanguageManager.swift
//  Porchivo
//
//  Manages app language preference with UserDefaults persistence.
//  On first launch, auto-detects the device's system language using
//  Locale.current and matches it to a supported language. Subsequent
//  launches restore the user's saved preference.
//

import Foundation

/// Supported languages in the app, mirroring the Expo/web registry.
enum AppLanguage: String, CaseIterable, Identifiable {
    case en, es, zh, fr, ru, pt, ar, hi, ja, ko

    var id: String { rawValue }

    /// English name of the language.
    var englishName: String {
        switch self {
        case .en: "English"
        case .es: "Spanish"
        case .zh: "Chinese"
        case .fr: "French"
        case .ru: "Russian"
        case .pt: "Portuguese"
        case .ar: "Arabic"
        case .hi: "Hindi"
        case .ja: "Japanese"
        case .ko: "Korean"
        }
    }

    /// Endonym — the language's name in its own script.
    var nativeName: String {
        switch self {
        case .en: "English"
        case .es: "Español"
        case .zh: "简体中文"
        case .fr: "Français"
        case .ru: "Русский"
        case .pt: "Português"
        case .ar: "العربية"
        case .hi: "हिन्दी"
        case .ja: "日本語"
        case .ko: "한국어"
        }
    }

    /// Representative flag emoji.
    var flag: String {
        switch self {
        case .en: "🇺🇸"
        case .es: "🇪🇸"
        case .zh: "🇨🇳"
        case .fr: "🇫🇷"
        case .ru: "🇷🇺"
        case .pt: "🇧🇷"
        case .ar: "🇸🇦"
        case .hi: "🇮🇳"
        case .ja: "🇯🇵"
        case .ko: "🇰🇷"
        }
    }

    /// Right-to-left script.
    var isRTL: Bool { self == .ar }

    /// "Hello" greeting in this language.
    var hello: String {
        switch self {
        case .en: "Hello"
        case .es: "Hola"
        case .zh: "你好"
        case .fr: "Bonjour"
        case .ru: "Привет"
        case .pt: "Olá"
        case .ar: "مرحبا"
        case .hi: "नमस्ते"
        case .ja: "こんにちは"
        case .ko: "안녕하세요"
        }
    }

    /// All supported language codes for lookup.
    static var supportedCodes: Set<String> {
        Set(allCases.map { $0.rawValue })
    }

    /// Default language when detection fails.
    static let defaultLanguage: AppLanguage = .en
}

/// Manages language preference persistence and system detection.
@Observable
final class LanguageManager {
    /// UserDefaults key for the persisted language code.
    private static let languageKey = "porchivo.language"
    /// Key set to true after the first language resolution so we never override a user's choice.
    private static let initializedKey = "porchivo.language_initialized"

    /// Current app language.
    private(set) var current: AppLanguage = .defaultLanguage

    /// True if the language was auto-detected from the system (not manually chosen).
    private(set) var fromSystem: Bool = false

    /// True while a language-switch transition (fade) is in progress.
    /// Drives the opacity animation in RootView so text swaps feel smooth.
    var languageTransitioning: Bool = false

    /// Shared singleton.
    static let shared = LanguageManager()

    private let defaults = UserDefaults.standard

    private init() {
        loadOrDetect()
    }

    // MARK: - Public

    /// The current language code (e.g. "en", "es").
    var languageCode: String { current.rawValue }

    /// Whether the current language is RTL.
    var isRTL: Bool { current.isRTL }

    /// Change the language with a smooth fade transition.
    /// The caller's view should observe `languageTransitioning` and apply
    /// an opacity animation.
    func setLanguage(_ language: AppLanguage) {
        guard !languageTransitioning else { return }
        languageTransitioning = true

        Task { @MainActor [weak self] in
            guard let self else { return }
            // Hold the fade-out state so SwiftUI animates opacity to 0.
            try? await Task.sleep(for: .milliseconds(220))

            // Swap the language while invisible.
            self.current = language
            self.fromSystem = false
            self.defaults.set(language.rawValue, forKey: Self.languageKey)
            self.defaults.set(true, forKey: Self.initializedKey)

            // Brief pause then release the transition flag so opacity fades back in.
            try? await Task.sleep(for: .milliseconds(60))
            self.languageTransitioning = false
        }
    }

    /// Convenience — change language by raw code string.
    func setLanguage(code: String) {
        if let lang = AppLanguage(rawValue: code) {
            setLanguage(lang)
        }
    }

    // MARK: - Detection

    /// Load the saved language preference, or auto-detect from the system
    /// on first launch.
    private func loadOrDetect() {
        // Check if the user has already chosen a language.
        if let saved = defaults.string(forKey: Self.languageKey),
           let lang = AppLanguage(rawValue: saved) {
            current = lang
            fromSystem = false
            return
        }

        // First launch — detect the device's system language.
        let detected = Self.detectSystemLanguage()
        current = detected
        fromSystem = true
        defaults.set(detected.rawValue, forKey: Self.languageKey)
        defaults.set(true, forKey: Self.initializedKey)
    }

    /// Detect the device's preferred language and match it to a supported language.
    /// Uses Locale.preferredLanguages (the user's language list from Settings).
    /// Falls back to the default language if none match.
    static func detectSystemLanguage() -> AppLanguage {
        // Locale.preferredLanguages returns the user's preferred language list
        // in priority order (e.g. ["es-US", "en-US"]).
        for preferred in Locale.preferredLanguages {
            // Extract the base language code (e.g. "es" from "es-US").
            let code = Locale(identifier: preferred).language.languageCode?.identifier
                ?? preferred.split(separator: "-").first.map(String.init)
                ?? ""

            if !code.isEmpty, let lang = AppLanguage(rawValue: code) {
                return lang
            }
        }

        // Also check Locale.current as a fallback.
        let currentCode = Locale.current.language.languageCode?.identifier ?? ""
        if let lang = AppLanguage(rawValue: currentCode) {
            return lang
        }

        return .defaultLanguage
    }
}
