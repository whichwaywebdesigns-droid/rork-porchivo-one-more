import { useEffect, useState, useCallback, useMemo, Fragment } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, BookOpen, Lightbulb } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import SEOHead from "@/components/SEOHead";
import BreadcrumbNav from "@/components/BreadcrumbNav";
import { getPageSEO } from "@/config/seo";
import { buildWebPageSchema, buildBreadcrumbSchema } from "@/config/schema";
import { BRAND } from "@/config/brand";
import { FIELD_GUIDE, type ManualBlock } from "@/content/fieldGuide";

const seo = getPageSEO("guide");

/** Renders text with **double-asterisk** segments as bold brand-orange. */
function RichText({ text }: { text: string }) {
  const parts = useMemo(() => text.split(/(\*\*[^*]+\*\*)/g), [text]);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-bold text-brand-orange">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

function Block({ block }: { block: ManualBlock }) {
  if (block.type === "paragraph") {
    return (
      <p className="text-[17px] leading-[1.6] text-brand-text-secondary">
        <RichText text={block.text} />
      </p>
    );
  }

  if (block.type === "tip") {
    return (
      <div className="flex gap-3 rounded-xl border-l-2 border-brand-orange bg-brand-orange/5 px-4 py-3.5">
        <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-orange" />
        <p className="text-[15px] leading-relaxed text-brand-text-secondary">
          <RichText text={block.text} />
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-brand-navy-500/30">
      <table className="w-full text-left text-[15px]">
        <thead>
          <tr className="bg-brand-navy-700">
            {block.headers.map((h) => (
              <th
                key={h}
                className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-brand-text-muted"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, ri) => (
            <tr
              key={ri}
              className={ri % 2 === 0 ? "bg-brand-navy-800/40" : "bg-transparent"}
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={
                    ci === 0
                      ? "px-4 py-2.5 font-medium text-brand-text-primary"
                      : "px-4 py-2.5 text-brand-text-secondary"
                  }
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function GuidePage() {
  const [progress, setProgress] = useState<number>(0);

  const onScroll = useCallback(() => {
    const doc = document.documentElement;
    const scrollable = doc.scrollHeight - doc.clientHeight;
    const pct = scrollable > 0 ? (doc.scrollTop / scrollable) * 100 : 0;
    setProgress(Math.min(100, Math.max(0, pct)));
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  const schemas = [
    buildWebPageSchema({ name: seo.title, description: seo.description, url: seo.canonical }),
    buildBreadcrumbSchema([
      { name: "Home", url: BRAND.url },
      { name: "Field Guide", url: seo.canonical },
    ]),
  ];

  return (
    <PageLayout tape>
      <SEOHead
        title={seo.title}
        description={seo.description}
        canonical={seo.canonical}
        ogTitle={seo.ogTitle}
        ogDescription={seo.ogDescription}
        schemas={schemas}
      />

      {/* Reading progress bar — sticky under the fixed header */}
      <div className="sticky top-[68px] z-30 h-1 w-full bg-brand-navy-700">
        <div
          className="h-full rounded-r-full bg-brand-orange transition-[width] duration-150 ease-out"
          style={{ width: `${progress}%` }}
          aria-hidden
        />
      </div>

      {/* Header */}
      <section className="border-b border-brand-navy-500/30 px-4 pb-14 pt-16 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <BreadcrumbNav
            items={[
              { label: "Home", href: "/" },
              { label: "Field Guide", href: "/guide" },
            ]}
          />
          <div className="mt-8 flex flex-col items-center text-center">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-orange/10 ring-1 ring-brand-orange/20">
              <BookOpen className="h-7 w-7 text-brand-orange" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-brand-text-primary sm:text-5xl">
              The Porchivo Field Guide
            </h1>
            <p className="mt-4 text-xl text-brand-text-secondary">
              Everything you need. Nothing you don&apos;t.
            </p>
            {/* Brand gradient sweep line */}
            <div className="mt-7 h-0.5 w-40 rounded-full bg-gradient-to-r from-brand-orange via-brand-orange/40 to-brand-navy-500" />
          </div>
        </div>
      </section>

      {/* Table of contents */}
      <section className="border-b border-brand-navy-500/30 px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-6 text-[11px] font-semibold uppercase tracking-widest text-brand-text-muted">
            Sections · {FIELD_GUIDE.length}
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {FIELD_GUIDE.map((section, idx) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="group flex items-center gap-4 rounded-xl border border-brand-navy-500/30 bg-brand-navy-800/40 px-4 py-3.5 transition-colors hover:border-brand-orange/40 hover:bg-brand-navy-700/50"
              >
                <span className="w-6 flex-shrink-0 text-lg font-bold text-brand-text-muted">
                  {idx + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-brand-text-primary">
                    {section.title}
                  </span>
                  <span className="block truncate text-sm text-brand-text-muted">
                    {section.teaser}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-brand-text-muted transition-colors group-hover:text-brand-orange" />
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Sections */}
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        {FIELD_GUIDE.map((section, idx) => (
          <section
            key={section.id}
            id={section.id}
            className="scroll-mt-24 border-b border-brand-navy-500/30 py-14 last:border-b-0"
          >
            <div className="relative">
              <span
                className="pointer-events-none absolute -top-6 left-0 select-none text-7xl font-bold text-brand-text-primary/[0.06]"
                aria-hidden
              >
                {String(idx + 1).padStart(2, "0")}
              </span>
              <p className="relative text-[11px] font-semibold uppercase tracking-widest text-brand-orange">
                Section {idx + 1}
              </p>
              <h2 className="relative mt-1.5 text-[22px] font-bold text-brand-text-primary">
                {section.title}
              </h2>
            </div>
            <div className="mt-6 space-y-5">
              {section.blocks.map((block, bi) => (
                <Block key={bi} block={block} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Footer CTA */}
      <section className="px-4 py-16 text-center sm:px-6">
        <div className="mx-auto max-w-xl">
          <h2 className="mb-3 text-2xl font-bold text-brand-text-primary">
            Read it on the go
          </h2>
          <p className="mb-6 text-sm text-brand-text-secondary">
            The full Field Guide lives inside the Porchivo app, with reading progress that
            follows you. Download it free and keep your block protected.
          </p>
          <Link
            to="/download"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-orange px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-orange-light"
          >
            Download Porchivo
            <ChevronRight className="h-4 w-4" />
          </Link>
          <div className="mt-8 border-t border-brand-navy-500/30 pt-8">
            <p className="mb-3 text-xs text-brand-text-muted">Related resources</p>
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <Link to="/features" className="text-brand-orange transition-colors hover:text-brand-orange-light">Features</Link>
              <Link to="/faq" className="text-brand-orange transition-colors hover:text-brand-orange-light">FAQ</Link>
              <Link to="/pricing" className="text-brand-orange transition-colors hover:text-brand-orange-light">Pricing</Link>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
