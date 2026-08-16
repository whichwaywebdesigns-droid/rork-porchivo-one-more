/**
 * Porchivo — i18n initialization.
 *
 * Wires i18next + react-i18next with browser language detection.
 * Persists the user's choice to localStorage and applies <html lang>/dir.
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import { resources } from "./locales";
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGE_CODES, getLanguageMeta } from "./languages";

export const LANGUAGE_STORAGE_KEY = "porchivo.language";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: DEFAULT_LANGUAGE,
    // Every language in the registry is selectable; missing strings fall back to English.
    supportedLngs: false,
    load: "languageOnly",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ["localStorage"],
    },
  });

/** Apply reading direction + lang attribute for the active language. */
export function applyDocumentLanguage(code: string): void {
  const meta = getLanguageMeta(code);
  const dir = meta.rtl ? "rtl" : "ltr";
  document.documentElement.setAttribute("lang", code);
  document.documentElement.setAttribute("dir", dir);
}

// Keep the document in sync on every language change.
i18n.on("languageChanged", (lng) => {
  applyDocumentLanguage(lng);
});

// Initial application on load.
applyDocumentLanguage(i18n.language || DEFAULT_LANGUAGE);

/**
 * Change the language with a smooth global fade-out → swap → fade-in transition.
 *
 * The root `#root` element has a CSS `transition: opacity 0.2s ease` in
 * `index.css`. This function drives that transition by:
 * 1. Fading the entire app to opacity 0 (~200ms)
 * 2. Swapping the i18next language while invisible
 * 3. Fading back to opacity 1 (~250ms)
 *
 * If the root element can't be found, falls back to an instant switch.
 */
export async function changeLanguageWithTransition(code: string): Promise<void> {
  const root = document.getElementById("root");
  if (!root) {
    await i18n.changeLanguage(code);
    return;
  }

  // Phase 1 — fade out.
  root.style.opacity = "0";
  await new Promise((resolve) => setTimeout(resolve, 200));

  // Phase 2 — swap language while invisible.
  await i18n.changeLanguage(code);
  await new Promise((resolve) => setTimeout(resolve, 60));

  // Phase 3 — fade back in.
  root.style.opacity = "1";
}

export { SUPPORTED_LANGUAGE_CODES };
export default i18n;
