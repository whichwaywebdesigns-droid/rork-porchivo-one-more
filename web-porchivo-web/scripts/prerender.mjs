/**
 * Build-time prerender.
 *
 * Runs after `vite build`. Uses Vite's SSR module loader to render every
 * public route (see prerender/entry.tsx) to static HTML, then writes
 * dist/<route>/index.html with:
 *   - per-route <title>, description, canonical, OG/Twitter meta, robots
 *   - the fully rendered page markup inside #root
 *
 * Bots and AI crawlers receive real content; the SPA hydrates over it
 * (createRoot().render() replaces the prerendered DOM on mount).
 *
 * Vercel serves the filesystem first, so /features -> dist/features/index.html;
 * the SPA catch-all rewrite only kicks in for non-prerendered paths.
 */
import { createServer } from "vite";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const distDir = path.join(root, "dist");
const template = await readFile(path.join(distDir, "index.html"), "utf8");

const escapeAttr = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function patchHead(html, meta) {
  let out = html;
  out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeAttr(meta.title)}</title>`);
  out = out.replace(
    /<meta name="description" content="[\s\S]*?"/,
    `<meta name="description" content="${escapeAttr(meta.description)}"`,
  );
  out = out.replace(
    /<link rel="canonical" href="[^"]*"/,
    `<link rel="canonical" href="${escapeAttr(meta.canonical)}"`,
  );
  out = out.replace(
    /<meta property="og:title" content="[\s\S]*?"/,
    `<meta property="og:title" content="${escapeAttr(meta.title)}"`,
  );
  out = out.replace(
    /<meta property="og:description" content="[\s\S]*?"/,
    `<meta property="og:description" content="${escapeAttr(meta.description)}"`,
  );
  out = out.replace(
    /<meta property="og:url" content="[^"]*"/,
    `<meta property="og:url" content="${escapeAttr(meta.canonical)}"`,
  );
  out = out.replace(
    /<meta name="twitter:title" content="[\s\S]*?"/,
    `<meta name="twitter:title" content="${escapeAttr(meta.title)}"`,
  );
  out = out.replace(
    /<meta name="twitter:description" content="[\s\S]*?"/,
    `<meta name="twitter:description" content="${escapeAttr(meta.description)}"`,
  );
  if (meta.robots) {
    if (/<meta name="robots" content="[^"]*"/.test(out)) {
      out = out.replace(
        /<meta name="robots" content="[^"]*"/,
        `<meta name="robots" content="${escapeAttr(meta.robots)}"`,
      );
    } else {
      out = out.replace(
        /<meta name="description" content="[\s\S]*?"/,
        (match) => `${match}\n    <meta name="robots" content="${escapeAttr(meta.robots)}"`,
      );
    }
  }
  return out;
}

let server;
const rendered = [];
const failed = [];
try {
  server = await createServer({
    root,
    logLevel: "error",
    appType: "custom",
    server: { middlewareMode: true },
  });
  const { ROUTES, renderRoute } = await server.ssrLoadModule("/prerender/entry.tsx");

  for (const route of ROUTES) {
    try {
      const markup = await renderRoute(route);
      if (!markup || markup.trim().length < 200) {
        throw new Error(`suspiciously empty markup (${markup ? markup.length : 0} chars)`);
      }
      const html = patchHead(template, route.meta).replace(
        '<div id="root"></div>',
        `<div id="root">${markup}</div>`,
      );
      const dir = route.path === "/" ? distDir : path.join(distDir, route.path);
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, "index.html"), html);
      rendered.push(route.path);
    } catch (error) {
      failed.push({ path: route.path, error: error instanceof Error ? error.message : String(error) });
    }
  }
} finally {
  if (server) await server.close();
}

console.log(`[prerender] wrote ${rendered.length}/${rendered.length + failed.length} routes`);
if (rendered.length > 0) console.log(`[prerender] ok: ${rendered.join(", ")}`);
if (failed.length > 0) {
  for (const failure of failed) {
    console.error(`[prerender] FAILED ${failure.path}: ${failure.error}`);
  }
  process.exitCode = 1;
}
