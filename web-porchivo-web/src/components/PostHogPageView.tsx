import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { isPostHogEnabled, posthog } from "@/lib/posthog";

/**
 * Fires a $pageview on every SPA route change. Mounted once inside the
 * BrowserRouter; renders nothing.
 */
export default function PostHogPageView() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    if (isPostHogEnabled()) {
      posthog.capture("$pageview", { $current_url: window.location.href });
    }
  }, [pathname, search]);

  return null;
}
