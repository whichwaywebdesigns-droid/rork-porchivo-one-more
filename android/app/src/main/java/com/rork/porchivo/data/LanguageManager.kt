package com.rork.porchivo.data

import android.content.Context
import java.util.Locale

/**
 * Supported languages in the app, mirroring the Expo/iOS/web registry.
 */
enum class AppLanguage(val code: String, val englishName: String, val nativeName: String, val flag: String, val rtl: Boolean = false) {
    EN("en", "English", "English", "🇺🇸"),
    ES("es", "Spanish", "Español", "🇪🇸"),
    ZH("zh", "Chinese", "简体中文", "🇨🇳"),
    FR("fr", "French", "Français", "🇫🇷"),
    RU("ru", "Russian", "Русский", "🇷🇺"),
    PT("pt", "Portuguese", "Português", "🇧🇷"),
    AR("ar", "Arabic", "العربية", "🇸🇦", rtl = true),
    HI("hi", "Hindi", "हिन्दी", "🇮🇳"),
    JA("ja", "Japanese", "日本語", "🇯🇵"),
    KO("ko", "Korean", "한국어", "🇰🇷");

    companion object {
        val DEFAULT: AppLanguage = EN

        /** All supported language codes for fast lookup. */
        val SUPPORTED_CODES: Set<String> = entries.map { it.code }.toSet()

        /** Look up by code, returning DEFAULT if not found. */
        fun fromCode(code: String?): AppLanguage? {
            if (code == null) return null
            return entries.firstOrNull { it.code == code }
        }

        /**
         * Detect the device's system language and match it to a supported language.
         * Uses Locale.getDefault() which returns the device's current locale.
         * Falls back to DEFAULT if no match.
         */
        fun detectSystemLanguage(): AppLanguage {
            // Locale.getDefault() returns the device's current locale setting.
            val language = Locale.getDefault().language
            fromCode(language)?.let { return it }

            // Also check the app's resource locales as a fallback.
            for (locale in Locale.getAvailableLocales()) {
                fromCode(locale.language)?.let { return it }
            }

            return DEFAULT
        }
    }
}

/**
 * Manages language preference persistence via SharedPreferences.
 *
 * On first launch, auto-detects the device's system language using
 * Locale.getDefault() and matches it to a supported language.
 * Subsequent launches restore the user's saved preference.
 *
 * The user's manual selection always wins over system detection
 * on future launches.
 */
class LanguageManager(context: Context) {

    private val prefs = context.getSharedPreferences("porchivo_prefs", Context.MODE_PRIVATE)

    companion object {
        private const val KEY_LANGUAGE = "porchivo.language"
        private const val KEY_INITIALIZED = "porchivo.language_initialized"
    }

    /**
     * Load the saved language preference, or auto-detect from the system
     * on first launch.
     *
     * @return The resolved language and whether it came from system detection.
     */
    fun loadOrDetect(): Pair<AppLanguage, Boolean> {
        // Check if the user has already chosen a language.
        val saved = prefs.getString(KEY_LANGUAGE, null)
        if (saved != null) {
            val lang = AppLanguage.fromCode(saved) ?: AppLanguage.DEFAULT
            return lang to false
        }

        // First launch — detect the device's system language.
        val detected = AppLanguage.detectSystemLanguage()
        prefs.edit()
            .putString(KEY_LANGUAGE, detected.code)
            .putBoolean(KEY_INITIALIZED, true)
            .apply()
        return detected to true
    }

    /**
     * Change the language and persist the choice.
     * Once called, the system-detection flag is cleared so we never
     * override the user's manual preference on future launches.
     */
    fun setLanguage(language: AppLanguage) {
        prefs.edit()
            .putString(KEY_LANGUAGE, language.code)
            .putBoolean(KEY_INITIALIZED, true)
            .apply()
    }

    /**
     * Convenience — change language by code string.
     */
    fun setLanguage(code: String) {
        AppLanguage.fromCode(code)?.let { setLanguage(it) }
    }
}
