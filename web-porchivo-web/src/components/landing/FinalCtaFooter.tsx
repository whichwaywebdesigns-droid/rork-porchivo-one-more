import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Reveal from "@/components/landing/Reveal";
import AppStoreBadges from "@/components/AppStoreBadges";

/** Final full-width call-to-action before the footer (B2B copy). */
export function FinalCtaSection() {
  return (
    <section className="relative overflow-hidden border-t border-white/5 py-28">
      {/* Branded dome backdrop + navy wash */}
      <div className="absolute inset-0" aria-hidden>
        <img
          src="/images/final-cta-dome.jpg"
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-pv-navy/80" />
        <div className="absolute inset-0 bg-gradient-to-b from-pv-navy via-transparent to-pv-navy" />
      </div>
      {/* Glow backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[820px] max-w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-pv-amber/10 blur-3xl"
      />
      <Reveal className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h2 className="font-display text-4xl font-bold tracking-tight text-white sm:text-6xl">
          Know before it&apos;s too late.{" "}
          <span className="bg-gradient-to-r from-pv-amber to-pv-electric bg-clip-text text-transparent">
            Register your community in two minutes.
          </span>
        </h2>
        <div className="mt-10 flex flex-col items-center justify-center gap-5">
          <Link
            to="/download"
            className="inline-flex items-center gap-2 rounded-xl bg-pv-amber px-8 py-4 font-display text-lg font-bold text-pv-navy transition-transform hover:scale-[1.03] motion-safe:animate-glow-pulse"
          >
            Register Your Community
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
            Privacy
          </Link>
          <Link to="/terms" className="transition-colors hover:text-white">
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  );
}
