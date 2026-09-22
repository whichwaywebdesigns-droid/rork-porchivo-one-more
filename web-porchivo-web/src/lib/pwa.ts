/**
 * PWA install + update support.
 *
 * - `registerServiceWorker` registers /sw.js (safe shell caching only) and
 *   periodically checks for new deployments.
 * - `usePwaInstall` captures the browser's beforeinstallprompt event, tracks
 *   installed state, and launches the native install dialog. All install CTAs
 *   render only while installation is genuinely available.
 * - `usePwaUpdate` watches for a waiting service worker and exposes a
 *   user-initiated "Refresh" (no surprise reloads).
 */
import { useCallback, useEffect, useState } from "react";

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallPlatform = "chromium" | "ios" | "android-other" | "unsupported";

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const installListeners = new Set<() => void>();

function notifyInstallListeners(): void {
  installListeners.forEach((listener) => listener());
}

// Wire global listeners once, module-level (beforeinstallprompt can fire early).
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notifyInstallListeners();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    try {
      localStorage.setItem("porchivo.pwaInstalled", "1");
    } catch {
      /* private browsing — display-mode checks still cover installed state */
    }
    notifyInstallListeners();
  });
}

/** True when the app is running as an installed PWA (own window). */
export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function detectInstallPlatform(): InstallPlatform {
  if (typeof navigator === "undefined") return "unsupported";
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && "maxTouchPoints" in navigator);
  if (isIOS) return "ios";
  if (/Edg\//.test(ua) || (/Chrome\//.test(ua) && !/Edg|OPR|SamsungBrowser/.test(ua))) {
    return "chromium";
  }
  if (/Android/.test(ua)) return "android-other";
  return "unsupported";
}

/** Registers the service worker and polls for new deployments (hourly). */
export function registerServiceWorker(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (location.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(location.hostname)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        window.setInterval(() => {
          void registration.update().catch(() => undefined);
        }, 60 * 60 * 1000);
      })
      .catch(() => {
        // SW registration is best-effort; the app works fully without it.
      });
  });
}

export interface PwaInstallState {
  /** Native install prompt is available right now. */
  canInstall: boolean;
  /** App is already installed / running in standalone mode. */
  isInstalled: boolean;
  platform: InstallPlatform;
  /** Launches the native Chrome/Edge install dialog. */
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
}

export function usePwaInstall(): PwaInstallState {
  const [canInstall, setCanInstall] = useState<boolean>(deferredPrompt !== null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (isStandaloneDisplay()) return true;
    try {
      return localStorage.getItem("porchivo.pwaInstalled") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const sync = (): void => {
      setCanInstall(deferredPrompt !== null);
      setIsInstalled(isStandaloneDisplay() || ((): boolean => {
        try {
          return localStorage.getItem("porchivo.pwaInstalled") === "1";
        } catch {
          return false;
        }
      })());
    };
    sync();
    installListeners.add(sync);
    const media = window.matchMedia("(display-mode: standalone)");
    media.addEventListener?.("change", sync);
    return () => {
      installListeners.delete(sync);
      media.removeEventListener?.("change", sync);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    if (!deferredPrompt) return "unavailable";
    const promptEvent = deferredPrompt;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === "accepted") {
      deferredPrompt = null;
      setCanInstall(false);
    }
    return outcome;
  }, []);

  return { canInstall, isInstalled, platform: detectInstallPlatform(), promptInstall };
}

export interface PwaUpdateState {
  /** A new deployment is downloaded and waiting; safe to refresh. */
  updateReady: boolean;
  /** Applies the waiting worker, then reloads once it takes control. */
  applyUpdate: () => void;
}

export function usePwaUpdate(): PwaUpdateState {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let cancelled = false;

    navigator.serviceWorker.getRegistration().then((registration) => {
      if (cancelled || !registration) return;
      const checkWaiting = (): void => {
        if (registration.waiting && navigator.serviceWorker.controller) {
          setWaitingWorker(registration.waiting);
        }
      };
      checkWaiting();
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            setWaitingWorker(installing);
          }
        });
      });
    });

    const onControllerChange = (): void => window.location.reload();
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  const applyUpdate = useCallback((): void => {
    waitingWorker?.postMessage("SKIP_WAITING");
  }, [waitingWorker]);

  return { updateReady: waitingWorker !== null, applyUpdate };
}
