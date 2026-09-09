import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";

const NAV_LINKS = [
  { label: "How It Works", hash: "#how-it-works" },
  { label: "Features", hash: "#features" },
  { label: "Pricing", hash: "#pricing" },
  { label: "FAQ", hash: "#faq" },
] as const;

/** Smooth-scrolls to a section anchor, honoring reduced-motion. */
export function scrollToHash(hash: string): void {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelector(hash)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
}

/**
 * Fixed landing navbar. Transparent over the hero, solid navy with blur
 * once the page scrolls. Anchors scroll in-page; Get Started opens /download.
 */
export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = (): void => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const onNavClick = (hash: string) => (event: React.MouseEvent) => {
    event.preventDefault();
    setMenuOpen(false);
    scrollToHash(hash);
  };

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-white/10 bg-pv-navy/90 shadow-lg shadow-black/20 backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-20 sm:px-6 lg:px-8"
      >
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5" aria-label="Porchivo home">
          <img
            src="/porchivo-icon-liquid-glass-512.png"
            alt=""
            className="h-8 w-8 rounded-lg sm:h-9 sm:w-9"
          />
          <span className="font-display text-xl font-bold tracking-tight text-white">
            Porchivo
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.hash}
              href={link.hash}
              onClick={onNavClick(link.hash)}
              className="text-sm font-medium text-white/70 transition-colors hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/download"
            className="hidden rounded-xl bg-pv-amber px-5 py-2.5 font-display text-sm font-bold text-pv-navy transition-transform hover:scale-[1.04] sm:inline-flex"
          >
            Register Your Community
          </Link>
          {/* Mobile menu toggle */}
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 text-white md:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu panel */}
      {menuOpen && (
        <div
          id="mobile-menu"
          className="border-t border-white/10 bg-pv-navy/95 backdrop-blur-md md:hidden"
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4">
            {NAV_LINKS.map((link) => (
              <a
                key={link.hash}
                href={link.hash}
                onClick={onNavClick(link.hash)}
                className="rounded-lg px-3 py-2.5 text-base font-medium text-white/80 hover:bg-white/5 hover:text-white"
              >
                {link.label}
              </a>
            ))}
            <Link
              to="/download"
              className="mt-2 rounded-xl bg-pv-amber px-5 py-3 text-center font-display font-bold text-pv-navy"
            >
              Register Your Community
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
