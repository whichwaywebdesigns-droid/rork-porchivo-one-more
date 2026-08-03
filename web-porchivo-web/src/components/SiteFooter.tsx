import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Twitter, Mail } from "lucide-react";
import { FOOTER_NAV } from "@/config/navigation";
import { BRAND } from "@/config/brand";
import LanguageSelector from "./LanguageSelector";

/** Maps footer section labels to translation keys. */
const FOOTER_SECTION_KEYS: Record<string, string> = {
  Product: "footer.product",
  Company: "footer.company",
  "Legal & Trust": "footer.legal",
  "Developers & AI": "footer.developers",
};

function PorchivoWordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex-shrink-0" style={{ width: 53, height: 46 }}>
        <img
          src="/delivery_box_cardboard.png"
          alt=""
          className="absolute inset-0 w-full h-full object-contain opacity-95"
          aria-hidden
        />
        <img
          src="/porchivo-icon.png"
          alt="Porchivo"
          width={32}
          height={32}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl object-cover"
          aria-hidden
        />
      </div>
      <span className="text-lg font-bold text-brand-text-primary tracking-tight">
        {BRAND.name}
      </span>
    </div>
  );
}

export default function SiteFooter() {
  const { t } = useTranslation();
  return (
    <footer className="bg-brand-navy-900 border-t border-brand-navy-500/30 mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        {/* Top row */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-10 mb-12">
          {/* Brand column */}
          <div className="col-span-2">
            <Link to="/" className="inline-block mb-4">
              <PorchivoWordmark />
            </Link>
            <p className="text-sm text-brand-text-muted leading-relaxed max-w-xs">
              {BRAND.tagline}
            </p>

            {/* Trust badges */}
            <div className="flex flex-wrap gap-2 mt-5 mb-4">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-brand-blue/10 border border-brand-blue/20 text-[11px] text-brand-blue-light font-medium">
                <span className="w-1 h-1 rounded-full bg-brand-blue" />
                {t("footer.iosAndroid")}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-brand-orange/10 border border-brand-orange/20 text-[11px] text-brand-orange-light font-medium">
                <span className="w-1 h-1 rounded-full bg-brand-orange" />
                {t("footer.freeToDownload")}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <a
                href={`https://twitter.com/porchivo`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg text-brand-text-muted hover:text-brand-text-secondary hover:bg-brand-navy-600/50 transition-colors"
                aria-label="Porchivo on Twitter/X"
              >
                <Twitter className="w-4 h-4" />
              </a>
              <a
                href={`mailto:${BRAND.supportEmail}`}
                className="p-2 rounded-lg text-brand-text-muted hover:text-brand-text-secondary hover:bg-brand-navy-600/50 transition-colors"
                aria-label="Email Porchivo support"
              >
                <Mail className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Nav sections */}
          {FOOTER_NAV.map((section) => (
            <div key={section.label}>
              <h3 className="text-[11px] font-semibold text-brand-text-muted uppercase tracking-widest mb-4">
                {FOOTER_SECTION_KEYS[section.label] ? t(FOOTER_SECTION_KEYS[section.label]) : section.label}
              </h3>
              <ul className="space-y-2.5">
                {section.items.map((item) => (
                  <li key={item.href}>
                    {item.external ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-brand-text-secondary hover:text-brand-text-primary transition-colors"
                      >
                        {item.label}
                      </a>
                    ) : (
                      <Link
                        to={item.href}
                        className="text-sm text-brand-text-secondary hover:text-brand-text-primary transition-colors"
                      >
                        {item.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom row */}
        <div className="pt-8 border-t border-brand-navy-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-xs text-brand-text-muted">
            © {new Date().getFullYear()} Porchivo. {t("footer.rights")}
          </p>
          <div className="flex flex-wrap items-center gap-5">
            <LanguageSelector compact />
            <Link to="/privacy" className="text-xs text-brand-text-muted hover:text-brand-text-secondary transition-colors">
              {t("footer.privacy")}
            </Link>
            <Link to="/terms" className="text-xs text-brand-text-muted hover:text-brand-text-secondary transition-colors">
              {t("footer.terms")}
            </Link>
            <a
              href="/sitemap.xml"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand-text-muted hover:text-brand-text-secondary transition-colors"
            >
              Sitemap
            </a>
            <a
              href="/llms.txt"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand-text-muted hover:text-brand-text-secondary font-mono transition-colors"
            >
              llms.txt
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
