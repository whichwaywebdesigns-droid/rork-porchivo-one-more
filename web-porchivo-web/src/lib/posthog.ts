/**
 * PostHog analytics for the Porchivo marketing site.
 *
 * No-ops entirely unless VITE_POSTHOG_API_KEY is configured, so local dev
 * and preview builds stay silent without a project key.
 */

import posthog from "posthog-js";

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_API_KEY;
const POSTHOG_HOST =
  import.meta.env.VITE_POSTHOG_HOST ?? "https://us.i.posthog.com";

export const isPostHogEnabled = (): boolean => Boolean(POSTHOG_KEY);

let initialized = false;

export function initPostHog(): void {
  if (!POSTHOG_KEY || initialized) return;
  initialized = true;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    // Marketing site: full autocapture (clicks, forms) + exception capture.
    autocapture: true,
    capture_exceptions: true,
    // SPA: $pageview is fired manually per route change in <PostHogPageView/>.
    capture_pageview: false,
    persistence: "localStorage+cookie",
  });
}

export { posthog };
