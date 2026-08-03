import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Menu, X, HelpCircle, ChevronRight } from "lucide-react";
import { PRIMARY_NAV } from "@/config/navigation";
import { BRAND } from "@/config/brand";
import LanguageSelector from "./LanguageSelector";

/** Maps nav hrefs to translation keys so labels stay localized. */
const NAV_LABEL_KEYS: Record<string, string> = {
  "/#how-it-works": "nav.howItWorks",
  "/features": "nav.features",
  "/porch-partners": "nav.porchPartners",
  "/pricing": "nav.pricing",
};

/** Porchivo app icon with the cardboard box underlaid behind it. */
function PorchivoMark() {
  return (
    <div className="relative flex-shrink-0" style={{ width: 55, height: 48 }}>
      <img
        src="/delivery_box_cardboard.png"
        alt=""
        className="absolute inset-0 w-full h-full object-contain opacity-95"
        aria-hidden
      />
      <img
        src="/porchivo-icon.png"
        alt="Porchivo"
        width={38}
        height={38}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl object-cover"
        aria-hidden
      />
    </div>
  );
}

/** Thin orange reading-progress bar fixed to the very top of the viewport */
function ScrollProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const update = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0);
    };
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <div
      className="absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-brand-orange to-brand-orange-light transition-all duration-100"
      style={{ width: `${progress}%` }}
      aria-hidden
    />
  );
}

export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const navLabel = (item: { href: string; label: string }) =>
    NAV_LABEL_KEYS[item.href] ? t(NAV_LABEL_KEYS[item.href]) : item.label;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const isActive = (href: string) => {
    if (href.startsWith("/#")) return false; // hash links are never "active page"
    return href === "/" ? location.pathname === "/" : location.pathname.startsWith(href);
  };

  return (
    <>
      {/* Skip to main content — keyboard / screen-reader accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-brand-orange focus:text-white focus:text-sm focus:font-semibold focus:shadow-lg"
      >
        Skip to main content
      </a>

      <header
        ref={menuRef}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 overflow-visible ${
          scrolled || menuOpen
            ? "bg-brand-navy-900/97 backdrop-blur-xl border-b border-brand-navy-500/40"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-[68px]">

            {/* ── Logo ──────────────────────────────────────────────────── */}
            <Link
              to="/"
              className="flex items-center gap-2.5 group flex-shrink-0"
              aria-label="Porchivo — go to home page"
            >
              <PorchivoMark />
              <span className="text-[17px] font-bold text-brand-text-primary tracking-tight leading-none">
                {BRAND.name}
              </span>
            </Link>

            {/* ── Desktop nav ───────────────────────────────────────────── */}
            <nav className="hidden md:flex items-center gap-0.5" aria-label="Main navigation">
              {PRIMARY_NAV.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`group relative px-4 py-2.5 rounded-lg text-[13.5px] font-medium transition-all duration-150 ${
                    isActive(item.href)
                      ? "text-brand-blue-light bg-brand-blue/10"
                      : "text-brand-text-muted hover:text-brand-text-primary hover:bg-brand-navy-600/50"
                  }`}
                >
                  {navLabel(item)}
                  {/* Subtle active underline */}
                  {isActive(item.href) && (
                    <span className="absolute bottom-0.5 left-4 right-4 h-[1.5px] rounded-full bg-brand-blue-light/60" />
                  )}
                </Link>
              ))}
            </nav>

            {/* ── Desktop right side ────────────────────────────────────── */}
            <div className="hidden md:flex items-center gap-2.5">
              {/* FAQ / Help pill */}
              <Link
                to="/faq"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium text-brand-text-muted hover:text-brand-text-secondary hover:bg-brand-navy-600/40 transition-all"
                aria-label="Frequently asked questions"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                {t("nav.help")}
              </Link>

              <LanguageSelector compact />

              <Link
                to="/download"
                className="btn-orange px-5 py-2.5 rounded-lg text-white text-[13px] font-bold leading-none whitespace-nowrap"
              >
                {t("nav.getAppFree")}
              </Link>
            </div>

            {/* ── Mobile toggle ─────────────────────────────────────────── */}
            <button
              className="md:hidden p-2.5 rounded-xl text-brand-text-muted hover:text-brand-text-primary hover:bg-brand-navy-600/50 transition-colors"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
            >
              {menuOpen
                ? <X className="w-5 h-5" />
                : <Menu className="w-5 h-5" />
              }
            </button>
          </div>
        </div>

        {/* ── Scroll progress bar ───────────────────────────────────────── */}
        <ScrollProgressBar />

        {/* ── Mobile menu ───────────────────────────────────────────────── */}
        <div
          id="mobile-menu"
          role="navigation"
          aria-label="Mobile navigation"
          className={`md:hidden transition-all duration-300 ease-in-out overflow-hidden ${
            menuOpen ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="border-t border-brand-navy-500/40 bg-brand-navy-900/99 backdrop-blur-xl">
            {/* Section header */}
            <div className="px-5 pt-4 pb-1">
              <p className="text-[11px] font-semibold text-brand-text-muted uppercase tracking-widest">
                {t("nav.navigate")}
              </p>
            </div>

            <nav className="px-3 py-2 flex flex-col gap-1">
              {PRIMARY_NAV.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`group flex flex-col px-4 py-3.5 rounded-2xl transition-all ${
                    isActive(item.href)
                      ? "text-brand-blue-light bg-brand-blue/10"
                      : "text-brand-text-secondary hover:text-brand-text-primary hover:bg-brand-navy-700/80 active:bg-brand-navy-600/80"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[15px] font-semibold leading-tight">{navLabel(item)}</span>
                    <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5 ${
                      isActive(item.href) ? "text-brand-blue-light" : "text-brand-text-muted"
                    }`} />
                  </div>
                  {item.description && (
                    <span className="text-[12.5px] text-brand-text-muted mt-0.5 leading-snug pr-6">
                      {item.description}
                    </span>
                  )}
                </Link>
              ))}
            </nav>

            {/* Mobile footer */}
            <div className="mx-3 mt-1 mb-4 pt-3 border-t border-brand-navy-500/30 flex flex-col gap-2.5 px-1">
              <Link
                to="/download"
                className="btn-orange flex items-center justify-center gap-2 w-full text-center px-4 py-4 rounded-2xl text-white font-bold text-[15px]"
              >
                {t("nav.getAppFreeLong")}
              </Link>
              <Link
                to="/faq"
                className="flex items-center justify-center gap-1.5 w-full text-center px-4 py-3 rounded-xl text-brand-text-muted hover:text-brand-text-secondary hover:bg-brand-navy-700/50 transition-colors text-[13px] font-medium"
              >
                <HelpCircle className="w-4 h-4" />
                {t("nav.faqPrompt")}
              </Link>
              <div className="px-1 pt-1">
                <LanguageSelector />
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
