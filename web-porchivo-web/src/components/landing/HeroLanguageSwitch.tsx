import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { changeLanguageWithTransition } from "@/i18n";
import { syncProfileLanguage } from "@/components/LanguageSelector";

interface LanguageOption {
  code: "en" | "es";
  flag: string;
  native: string;
  aria: string;
}

const OPTIONS: ReadonlyArray<LanguageOption> = [
  { code: "en", flag: "🇺🇸", native: "English", aria: "Switch to English" },
  { code: "es", flag: "🇪🇸", native: "Español", aria: "Cambiar a Español" },
];

/**
 * Prominent EN/ES swap control for the landing hero (US/Mexico launch).
 * Larger sibling of the header LanguagePill: flags + native names, pv-*
 * glass styling matching the hero design system. Switching applies the
 * global fade transition and best-effort syncs the choice to
 * profiles.preferred_language so Resend emails follow the locale.
 */
export default function HeroLanguageSwitch() {
  const { i18n } = useTranslation();
  const current: string = i18n.language?.split("-")[0] ?? "en";

  const handleSelect = useCallback(
    async (code: "en" | "es") => {
      if (code === current) return;
      await changeLanguageWithTransition(code);
      void syncProfileLanguage(code);
    },
    [current],
  );

  return (
    <div
      role="group"
      aria-label="Language / Idioma"
      className="inline-flex items-center gap-1 rounded-2xl border border-white/15 bg-white/[0.06] p-1.5 backdrop-blur-md"
    >
      {OPTIONS.map(({ code, flag, native, aria }) => {
        const active = current === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => void handleSelect(code)}
            aria-pressed={active}
            aria-label={aria}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 font-display text-sm font-bold transition-all ${
              active
                ? "bg-pv-amber text-pv-navy shadow-lg shadow-pv-amber/25"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            <span className="text-base leading-none" aria-hidden>
              {flag}
            </span>
            {native}
          </button>
        );
      })}
    </div>
  );
}
