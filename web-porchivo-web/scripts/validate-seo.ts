/**
 * SEO crawler-readiness validator for the Porchivo web site.
 *
 * Verifies — from a crawler's point of view — that the homepage hero stats
 * and OG/Twitter tags are correctly structured, plus the supporting surface
 * crawlers rely on (canonical, JSON-LD, robots.txt, sitemap.xml, OG asset).
 *
 * Two layers:
 *  1. Static crawler-view checks (always run, no auth): fetches the rendered
 *     HTML and asserts the prerendered hero stat values, OG/Twitter tags,
 *     canonical URL, parseable JSON-LD, robots/sitemap host consistency, and
 *     that the OG image asset is reachable with the expected byte size.
 *  2. Google Search Console API (opt-in): when GSC_ACCESS_TOKEN is set, calls
 *     the URL Inspection API (which returns the Rich Results Test verdict)
 *     for the official indexability + rich-results result. The token's
 *     account must have Search Console access to the property. Quota: 2,000
 *     queries/day.
 *
 * Usage:
 *   bun scripts/validate-seo.ts
 *   BASE_URL=https://itw0s622ahx9uel9v4pjt-web-porchivo-web.rork.live bun scripts/validate-seo.ts
 *   GSC_ACCESS_TOKEN=ya29.... bun scripts/validate-seo.ts   # + GSC API verdict
 *
 * Exit code 0 = all checks passed, 1 = one or more failures.
 */

/** Where crawlers must see content live. TAG/asset expectations are always
 * canonical-host-based, so mirrors (e.g. the rork.live preview) can be
 * validated too — they serve the same canonical-tagged HTML. */
const CANONICAL_BASE_URL = "https://www.porchivo.com";
const DEFAULT_BASE_URL = CANONICAL_BASE_URL;
const OG_IMAGE_PATH = "/og-image-v2.png";
/** 1200x630 compressed OG image — bump if the asset is regenerated. */
const EXPECTED_OG_IMAGE_BYTES = 315002;
/** Prerendered hero stat bar: final rendered values, e.g. `58M`. */
const HERO_STATS = ["58M", "25%", "5 min"] as const;
/** Live zeros mean a crawler saw the pre-hydration counter state. */
const HERO_ZERO_PATTERNS = ["0M", "0%", "0 min"] as const;
const GSC_INSPECT_ENDPOINT =
  "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";

interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

interface AssetHead {
  status: number;
  contentType: string;
  contentLength: number | null;
}

interface JsonLdExtraction {
  blocks: unknown[];
  parseErrors: string[];
}

interface UrlInspectionResponse {
  inspectionResult?: {
    indexStatusResult?: {
      verdict?: string;
      robotsTxtState?: string;
      indexingState?: string;
      pageFetchState?: string;
      userCanonical?: string;
    };
    richResultsResult?: {
      verdict?: string;
      detectedItems?: Array<{ richResultType: string; items: unknown[] }>;
    };
  };
}

const results: CheckResult[] = [];

function record(name: string, ok: boolean, detail: string): void {
  results.push({ name, ok, detail });
}

function normalizeBaseUrl(raw: string): string {
  return raw.replace(/\/+$/, "");
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(20_000),
    headers: { "user-agent": "porchivo-seo-validator/1.0" },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.text();
}

async function fetchHead(url: string): Promise<AssetHead> {
  const response = await fetch(url, {
    method: "HEAD",
    signal: AbortSignal.timeout(20_000),
  });
  return {
    status: response.status,
    contentType: response.headers.get("content-type") ?? "",
    contentLength: response.headers.has("content-length")
      ? Number(response.headers.get("content-length"))
      : null,
  };
}

/** Collects og:*, twitter:*, and <meta name="..."> tags into one lookup. */
function extractMetaTags(html: string): Map<string, string> {
  const tags = new Map<string, string>();
  const pattern =
    /<meta\s+[^>]*?(?:property|name)=["']([^"']+)["'][^>]*?content=["']([^"']*)["'][^>]*>/gi;
  let match: RegExpExecArray | null = pattern.exec(html);
  while (match !== null) {
    tags.set(match[1].toLowerCase(), match[2]);
    match = pattern.exec(html);
  }
  return tags;
}

function extractJsonLd(html: string): JsonLdExtraction {
  const blocks: unknown[] = [];
  const parseErrors: string[] = [];
  const pattern =
    /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null = pattern.exec(html);
  let index = 0;
  while (match !== null) {
    try {
      blocks.push(JSON.parse(match[1]) as unknown);
    } catch (error) {
      parseErrors.push(`block ${index}: ${error instanceof Error ? error.message : "unparseable"}`);
    }
    index += 1;
    match = pattern.exec(html);
  }
  return { blocks, parseErrors };
}

function collectTypes(node: unknown, into: Set<string>): void {
  if (Array.isArray(node)) {
    node.forEach((child) => collectTypes(child, into));
    return;
  }
  if (typeof node === "object" && node !== null && "@type" in node) {
    const types = (node as { "@type": unknown })["@type"];
    if (typeof types === "string") into.add(types);
    if (Array.isArray(types)) types.forEach((t) => typeof t === "string" && into.add(t));
  }
  if (typeof node === "object" && node !== null && "@graph" in node) {
    collectTypes((node as { "@graph": unknown })["@graph"], into);
  }
}

/** True when the value appears as rendered text between tags (any whitespace). */
function rendersAsText(html: string, value: string): boolean {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`>\\s*${escaped}\\s*<`).test(html);
}

async function validateHeroStats(base: string): Promise<void> {
  const html = await fetchText(`${base}/`);

  for (const stat of HERO_STATS) {
    const found = rendersAsText(html, stat);
    record(
      `hero stat renders server-side: ${stat}`,
      found,
      found ? "present in prerendered HTML" : "missing — crawler sees no final value",
    );
  }

  for (const zero of HERO_ZERO_PATTERNS) {
    const found = rendersAsText(html, zero);
    record(
      `no live zero for ${zero}`,
      !found,
      found ? "crawler sees a 0 value — counter initialized before hydration" : "clean",
    );
  }
}

async function validateOgTags(base: string, html: string): Promise<void> {
  const tags = extractMetaTags(html);
  const expectedOgImage = `${CANONICAL_BASE_URL}${OG_IMAGE_PATH}`;

  const required = [
    { key: "og:title", expectPresent: true },
    { key: "og:description", expectPresent: true },
    { key: "og:type", expectValue: "website" },
    { key: "og:url", expectValue: `${CANONICAL_BASE_URL}/` },
    { key: "og:image", expectValue: expectedOgImage },
    { key: "twitter:card", expectValue: "summary_large_image" },
    { key: "twitter:image", expectValue: expectedOgImage },
  ] as const;

  for (const requirement of required) {
    const actual = tags.get(requirement.key);
    if ("expectValue" in requirement) {
      const ok = actual === requirement.expectValue;
      record(
        `meta ${requirement.key}`,
        ok,
        ok ? actual ?? "" : `expected "${requirement.expectValue}", got "${actual ?? "MISSING"}"`,
      );
    } else {
      const ok = typeof actual === "string" && actual.length > 0;
      record(
        `meta ${requirement.key}`,
        ok,
        ok ? `${actual!.slice(0, 80)}…` : "missing or empty",
      );
    }
  }

  // Every crawler-referenced asset URL must be absolute (relative og:image is
  // ignored by Facebook/LinkedIn scrapers).
  for (const key of ["og:image", "twitter:image", "og:url"]) {
    const value = tags.get(key) ?? "";
    const ok = value.startsWith("https://");
    record(
      `${key} is absolute https`,
      ok,
      ok ? "absolute" : `"${value}" is relative or non-https`,
    );
  }

  const canonical = /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i.exec(html)?.[1];
  record(
    "canonical tag",
    canonical === `${CANONICAL_BASE_URL}/`,
    canonical === `${CANONICAL_BASE_URL}/` ? `${canonical}` : `expected "${CANONICAL_BASE_URL}/", got "${canonical ?? "MISSING"}"`,
  );

  const { blocks, parseErrors } = extractJsonLd(html);
  record(
    "JSON-LD blocks parse",
    parseErrors.length === 0 && blocks.length > 0,
    parseErrors.length > 0
      ? parseErrors.join("; ")
      : `${blocks.length} block(s), all valid JSON`,
  );

  const types = new Set<string>();
  blocks.forEach((block) => collectTypes(block, types));
  record(
    "JSON-LD includes Organization",
    types.has("Organization"),
    types.size > 0 ? `types: ${[...types].sort().join(", ")}` : "no structured data types found",
  );
}

async function validateOgAsset(base: string): Promise<void> {
  const head = await fetchHead(`${base}${OG_IMAGE_PATH}`);
  const okStatus = head.status === 200;
  record("OG image reachable", okStatus, `HTTP ${head.status}`);

  const okType = head.contentType.startsWith("image/");
  record("OG image content-type", okType, head.contentType || "none");

  // Some CDNs omit content-length on HEAD — skip rather than fail those.
  if (head.contentLength === null) {
    record("OG image byte size", true, "content-length not reported — skipped");
  } else {
    const okLength = head.contentLength === EXPECTED_OG_IMAGE_BYTES;
    record(
      "OG image byte size",
      okLength,
      okLength
        ? `${head.contentLength} bytes`
        : `expected ${EXPECTED_OG_IMAGE_BYTES}, got ${head.contentLength}`,
    );
  }
}

async function validateRobotsAndSitemap(base: string): Promise<void> {
  const robots = await fetchText(`${base}/robots.txt`);
  const sitemapLine = `Sitemap: ${CANONICAL_BASE_URL}/sitemap.xml`;
  record(
    "robots.txt declares sitemap",
    robots.includes(sitemapLine),
    robots.includes(sitemapLine) ? sitemapLine : `missing "${sitemapLine}"`,
  );

  const sitemap = await fetchText(`${base}/sitemap.xml`);
  const locs = [...sitemap.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
  const offHost = locs.filter((loc) => !loc.startsWith(`${CANONICAL_BASE_URL}/`));
  record(
    "sitemap URL count and host consistency",
    locs.length > 0 && offHost.length === 0,
    `${locs.length} URL(s)` + (offHost.length > 0 ? `, off-host: ${offHost.slice(0, 3).join(", ")}` : ", all on canonical host"),
  );

  record(
    "sitemap includes homepage",
    locs.includes(`${CANONICAL_BASE_URL}/`),
    locs.includes(`${CANONICAL_BASE_URL}/`) ? "present" : "missing",
  );
}

/**
 * Opt-in official verdict via the Search Console URL Inspection API, which
 * wraps the Rich Results Test result. Requires GSC_ACCESS_TOKEN (OAuth2
 * bearer) whose account can access the property.
 */
async function runGscInspection(base: string): Promise<void> {
  const token = process.env.GSC_ACCESS_TOKEN;
  if (!token) {
    console.log(
      "\nℹ Google Search Console API check skipped — set GSC_ACCESS_TOKEN to run the official URL Inspection / Rich Results verdict.",
    );
    return;
  }

  const origin = new URL(base).origin;
  const response = await fetch(GSC_INSPECT_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      siteUrl: origin,
      pageUrl: `${origin}/`,
      languageCode: "en-US",
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const body = await response.text();
    record(
      "GSC URL Inspection API",
      false,
      `HTTP ${response.status}: ${body.slice(0, 300)}`,
    );
    return;
  }

  const data = (await response.json()) as UrlInspectionResponse;
  const inspection = data.inspectionResult ?? {};

  const index = inspection.indexStatusResult;
  record(
    "GSC index status",
    index?.verdict === "PASS",
    `verdict=${index?.verdict ?? "MISSING"} robotsTxt=${index?.robotsTxtState ?? "?"} indexing=${index?.indexingState ?? "?"}`,
  );

  const rich = inspection.richResultsResult;
  const itemCount =
    rich?.detectedItems?.reduce((sum, entry) => sum + entry.items.length, 0) ?? 0;
  record(
    "GSC rich results verdict",
    rich?.verdict === "PASS" || rich?.verdict === "PARTIAL",
    `verdict=${rich?.verdict ?? "NONE"} detectedItems=${itemCount}`,
  );
}

async function main(): Promise<void> {
  const base = normalizeBaseUrl(process.env.BASE_URL ?? DEFAULT_BASE_URL);
  console.log(`\nPorchivo SEO validator → ${base}\n${"=".repeat(60)}`);

  const html = await fetchText(`${base}/`);

  await validateHeroStats(base);
  await validateOgTags(base, html);
  await validateOgAsset(base);
  await validateRobotsAndSitemap(base);
  await runGscInspection(base);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${"=".repeat(60)}`);
  for (const result of results) {
    console.log(`  ${result.ok ? "✓" : "✗"} ${result.name}${result.detail ? ` — ${result.detail}` : ""}`);
  }
  console.log(
    `\n${results.length - failed.length}/${results.length} checks passed${failed.length > 0 ? ` — FAILED: ${failed.map((f) => f.name).join(", ")}` : ""}\n`,
  );

  if (failed.length > 0) process.exit(1);
}

main().catch((error: unknown) => {
  console.error(
    `\n✗ validator crashed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
