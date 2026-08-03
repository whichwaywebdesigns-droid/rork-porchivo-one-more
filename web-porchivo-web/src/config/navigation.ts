/**
 * Porchivo — Navigation Config
 *
 * All site navigation defined here. Update this file to add/remove nav items.
 * Components import from here — never hardcode nav links in components.
 */

export interface NavItem {
  label: string;
  href: string;
  /** Short description — shown under label in mobile menu and nav tooltips */
  description?: string;
  /** If true, opens in new tab */
  external?: boolean;
  /** If true, shown only in footer not header */
  footerOnly?: boolean;
  /** If true, shown only in header not footer */
  headerOnly?: boolean;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

/** Primary header navigation — ordered for senior discoverability */
export const PRIMARY_NAV: NavItem[] = [
  {
    label: "How It Works",
    href: "/#how-it-works",
    description: "See exactly how Porchivo protects your deliveries, step by step",
  },
  {
    label: "Features",
    href: "/features",
    description: "Every tool Porchivo gives you to stop porch theft",
  },
  {
    label: "Pricing",
    href: "/pricing",
    description: "Free to start. Upgrade when you need more protection",
  },
];

/** Footer navigation sections */
export const FOOTER_NAV: NavSection[] = [
  {
    label: "Product",
    items: [
      { label: "Features", href: "/features" },
      { label: "Pricing", href: "/pricing" },
      { label: "Use Cases", href: "/use-cases" },
      { label: "Changelog", href: "/changelog" },
    ],
  },
  {
    label: "Company",
    items: [
      { label: "About", href: "/about" },
      { label: "FAQ", href: "/faq" },
      { label: "Field Guide", href: "/guide" },
      { label: "Download", href: "/download" },
      { label: "Settings", href: "/settings" },
    ],
  },
  {
    label: "Legal & Trust",
    items: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Security", href: "/privacy#security" },
    ],
  },
  {
    label: "Developers & AI",
    items: [
      { label: "For AI Agents", href: "/for-agents" },
      { label: "llms.txt", href: "/llms.txt", external: true },
      { label: "Sitemap", href: "/sitemap.xml", external: true },
    ],
  },
];

/** Breadcrumb builder — call with current page info */
export function buildBreadcrumbs(
  ...crumbs: Array<{ label: string; href: string }>
): Array<{ label: string; href: string }> {
  return [{ label: "Home", href: "/" }, ...crumbs];
}

/** All canonical pages for sitemap generation */
export const SITEMAP_PAGES = [
  { path: "/", priority: 1.0, changefreq: "weekly" },
  { path: "/features", priority: 0.9, changefreq: "monthly" },
  { path: "/pricing", priority: 0.9, changefreq: "monthly" },
  { path: "/use-cases", priority: 0.8, changefreq: "monthly" },
  { path: "/about", priority: 0.7, changefreq: "monthly" },
  { path: "/faq", priority: 0.8, changefreq: "monthly" },
  { path: "/guide", priority: 0.7, changefreq: "monthly" },
  { path: "/changelog", priority: 0.6, changefreq: "weekly" },
  { path: "/download", priority: 0.9, changefreq: "monthly" },
  { path: "/for-agents", priority: 0.7, changefreq: "monthly" },
  { path: "/privacy", priority: 0.5, changefreq: "yearly" },
  { path: "/terms", priority: 0.5, changefreq: "yearly" },
] as const;
