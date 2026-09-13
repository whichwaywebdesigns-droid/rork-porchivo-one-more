import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { changeLanguageWithTransition } from "@/i18n";
import { syncProfileLanguage } from "./LanguageSelector";

interface LanguagePillProps {
  className?: string;
}

const OPTIONS: ReadonlyArray<{ code: "en" | "es"; label: string; aria: string }> = [
  { code: "en", label: "EN", aria: "Switch to English" },
  { code: "es", label: "ES", aria: "Cambiar a Español" },
];

/**
 * Compact EN/ES segmented toggle for the headers (US/Mexico launch).
 * Tapping a side switches instantly (with the global fade transition) and
 * best-effort syncs the choice to profiles.preferred_language so Resend
 * emails follow the user's locale. Full multi-language picker stays on
 * Settings + the header/footer globe selectors.
 */
export default function LanguagePill({ className }: LanguagePillProps) {
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
      className={cn(
        "inline-flex items-center rounded-lg border border-brand-navy-500/50 bg-brand-navy-800/60 p-0.5",
        className,
      )}
    >
      {OPTIONS.map(({ code, label, aria }) => {
        const active = current === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => void handleSelect(code)}
            aria-pressed={active}
            aria-label={aria}
            className={cn(
              "min-w-[34px] rounded-md px-2 py-1.5 text-[11px] font-bold uppercase leading-none transition-colors",
              active
                ? "bg-brand-orange text-white shadow-sm"
                : "text-brand-text-muted hover:text-brand-text-primary",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
