/**
 * Porchivo — JSON-LD Schema Generators
 *
 * All structured data is generated here from config objects.
 * Rules:
 *  - Schema must match visible page content exactly
 *  - Only include required + recommended properties
 *  - Never add misleading or speculative markup
 *  - Each generator returns a plain object ready for JSON.stringify
 */

import { BRAND } from "./brand";
import { SITE_KEYWORDS } from "./seo";

// ─── Base Types ───────────────────────────────────────────────────────────────

export interface SchemaObject {
  "@context": string;
  "@type": string | string[];
  [key: string]: unknown;
}

// ─── Organization ─────────────────────────────────────────────────────────────

export function buildOrganizationSchema(): SchemaObject {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${BRAND.url}/#organization`,
    name: BRAND.name,
    legalName: BRAND.legalName,
    url: BRAND.url,
    logo: {
      "@type": "ImageObject",
      url: BRAND.logoUrl,
      width: 512,
      height: 512,
    },
    description: BRAND.description,
    email: BRAND.supportEmail,
    sameAs: [
      BRAND.appStoreUrl,
      BRAND.playStoreUrl,
      `https://twitter.com/porchivo`,
    ],
    foundingDate: BRAND.founded,
    areaServed: {
      "@type": "Country",
      name: "United States",
    },
  };
}

// ─── WebSite ──────────────────────────────────────────────────────────────────

export function buildWebSiteSchema(): SchemaObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${BRAND.url}/#website`,
    url: BRAND.url,
    name: BRAND.name,
    description: BRAND.tagline,
    keywords: SITE_KEYWORDS.join(", "),
    publisher: {
      "@id": `${BRAND.url}/#organization`,
    },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${BRAND.url}/faq?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

// ─── MobileApplication ────────────────────────────────────────────────────────

export function buildMobileAppSchema(): SchemaObject {
  return {
    "@context": "https://schema.org",
    "@type": ["MobileApplication", "SoftwareApplication"],
    "@id": `${BRAND.url}/#app`,
    name: BRAND.name,
    description: BRAND.description,
    url: BRAND.url,
    applicationCategory: "UtilitiesApplication",
    applicationSubCategory: "Home Security",
    operatingSystem: BRAND.operatingSystem.join(", "),
    offers: [
      {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        name: "Free tier",
        description: "Track 1 package at no cost",
      },
      {
        "@type": "Offer",
        price: "6.67",
        priceCurrency: "USD",
        billingIncrement: "P1M",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: "79.99",
          priceCurrency: "USD",
          referenceQuantity: {
            "@type": "QuantitativeValue",
            value: "1",
            unitCode: "ANN",
          },
        },
        name: "Premium Annual",
        description: "Unlimited tracking, Theft Shield, priority risk scoring",
      },
    ],
    downloadUrl: BRAND.appStoreUrl,
    installUrl: BRAND.appStoreUrl,
    screenshot: `${BRAND.url}/screenshots/home.png`,
    softwareVersion: "2.0",
    releaseNotes: `${BRAND.url}/changelog`,
    publisher: {
      "@id": `${BRAND.url}/#organization`,
    },
    featureList: [
      "Real-time porch risk scoring (0–100 scale)",
      "Theft Shield alerts when risk exceeds threshold",
      "Live package tracking for 1,400+ carriers",
      "Neighborhood theft alert map",
      "Porch Partner neighbor network",
      "Family plan for up to 5 household members",
      "HOA plan for up to 250 households",
      "Delivery window risk analysis",
      "Push notifications for high-risk events",
    ],
  };
}

// ─── WebPage ──────────────────────────────────────────────────────────────────

export interface WebPageSchemaOptions {
  name: string;
  description: string;
  url: string;
  breadcrumbs?: Array<{ name: string; url: string }>;
  dateModified?: string;
}

export function buildWebPageSchema(opts: WebPageSchemaOptions): SchemaObject {
  const base: SchemaObject = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${opts.url}#webpage`,
    url: opts.url,
    name: opts.name,
    description: opts.description,
    isPartOf: { "@id": `${BRAND.url}/#website` },
    publisher: { "@id": `${BRAND.url}/#organization` },
  };
  if (opts.dateModified) {
    base.dateModified = opts.dateModified;
  }
  return base;
}

// ─── BreadcrumbList ───────────────────────────────────────────────────────────

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function buildBreadcrumbSchema(items: BreadcrumbItem[]): SchemaObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

// ─── FAQPage ──────────────────────────────────────────────────────────────────

export interface FAQEntry {
  question: string;
  answer: string;
}

export function buildFAQSchema(faqs: FAQEntry[]): SchemaObject {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

// ─── Article / TechArticle (for changelog entries) ────────────────────────────

export interface ArticleSchemaOptions {
  headline: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified?: string;
}

export function buildArticleSchema(opts: ArticleSchemaOptions): SchemaObject {
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "@id": `${opts.url}#article`,
    headline: opts.headline,
    description: opts.description,
    url: opts.url,
    datePublished: opts.datePublished,
    dateModified: opts.dateModified ?? opts.datePublished,
    publisher: { "@id": `${BRAND.url}/#organization` },
    author: { "@id": `${BRAND.url}/#organization` },
    isPartOf: { "@id": `${BRAND.url}/#website` },
  };
}

// ─── Product (for pricing page) ───────────────────────────────────────────────

export function buildProductSchema(): SchemaObject {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${BRAND.url}/pricing#product`,
    name: "Porchivo Premium",
    description:
      "Unlimited package tracking, real-time porch risk scores, Theft Shield alerts, and neighborhood alert access.",
    brand: {
      "@type": "Brand",
      name: BRAND.name,
    },
    offers: [
      {
        "@type": "Offer",
        name: "Premium Monthly",
        price: "9.99",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: `${BRAND.url}/pricing`,
        priceValidUntil: "2027-01-01",
      },
      {
        "@type": "Offer",
        name: "Premium Annual",
        price: "79.99",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: `${BRAND.url}/pricing`,
        priceValidUntil: "2027-01-01",
      },
      {
        "@type": "Offer",
        name: "Family Monthly",
        price: "14.99",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: `${BRAND.url}/pricing`,
        priceValidUntil: "2027-01-01",
      },
    ],
  };
}

/** Serialize one or more schema objects to a <script type="application/ld+json"> string */
export function serializeSchema(schemas: SchemaObject | SchemaObject[]): string {
  const payload = Array.isArray(schemas) ? schemas : [schemas];
  return JSON.stringify(payload.length === 1 ? payload[0] : payload, null, 2);
}
