import { createRoot } from "react-dom/client";

import App from "./App.tsx";
import ThemeProvider from "./components/ThemeProvider";
import "./i18n";
import "./index.css";
import { initScrollbarAutoHide } from "./lib/scrollbar-auto-hide";
import { initPostHog, isPostHogEnabled, posthog } from "./lib/posthog";
import { PostHogProvider } from "posthog-js/react";

initScrollbarAutoHide();
initPostHog();

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    {isPostHogEnabled() ? (
      <PostHogProvider client={posthog}>
        <App />
      </PostHogProvider>
    ) : (
      <App />
    )}
  </ThemeProvider>,
);
