/**
 * SEOHead — Dynamic meta tag manager
 *
 * Updates document <head> meta tags for each page.
 * Injects JSON-LD structured data as <script> blocks.
 *
 * Note: For full crawler indexability in production, pair this with
 * a static prerenderer (e.g. vite-plugin-prerender or Netlify prerender)
 * so bots receive pre-populated meta tags.
 */

import { useEffect } from "react";
import type { SchemaObject } from "@/config/schema";
import { serializeSchema } from "@/config/schema";

interface SEOHeadProps {
  title: string;
  description: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterCard?: "summary" | "summary_large_image";
  robots?: string;
  schemas?: SchemaObject | SchemaObject[];
}

function setMeta(name: string, content: string, attr: "name" | "property" = "name"): void {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLink(rel: string, href: string): void {
  let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function injectSchema(schemas: SchemaObject | SchemaObject[]): HTMLScriptElement {
  const existing = document.querySelector<HTMLScriptElement>(
    'script[type="application/ld+json"][data-porchivo]'
  );
  if (existing) existing.remove();

  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.setAttribute("data-porchivo", "true");
  script.textContent = serializeSchema(schemas);
  document.head.appendChild(script);
  return script;
}

/** Hook that manages all <head> meta for a given page. */
export function usePageSEO(props: SEOHeadProps): void {
  const {
    title,
    description,
    canonical,
    ogTitle,
    ogDescription,
    ogImage = "https://porchivo.com/og-image.png",
    twitterCard = "summary_large_image",
    robots = "index, follow",
    schemas,
  } = props;

  useEffect(() => {
    document.title = title;
    setMeta("description", description);
    setMeta("robots", robots);

    // Open Graph
    setMeta("og:title", ogTitle ?? title, "property");
    setMeta("og:description", ogDescription ?? description, "property");
    setMeta("og:type", "website", "property");
    if (ogImage) setMeta("og:image", ogImage, "property");
    if (canonical) setMeta("og:url", canonical, "property");

    // Twitter
    setMeta("twitter:card", twitterCard);
    setMeta("twitter:title", ogTitle ?? title);
    setMeta("twitter:description", ogDescription ?? description);
    if (ogImage) setMeta("twitter:image", ogImage);
    setMeta("twitter:site", "@porchivo");

    // Canonical
    if (canonical) setLink("canonical", canonical);

    // JSON-LD
    let script: HTMLScriptElement | undefined;
    if (schemas) {
      script = injectSchema(schemas);
    }

    return () => {
      if (script && script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [title, description, canonical, ogTitle, ogDescription, ogImage, twitterCard, robots, schemas]);
}

/** Invisible component wrapper — renders nothing, manages head as side effect. */
export default function SEOHead(props: SEOHeadProps): null {
  usePageSEO(props);
  return null;
}
