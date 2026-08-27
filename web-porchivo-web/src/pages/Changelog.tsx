import PageLayout from "@/components/PageLayout";
import SEOHead from "@/components/SEOHead";
import BreadcrumbNav from "@/components/BreadcrumbNav";
import { getPageSEO } from "@/config/seo";
import { buildWebPageSchema, buildBreadcrumbSchema, buildArticleSchema } from "@/config/schema";
import { BRAND } from "@/config/brand";
import { CHANGELOG, CHANGE_TYPE_LABELS, CHANGE_TYPE_COLORS } from "@/content/changelog";

const seo = getPageSEO("changelog");

export default function ChangelogPage() {
  const schemas = [
    buildWebPageSchema({ name: seo.title, description: seo.description, url: seo.canonical }),
    buildBreadcrumbSchema([{ name: "Home", url: BRAND.url }, { name: "Changelog", url: seo.canonical }]),
    ...CHANGELOG.map((entry) =>
      buildArticleSchema({
        headline: `Porchivo ${entry.version} — ${entry.title}`,
        description: entry.summary,
        url: `${seo.canonical}#${entry.version}`,
        datePublished: entry.date,
        dateModified: entry.date,
      })
    ),
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

      {/* Header */}
      <section className="pt-16 pb-16 px-4 sm:px-6 border-b border-brand-navy-500/40">
        <div className="max-w-3xl mx-auto">
          <BreadcrumbNav items={[{ label: "Home", href: "/" }, { label: "Changelog", href: "/changelog" }]} />
          <div className="mt-8">
            <h1 className="text-4xl sm:text-5xl font-bold text-brand-text-primary mb-4">Changelog</h1>
            <p className="text-xl text-brand-text-secondary">
              Every Porchivo update, in reverse chronological order.
            </p>
          </div>
        </div>
      </section>

      {/* Entries */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[11px] top-2 bottom-0 w-px bg-brand-navy-700 hidden sm:block" />

          <div className="space-y-14">
            {CHANGELOG.map((entry) => (
              <article
                key={entry.version}
                id={entry.version}
                className="sm:pl-10 scroll-mt-20 relative"
              >
                {/* Timeline dot */}
                <div className="hidden sm:block absolute left-0 top-1.5 w-[23px] h-[23px] rounded-full bg-brand-navy-700 border-2 border-brand-orange/50 flex-shrink-0" />

                {/* Version + date */}
                <div className="flex flex-wrap items-baseline gap-3 mb-3">
                  <span className="text-lg font-bold text-brand-orange font-mono">
                    v{entry.version}
                  </span>
                  <span className="text-sm text-brand-text-muted">{entry.date}</span>
                </div>

                <h2 className="text-xl font-bold text-brand-text-primary mb-2">{entry.title}</h2>
                <p className="text-brand-text-secondary text-sm leading-relaxed mb-5">{entry.summary}</p>

                {/* Changes */}
                <div className="space-y-2">
                  {entry.changes.map((change, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <span
                        className={`inline-flex flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold mt-0.5 ${
                          CHANGE_TYPE_COLORS[change.type]
                        }`}
                      >
                        {CHANGE_TYPE_LABELS[change.type]}
                      </span>
                      <p className="text-sm text-brand-text-secondary leading-relaxed">{change.description}</p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
