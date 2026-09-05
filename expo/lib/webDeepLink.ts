import { Platform } from "react-native";

/**
 * Web deep-link reconstruction for email CTAs.
 *
 * The marketing shell can't serve the Expo web app at /app/<screen> (its
 * static host catch-all serves the marketing SPA), so its AppRedirect bounces
 * deep links to /app/index.html and forwards the original subpath + query as a
 * `?pv_deep=` param (also stashed in sessionStorage as a fallback). This
 * module rewrites the history entry back to the real path BEFORE expo-router
 * boots, so the deep-linked screen becomes the app's genuine initial route —
 * no post-hoc navigation, no races with the splash or auth redirects.
 *
 * Runs once at module scope (web only); a no-op on native, where scheme-based
 * deep links are handled by expo-router directly (+native-intent.tsx).
 */

const STORAGE_KEY = "porchivo_deep_link";
const MAX_AGE_MS = 30 * 60 * 1000;
const BASE_URL = "/app";

function sanitizeDeepLink(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const path = raw.trim();
  // Only absolute in-app paths — no protocol-relative or external URLs.
  if (path.length === 0 || path.length > 512) return null;
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  if (path.includes("://")) return null;
  if (path === "/") return null;
  return path;
}

function readStoredDeepLink(): string | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { path, ts } = parsed as { path?: unknown; ts?: unknown };
    if (typeof path !== "string") return null;
    if (typeof ts === "number" && Date.now() - ts > MAX_AGE_MS) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return sanitizeDeepLink(path);
  } catch {
    return null;
  }
}

/**
 * Rewrites /app/index.html?pv_deep=/screen?x → /app/screen?x before the
 * router mounts. Prefers the pv_deep param (always set by AppRedirect) and
 * falls back to the sessionStorage copy so a refresh mid-login still lands
 * on the target screen.
 */
export function applyWebDeepLink(): void {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const deep = sanitizeDeepLink(params.get("pv_deep")) ?? readStoredDeepLink();
    if (!deep) return;

    params.delete("pv_deep");
    const remainingQuery = params.toString();
    const nextUrl =
      `${BASE_URL}${deep}` + (remainingQuery ? `?${remainingQuery}` : "");
    window.history.replaceState(null, "", nextUrl);
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Never block boot on deep-link reconstruction.
  }
}
