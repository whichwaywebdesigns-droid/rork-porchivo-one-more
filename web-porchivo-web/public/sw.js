/*
 * Porchivo service worker — caches ONLY the safe, public app shell.
 *
 * Security posture for shared office computers:
 *  - Authenticated surfaces (/manage, /resident, /app, /settings, …) are never
 *    intercepted — those navigations always hit the network.
 *  - Cross-origin traffic (Supabase, PostHog, Sentry, tracking) is never touched.
 *  - Only static, non-sensitive assets (hashed build bundles, fonts, public
 *    images) and the marketing shell HTML are cached.
 */
const VERSION = "porchivo-shell-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;

const PRECACHE_URLS = [
  "/",
  "/site.webmanifest",
  "/porchivo-pwa-icon-192.png",
  "/porchivo-pwa-icon-512.png",
  "/porchivo-pwa-maskable-192.png",
  "/porchivo-pwa-maskable-512.png",
];

// Any navigation under these paths goes straight to the network — never cached,
// never served from cache. Covers every authenticated/app-state surface.
const NEVER_CACHE_PREFIXES = [
  "/manage",
  "/resident",
  "/app",
  "/settings",
  "/email-preview",
  "/auth-fail",
  "/unsubscribe",
  "/reports",
  "/api/",
];

// Static file extensions safe to serve stale-while-revalidate.
const STATIC_EXTENSIONS = [
  ".css",
  ".js",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".svg",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".json",
  ".txt",
  ".xml",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== ASSET_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Never touch cross-origin traffic (Supabase, PostHog, Sentry, …).
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;
  if (NEVER_CACHE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return; // Network only — no respondWith, no caching.
  }

  // SPA navigations: network-first with cached shell fallback (marketing only).
  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // Hashed build bundles: immutable → cache-first.
  if (path.startsWith("/assets/")) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  // Other public static files (fonts, icons, public images, manifests): SWR.
  if (isStaticAsset(path)) {
    event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
  }
});

function isStaticAsset(path) {
  return STATIC_EXTENSIONS.some((ext) => path.endsWith(ext));
}

async function networkFirstNavigation(request) {
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put("/", fresh.clone());
    }
    return fresh;
  } catch (error) {
    const cache = await caches.open(SHELL_CACHE);
    return (
      (await cache.match("/")) ||
      (await cache.match(request)) ||
      new Response("Offline", { status: 503, statusText: "Offline" })
    );
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok && fresh.type === "basic") {
      await cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (error) {
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((fresh) => {
      if (fresh && fresh.ok && fresh.type === "basic") {
        cache.put(request, fresh.clone());
      }
      return fresh;
    })
    .catch(() => null);
  return cached || (await network) || new Response("Offline", { status: 503 });
}
