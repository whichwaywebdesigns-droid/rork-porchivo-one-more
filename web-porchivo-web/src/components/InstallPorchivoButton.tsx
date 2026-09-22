import { useTranslation } from "react-i18next";
import { Download, MonitorCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/lib/pwa";

interface InstallPorchivoButtonProps {
  className?: string;
  /** When installed, render a short "Installed" confirmation instead of nothing. */
  showInstalledState?: boolean;
}

/**
 * "Install Porchivo" button — launches the browser-native install dialog.
 * Renders nothing when installation is unsupported or already done.
 */
export default function InstallPorchivoButton({
  className,
  showInstalledState = false,
}: InstallPorchivoButtonProps) {
  const { canInstall, isInstalled, promptInstall } = usePwaInstall();
  const { t } = useTranslation();

  if (isInstalled) {
    if (!showInstalledState) return null;
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
        <MonitorCheck className="w-4 h-4" aria-hidden="true" />
        {t("pwa.install.installedShort")}
      </span>
    );
  }

  if (!canInstall) return null;

  return (
    <Button onClick={() => void promptInstall()} size="sm" className={className}>
      <Download className="w-4 h-4" aria-hidden="true" />
      {t("pwa.install.button")}
    </Button>
  );
}
