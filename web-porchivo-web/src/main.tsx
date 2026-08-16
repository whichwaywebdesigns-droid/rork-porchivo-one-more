import { createRoot } from "react-dom/client";

import App from "./App.tsx";
import ThemeProvider from "./components/ThemeProvider";
import "./i18n";
import "./index.css";
import { initScrollbarAutoHide } from "./lib/scrollbar-auto-hide";

initScrollbarAutoHide();

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>,
);
