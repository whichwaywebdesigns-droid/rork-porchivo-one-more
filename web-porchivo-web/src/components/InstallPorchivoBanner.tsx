import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, MonitorCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/lib/pwa";

const DISMISS_KEY = "porchivo.installBannerDismissed";

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Dismissible "Install Porchivo" banner for the manager dashboard.
 * Only appears when the native install prompt is genuinely available; shows
 * the success message after installation, then stays hidden on every visit.
 */
export default function InstallPorchivoBanner() {
  const { canInstall, isInstalled, promptInstall } = usePwaInstall();
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState<boolean>(readDismissed);
  // True once the native prompt was offered this session — distinguishes a
  // fresh install (show success) from a returning installed user (stay hidden).
  const sawPromptRef = useRef<boolean>(false);
  if (canInstall) sawPromptRef.current = true;

  if (dismissed) return null;

  const showSuccess = isInstalled && sawPromptRef.current;
  const showOffer = !isInstalled && canInstall;
  if (!showSuccess && !showOffer) return null;

  const dismiss = (): void => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private browsing — dismissal is session-only */
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-6 flex items-start gap-3 rounded-xl border border-brand-blue/25 bg-brand-blue/8 px-4 py-3.5"
    >
      <MonitorCheck className="w-5 h-5 text-brand-blue mt-0.5 flex-shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-brand-text-primary">
          {showSuccess ? t("pwa.install.successTitle") : t("pwa.install.bannerTitle")}
        </p>
        <p className="mt-0.5 text-[13px] text-brand-text-secondary leading-relaxed">
          {showSuccess ? t("pwa.install.installed") : t("pwa.install.bannerBody")}
        </p>
      </div>
      {showOffer && (
        <Button size="sm" onClick={() => void promptInstall()} className="flex-shrink-0">
          <Download className="w-4 h-4" aria-hidden="true" />
          {t("pwa.install.button")}
        </Button>
      )}
      <button
        onClick={dismiss}
        aria-label={t("pwa.install.bannerDismiss")}
        className="text-brand-text-muted hover:text-brand-text-secondary transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue-light flex-shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
