import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, X } from "lucide-react";

import { usePwaUpdate } from "@/lib/pwa";

/**
 * Non-disruptive "new version available" notice for installed PWA users.
 * Appears bottom-right once the updated service worker is waiting; refreshing
 * is always user-initiated. Rendered once at the app root.
 */
export default function PwaUpdateToast() {
  const { updateReady, applyUpdate } = usePwaUpdate();
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState<boolean>(false);

  if (!updateReady || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[100] flex items-start gap-3 rounded-xl border border-brand-navy-500/60 bg-brand-navy-800/95 backdrop-blur px-4 py-3 shadow-lg max-w-sm"
    >
      <RefreshCw className="w-4 h-4 text-brand-blue-light mt-0.5 flex-shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-brand-text-primary leading-snug">
          {t("pwa.update.available")}
        </p>
        <button
          onClick={applyUpdate}
          className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-brand-blue px-3 py-1 text-[12px] font-semibold text-white transition-colors hover:bg-brand-blue-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue-light"
        >
          {t("pwa.update.refresh")}
        </button>
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label={t("pwa.update.dismiss")}
        className="text-brand-text-muted hover:text-brand-text-secondary transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue-light"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
