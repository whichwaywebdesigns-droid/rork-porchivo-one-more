import type { ReactNode } from "react";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import BackToTop from "./BackToTop";
import FoamPeanuts from "./FoamPeanuts";

interface PageLayoutProps {
  children: ReactNode;
  /** Extra top padding to account for fixed header. Default: true */
  padTop?: boolean;
  /** Purely decorative foam-peanut border around the paper sheet (onboarding-style screens). */
  peanuts?: boolean;
  /** Purely decorative packing-tape strip overlapping the paper sheet's top edge. */
  tape?: boolean;
}

export default function PageLayout({ children, padTop = true, peanuts = false, tape = false }: PageLayoutProps) {
  return (
    <div className="page-desk min-h-screen flex flex-col">
      {/* A sheet of paper on the desk — full-bleed on mobile, framed on desktop */}
      <div className="paper-sheet relative flex flex-col flex-1 w-full max-w-6xl mx-auto my-2 sm:my-4 md:my-6 overflow-x-clip">
        {tape && <div className="packing-tape" aria-hidden />}
        {peanuts && <FoamPeanuts />}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 outline-none relative z-[1]"
        >
          {children}
        </main>
        <SiteFooter />
      </div>
      <BackToTop />
    </div>
  );
}
