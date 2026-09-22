import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowRight, Info, MonitorDown } from "lucide-react";

import PageLayout from "@/components/PageLayout";
import SEOHead from "@/components/SEOHead";
import BreadcrumbNav from "@/components/BreadcrumbNav";
import InstallPorchivoButton from "@/components/InstallPorchivoButton";
import { Button } from "@/components/ui/button";
import { detectInstallPlatform, usePwaInstall } from "@/lib/pwa";
import { BRAND } from "@/config/brand";

const EDGE_STEPS = ["installPage.edge.step1", "installPage.edge.step2", "installPage.edge.step3", "installPage.edge.step4", "installPage.edge.step5"] as const;
const CHROME_STEPS = ["installPage.chrome.step1", "installPage.chrome.step2", "installPage.chrome.step3", "installPage.chrome.step4", "installPage.chrome.step5"] as const;

interface InstallCardProps {
  title: string;
  steps: readonly string[];
  recommended: boolean;
  recommendedLabel: string;
}

function InstallCard({ title, steps, recommended, recommendedLabel }: InstallCardProps) {
  return (
    <div className="relative rounded-2xl border border-brand-navy-500/30 bg-white/85 dark:bg-brand-navy-800/60 p-6 shadow-sm">
      {recommended && (
        <span className="absolute -top-3 left-6 rounded-full bg-brand-blue px-3 py-0.5 text-[11px] font-semibold text-white shadow-sm">
          {recommendedLabel}
        </span>
      )}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-blue/10 border border-brand-blue/20 flex-shrink-0">
          <MonitorDown className="w-5 h-5 text-brand-blue" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-bold text-brand-text-primary">{title}</h2>
      </div>
      <ol className="mt-5 space-y-3.5">
        {steps.map((stepKey, index) => (
          <li key={stepKey} className="flex items-start gap-3">
            <span
              className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand-blue text-[12px] font-bold text-white"
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <span className="text-sm text-brand-text-secondary leading-relaxed">
              {/* i18n keys are static per browser card */}
              <StepText stepKey={stepKey} />
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function StepText({ stepKey }: { stepKey: string }) {
  const { t } = useTranslation();
  return <>{t(stepKey)}</>;
}

/**
 * Public /install help page — browser-specific PWA installation instructions
 * for desktop users. Safe for logged-out visitors; no account data involved.
 */
export default function InstallPage() {
  const { t } = useTranslation();
  const { isInstalled } = usePwaInstall();
  const platform = detectInstallPlatform();
  const edgeRecommended = platform === "chromium" && /Edg\//.test(navigator.userAgent);

  return (
    <PageLayout>
      <SEOHead
        title={`${t("installPage.title")} · ${BRAND.name}`}
        description={t("installPage.subtitle")}
        canonical={`${BRAND.url}/install`}
        robots="index, follow"
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <BreadcrumbNav items={[{ label: t("installPage.title"), href: "/install" }]} />

        {/* Header */}
        <div className="flex items-start gap-4 mt-6 mb-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-blue/10 border border-brand-blue/20 flex-shrink-0">
            <MonitorDown className="w-6 h-6 text-brand-blue" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-brand-text-primary tracking-tight">
              {t("installPage.title")}
            </h1>
            <p className="mt-2 text-base text-brand-text-secondary">{t("installPage.subtitle")}</p>
          </div>
        </div>

        {isInstalled && (
          <div className="mb-8 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              {t("installPage.alreadyInstalled")}
            </span>
          </div>
        )}

        {/* Browser cards */}
        <div className="grid gap-5 sm:grid-cols-2 mt-10">
          <InstallCard
            title={t("installPage.edge.title")}
            steps={EDGE_STEPS}
            recommended={edgeRecommended}
            recommendedLabel={t("installPage.recommended")}
          />
          <InstallCard
            title={t("installPage.chrome.title")}
            steps={CHROME_STEPS}
            recommended={platform === "chromium" && !edgeRecommended}
            recommendedLabel={t("installPage.recommended")}
          />
        </div>

        {/* Fallback */}
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-brand-navy-500/30 bg-brand-navy-900/5 dark:bg-brand-navy-900/40 px-4 py-3.5">
          <Info className="w-4 h-4 text-brand-text-muted mt-0.5 flex-shrink-0" aria-hidden="true" />
          <p className="text-[13px] text-brand-text-secondary leading-relaxed">
            {t("installPage.fallback")}
          </p>
        </div>

        {/* Actions */}
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link to="/">
              {t("installPage.open")}
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/manage/login">{t("installPage.returnToSignIn")}</Link>
          </Button>
        </div>

        {/* Inline install prompt when the browser supports it on this page */}
        <div className="mt-6">
          <InstallPorchivoButton showInstalledState />
        </div>
      </div>
    </PageLayout>
  );
}
