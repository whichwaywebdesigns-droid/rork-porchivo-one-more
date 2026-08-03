import type { ReactNode } from "react";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import BackToTop from "./BackToTop";

interface PageLayoutProps {
  children: ReactNode;
  /** Extra top padding to account for fixed header. Default: true */
  padTop?: boolean;
}

export default function PageLayout({ children, padTop = true }: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-brand-navy-900 text-brand-text-primary flex flex-col">
      <SiteHeader />
      <main
        id="main-content"
        tabIndex={-1}
        className={`flex-1 outline-none ${padTop ? "pt-[68px]" : ""}`}
      >
        {children}
      </main>
      <SiteFooter />
      <BackToTop />
    </div>
  );
}
