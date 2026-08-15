/**
 * ThemeProvider — wraps next-themes for the Porchivo web app.
 *
 * - Default: "system" (follows OS preference)
 * - Class strategy: adds/removes `.dark` on <html>
 * - Disables transitions during theme switch to prevent jarring animation
 * - Persists choice in localStorage
 */

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

interface ThemeProviderProps {
  children: ReactNode;
}

export default function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
