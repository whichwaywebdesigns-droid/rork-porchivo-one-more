import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Settings as SettingsIcon, Globe, Check, Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "next-themes";

import PageLayout from "@/components/PageLayout";
import SEOHead from "@/components/SEOHead";
import BreadcrumbNav from "@/components/BreadcrumbNav";
import LanguageSelector from "@/components/LanguageSelector";
import { getLanguageMeta } from "@/i18n/languages";
import { BRAND } from "@/config/brand";

type ThemeOption = "light" | "system" | "dark";

const THEME_OPTIONS: { value: ThemeOption; icon: typeof Sun; label: string; description: string }[] = [
  { value: "light", icon: Sun, label: "Light", description: "Bright background, dark text" },
  { value: "system", icon: Monitor, label: "System", description: "Follow your device preference" },
  { value: "dark", icon: Moon, label: "Dark", description: "Dark navy background, light text" },
];

export default function SettingsPage() {
  const { i18n, t } = useTranslation();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const meta = getLanguageMeta(i18n.language);
  const locale = i18n.language || "en";

  const sampleDate = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

  const sampleNumber = new Intl.NumberFormat(locale).format(119_000_000);

  return (
    <PageLayout>
      <SEOHead
        title={`${t("settings.title")} · ${BRAND.name}`}
        description={t("settings.subtitle")}
        canonical={`${BRAND.url}/settings`}
        robots="noindex, follow"
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <BreadcrumbNav items={[{ label: t("settings.title"), href: "/settings" }]} />

        {/* Header */}
        <div className="flex items-start gap-4 mt-6 mb-10">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-orange/10 border border-brand-orange/20 flex-shrink-0">
            <SettingsIcon className="w-6 h-6 text-brand-orange" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-brand-text-primary tracking-tight">
              {t("settings.title")}
            </h1>
            <p className="text-brand-text-muted mt-1.5 text-[15px] leading-relaxed">
              {t("settings.subtitle")}
            </p>
          </div>
        </div>

        {/* Language card */}
        <section
          aria-labelledby="language-heading"
          className="rounded-2xl border border-brand-navy-500/40 bg-brand-navy-800/40 p-6 sm:p-8"
        >
          <div className="flex items-center gap-2.5 mb-1.5">
            <Globe className="w-5 h-5 text-brand-blue-light" />
            <h2 id="language-heading" className="text-xl font-semibold text-brand-text-primary">
              {t("settings.language.title")}
            </h2>
          </div>
          <p className="text-sm text-brand-text-muted leading-relaxed mb-6 max-w-prose">
            {t("settings.language.description")}
          </p>

          <label className="block text-[13px] font-medium text-brand-text-secondary mb-2">
            {t("settings.language.label")}
          </label>
          <LanguageSelector />

          {/* Current selection summary */}
          <div className="mt-6 flex items-center gap-3 rounded-xl bg-brand-navy-900/50 border border-brand-navy-500/30 px-4 py-3">
            <span className="text-2xl leading-none" aria-hidden>
              {meta.flag}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-brand-text-muted font-semibold">
                {t("settings.language.current")}
              </p>
              <p className="text-sm font-medium text-brand-text-primary truncate">
                {meta.nativeName}{" "}
                <span className="text-brand-text-muted font-normal">· {meta.englishName}</span>
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-blue-light bg-brand-blue/10 border border-brand-blue/20 px-2 py-1 rounded-md whitespace-nowrap">
              <Check className="w-3 h-3" /> {t("settings.language.translated")}
            </span>
          </div>

          {/* Live locale preview */}
          <div className="mt-6 pt-6 border-t border-brand-navy-500/30">
            <p className="text-[11px] uppercase tracking-wider text-brand-text-muted font-semibold mb-3">
              {t("settings.preview.title")}
            </p>
            <dl className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-xl bg-brand-navy-900/40 px-4 py-3">
                <dt className="text-xs text-brand-text-muted">{t("settings.preview.sampleDate")}</dt>
                <dd className="text-sm font-medium text-brand-text-primary mt-0.5">{sampleDate}</dd>
              </div>
              <div className="rounded-xl bg-brand-navy-900/40 px-4 py-3">
                <dt className="text-xs text-brand-text-muted">{t("settings.preview.sampleNumber")}</dt>
                <dd className="text-sm font-medium text-brand-text-primary mt-0.5">{sampleNumber}</dd>
              </div>
            </dl>
          </div>
        </section>
        {/* Appearance card */}
        <section
          aria-labelledby="appearance-heading"
          className="rounded-2xl border border-brand-navy-500/40 bg-brand-navy-800/40 p-6 sm:p-8 mt-6"
        >
          <div className="flex items-center gap-2.5 mb-1.5">
            {mounted && resolvedTheme === "dark" ? (
              <Moon className="w-5 h-5 text-brand-blue-light" />
            ) : (
              <Sun className="w-5 h-5 text-brand-blue-light" />
            )}
            <h2 id="appearance-heading" className="text-xl font-semibold text-brand-text-primary">
              Appearance
            </h2>
          </div>
          <p className="text-sm text-brand-text-muted leading-relaxed mb-6 max-w-prose">
            Choose how Porchivo looks. System mode follows your device's dark or light setting automatically.
          </p>

          <div className="grid sm:grid-cols-3 gap-3">
            {THEME_OPTIONS.map(({ value, icon: Icon, label, description }) => {
              const active = mounted && (theme === value || (!theme && value === "system"));
              return (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={`flex flex-col items-center text-center rounded-xl border p-5 transition-all ${
                    active
                      ? "bg-brand-blue/10 border-brand-blue/40 ring-1 ring-brand-blue/20"
                      : "bg-brand-navy-900/40 border-brand-navy-500/30 hover:border-brand-navy-500/60 hover:bg-brand-navy-700/40"
                  }`}
                  aria-pressed={active}
                >
                  <Icon className={`w-6 h-6 mb-2 ${active ? "text-brand-blue-light" : "text-brand-text-muted"}`} />
                  <span className={`text-sm font-semibold ${active ? "text-brand-blue-light" : "text-brand-text-primary"}`}>
                    {label}
                  </span>
                  <span className="text-xs text-brand-text-muted mt-1 leading-snug">
                    {description}
                  </span>
                </button>
              );
            })}
          </div>

          {mounted && theme === "system" && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-brand-blue/5 border border-brand-blue/20 px-4 py-3">
              <Monitor className="w-4 h-4 text-brand-blue-light flex-shrink-0" />
              <p className="text-[13px] text-brand-text-secondary">
                Currently using <span className="font-semibold text-brand-text-primary">{resolvedTheme}</span> mode based on your system preference.
              </p>
            </div>
          )}
        </section>
      </div>
    </PageLayout>
  );
}
