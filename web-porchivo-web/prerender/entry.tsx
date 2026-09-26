/**
 * Prerender entry — loaded ONLY by scripts/prerender.mjs via vite.ssrLoadModule.
 *
 * Renders each public marketing/content route to static HTML at build time so
 * crawlers and AI agents receive real content instead of the empty #root SPA
 * shell. Not imported by the app bundle; uses direct page imports (App.tsx
 * lazy-loads the same modules for the client).
 *
 * Meta values come from the same sources the pages use at runtime
 * (config/seo.ts PAGE_SEO map, BRAND, MX_LEGAL, i18n strings) so the static
 * head always matches what the client renders after hydration.
 */
import type { ComponentType } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import i18next from "i18next";

import { resources } from "@/i18n/locales";
import ThemeProvider from "@/components/ThemeProvider";
import { getPageSEO } from "@/config/seo";
import { BRAND } from "@/config/brand";
import { MX_LEGAL } from "@/config/legalMx";

import Index from "@/pages/Index";
import Features from "@/pages/Features";
import Pricing from "@/pages/Pricing";
import UseCases from "@/pages/UseCases";
import About from "@/pages/About";
import FAQ from "@/pages/FAQ";
import Guide from "@/pages/Guide";
import Changelog from "@/pages/Changelog";
import ForAgents from "@/pages/ForAgents";
import Download from "@/pages/Download";
import Install from "@/pages/Install";
import PartnersLanding from "@/pages/PartnersLanding";
import SafetyLanding from "@/pages/SafetyLanding";
import HoaLanding from "@/pages/HoaLanding";
import CityLanding from "@/pages/CityLanding";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import TermsOfService from "@/pages/TermsOfService";
import PrivacyPolicyEs from "@/pages/PrivacyPolicyEs";
import TermsOfServiceEs from "@/pages/TermsOfServiceEs";
import DeleteAccount from "@/pages/DeleteAccount";

export interface PrerenderMeta {
  title: string;
  description: string;
  canonical: string;
  robots?: string;
}

export interface PrerenderRoute {
  path: string;
  component: ComponentType;
  meta: PrerenderMeta;
}

type SeoKey = Parameters<typeof getPageSEO>[0];

const seoMeta = (key: SeoKey): PrerenderMeta => {
  const page = getPageSEO(key);
  return {
    title: page.title,
    description: page.description,
    canonical: page.canonical,
    robots: page.robots,
  };
};

/**
 * Dedicated i18next instance — src/i18n/index.ts cannot be used here because
 * it touches document.documentElement at import time (Node has no document).
 * English only: the sole prerendered page calling t() is /install, and its
 * content is English.
 */
const i18n = i18next.createInstance();
const i18nReady = new Promise<typeof i18n>((resolve, reject) => {
  i18n.init(
    {
      resources,
      lng: "en",
      fallbackLng: "en",
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    },
    (error) => (error ? reject(error) : resolve(i18n)),
  );
});

export const ROUTES: PrerenderRoute[] = [
  { path: "/", component: Index, meta: seoMeta("home") },
  { path: "/features", component: Features, meta: seoMeta("features") },
  { path: "/pricing", component: Pricing, meta: seoMeta("pricing") },
  { path: "/use-cases", component: UseCases, meta: seoMeta("useCases") },
  { path: "/about", component: About, meta: seoMeta("about") },
  { path: "/faq", component: FAQ, meta: seoMeta("faq") },
  { path: "/guide", component: Guide, meta: seoMeta("guide") },
  { path: "/changelog", component: Changelog, meta: seoMeta("changelog") },
  { path: "/for-agents", component: ForAgents, meta: seoMeta("forAgents") },
  { path: "/download", component: Download, meta: seoMeta("download") },
  { path: "/privacy", component: PrivacyPolicy, meta: seoMeta("privacy") },
  { path: "/terms", component: TermsOfService, meta: seoMeta("terms") },
  {
    path: "/install",
    component: Install,
    // Mirrors the page's own SEOHead: `${t("installPage.title")} · ${BRAND.name}`.
    meta: {
      title: "Install Porchivo on Your Computer · Porchivo",
      description: "Open Porchivo from your desktop or taskbar just like any other work app.",
      canonical: `${BRAND.url}/install`,
      robots: "index, follow",
    },
  },
  {
    path: "/partners",
    component: PartnersLanding,
    // Description derived from the page's visible subline (no SEOHead on page).
    meta: {
      title: "Porch Partners — Neighbors Who Watch Your Porch · Porchivo",
      description:
        "A Porch Partner is a verified neighbor who holds your packages safely when you're not home. Request a partner, agree on terms, and pick up on your schedule.",
      canonical: `${BRAND.url}/partners`,
      robots: "index, follow",
    },
  },
  {
    path: "/safety",
    component: SafetyLanding,
    // Description derived from the page's visible subline (no SEOHead on page).
    meta: {
      title: "Neighborhood Safety, At a Glance · Porchivo",
      description:
        "Risk alerts when theft reports spike, suspicious-activity warnings, and safety tools that watch your block together with your neighbors.",
      canonical: `${BRAND.url}/safety`,
      robots: "index, follow",
    },
  },
  {
    path: "/hoa",
    component: HoaLanding,
    meta: {
      title: "Package Security for HOAs & Property Managers — Porchivo",
      description:
        "Real-time package risk scoring, instant alerts, a neighbor-held delivery network, and manager insights — no hardware, no IT project. Community plans from $99/mo.",
      canonical: `${BRAND.url}/hoa`,
      robots: "index, follow",
    },
  },
  {
    path: "/evansville-in",
    component: () => createElement(CityLanding, { slug: "evansville-in" }),
    meta: {
      title: "Package Security in Evansville, IN — Porchivo",
      description:
        "Package protection built for Evansville porches: real-time theft-risk scoring, instant alerts, and Porch Partners who hold deliveries safely — no hardware required.",
      canonical: `${BRAND.url}/evansville-in`,
      robots: "index, follow",
    },
  },
  {
    path: "/es/privacidad",
    component: PrivacyPolicyEs,
    meta: {
      title: "Aviso de Privacidad — Porchivo",
      description: `Aviso de Privacidad de Porchivo conforme a la LFPDPPP, operado por ${MX_LEGAL.companyName}. Vigente desde el ${MX_LEGAL.effectiveDate}.`,
      canonical: `${BRAND.url}/es/privacidad`,
      robots: "index, follow",
    },
  },
  {
    path: "/es/terminos",
    component: TermsOfServiceEs,
    meta: {
      title: "Términos y Condiciones — Porchivo",
      description: `Términos y Condiciones de Porchivo, operado por ${MX_LEGAL.companyName}. Vigentes desde el ${MX_LEGAL.effectiveDate}.`,
      canonical: `${BRAND.url}/es/terminos`,
      robots: "index, follow",
    },
  },
  {
    path: "/delete-account",
    component: DeleteAccount,
    meta: {
      title: "Delete Your Porchivo Account — Porchivo",
      description:
        "Delete your Porchivo account and personal data at any time — instantly from the app, or by email request. No account or sign-in required to view this page.",
      canonical: `${BRAND.url}/delete-account`,
      robots: "index, follow",
    },
  },
  {
    path: "/data-deletion",
    component: DeleteAccount,
    meta: {
      title: "Delete Your Porchivo Data — Porchivo",
      description:
        "Delete your Porchivo data and personal information at any time — instantly from the app, or by email request. No sign-in is required to view this page.",
      canonical: `${BRAND.url}/data-deletion`,
      robots: "index, follow",
    },
  },
];

/**
 * Renders one route to static HTML. Wraps the page in the same provider stack
 * the client app uses (theme, query client, i18n) plus a StaticRouter.
 */
export async function renderRoute(route: PrerenderRoute): Promise<string> {
  await i18nReady;
  const queryClient = new QueryClient();
  return renderToStaticMarkup(
    createElement(
      I18nextProvider,
      { i18n },
      createElement(
        ThemeProvider,
        null,
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(StaticRouter, { location: route.path }, createElement(route.component)),
        ),
      ),
    ),
  );
}
