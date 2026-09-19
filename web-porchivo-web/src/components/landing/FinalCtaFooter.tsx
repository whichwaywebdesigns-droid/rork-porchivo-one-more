import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import Reveal from "@/components/landing/Reveal";
import AppStoreBadges from "@/components/AppStoreBadges";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const CTA_VIDEO = "/assets/final-cta-loop.mp4";
const CTA_POSTER = "/images/final-cta-dome.jpg";

/** Final full-width call-to-action before the footer (B2B copy). */
export function FinalCtaSection() {
  const { t } = useTranslation();
  const reducedMotion = usePrefersReducedMotion();
  const [videoFailed, setVideoFailed] = useState(false);
  const showVideo = !reducedMotion && !videoFailed;

  return (
    <section className="relative overflow-hidden border-t border-white/5 py-28">
      {/* Ambient video underlay — same muted-loop + navy-gradient treatment as the hero */}
      <div className="absolute inset-0" aria-hidden>
        {showVideo ? (
          <video
            className="h-full w-full object-cover"
            src={CTA_VIDEO}
            poster={CTA_POSTER}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            onError={() => setVideoFailed(true)}
          />
        ) : (
          <img
            src={CTA_POSTER}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-pv-navy/70" />
        <div className="absolute inset-0 bg-gradient-to-b from-pv-navy/80 via-transparent to-pv-navy" />
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_30%_38%,rgba(56,189,248,0.16),transparent_70%)]" />
      </div>
      {/* Glow backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[820px] max-w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-pv-amber/10 blur-3xl"
      />
      <Reveal className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h2 className="font-display text-4xl font-bold tracking-tight text-white sm:text-6xl">
          {t("landing.final.title1")}{" "}
          <span className="bg-gradient-to-r from-pv-amber to-pv-electric bg-clip-text text-transparent">
            {t("landing.final.title2")}
          </span>
        </h2>
        <div className="mt-10 flex flex-col items-center justify-center gap-5">
          <Link
            to="/download"
            className="inline-flex items-center gap-2 rounded-xl bg-pv-amber px-8 py-4 font-display text-lg font-bold text-pv-navy transition-transform hover:scale-[1.03] motion-safe:animate-glow-pulse"
          >
            {t("landing.cta.register")}
            <ArrowRight className="h-5 w-5" aria-hidden />
          </Link>
          <AppStoreBadges />
        </div>
      </Reveal>
    </section>
  );
}

/** Landing footer: contact, address, and legal links (per spec). */
export function LandingFooter() {
  const { t } = useTranslation();
  return (
    <footer className="border-t border-white/10 bg-pv-navy-900">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-10 text-sm text-white/55 sm:flex-row sm:justify-between sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <img
            src="/porchivo-icon-liquid-glass-512.png"
            alt=""
            className="h-6 w-6 rounded-md"
          />
          <span className="font-display font-bold text-white">Porchivo</span>
        </div>

        <div className="flex flex-col items-center gap-1.5 text-center sm:flex-row sm:gap-3">
          <a
            href="mailto:support@porchivo.com"
            className="transition-colors hover:text-white"
          >
            support@porchivo.com
          </a>
          <span aria-hidden className="hidden sm:inline">
            |
          </span>
          <span>800 Sycamore #329 SMB#103322 Evansville, IN 47708</span>
        </div>

        <nav aria-label="Legal" className="flex items-center gap-5">
          <Link to="/privacy" className="transition-colors hover:text-white">
            {t("footer.privacy")}
          </Link>
          <Link to="/terms" className="transition-colors hover:text-white">
            {t("footer.terms")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
