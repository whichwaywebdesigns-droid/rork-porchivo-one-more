import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import SEOHead from "@/components/SEOHead";
import BreadcrumbNav from "@/components/BreadcrumbNav";
import FAQSection from "@/components/FAQSection";
import { getPageSEO } from "@/config/seo";
import { buildWebPageSchema, buildBreadcrumbSchema, buildFAQSchema } from "@/config/schema";
import { BRAND } from "@/config/brand";
import { FAQS, getFAQsByCategory } from "@/content/faqs";

const seo = getPageSEO("faq");

const CATEGORIES: Array<{ id: string; label: string; description: string }> = [
  { id: "risk-score", label: "Risk Score", description: "How porch risk is calculated" },
  { id: "tracking", label: "Package Tracking", description: "Carriers, refresh rates, and limits" },
  { id: "pricing", label: "Pricing & Plans", description: "What's included and how to cancel" },
  { id: "privacy", label: "Privacy & Data", description: "What we collect and your rights" },
  { id: "general", label: "General", description: "Devices, availability, and reporting" },
];

export default function FAQPage() {
  const allFAQsForSchema = FAQS.map((f) => ({ question: f.question, answer: f.answer }));

  const schemas = [
    buildWebPageSchema({ name: seo.title, description: seo.description, url: seo.canonical }),
    buildBreadcrumbSchema([{ name: "Home", url: BRAND.url }, { name: "FAQ", url: seo.canonical }]),
    buildFAQSchema(allFAQsForSchema),
  ];

  return (
    <PageLayout>
      <SEOHead
        title={seo.title}
        description={seo.description}
        canonical={seo.canonical}
        ogTitle={seo.ogTitle}
        ogDescription={seo.ogDescription}
        schemas={schemas}
      />

      {/* Header */}
      <section className="pt-16 pb-16 px-4 sm:px-6 border-b border-slate-800">
        <div className="max-w-3xl mx-auto">
          <BreadcrumbNav items={[{ label: "Home", href: "/" }, { label: "FAQ", href: "/faq" }]} />
          <div className="mt-8">
            <h1 className="text-4xl sm:text-5xl font-bold text-slate-100 mb-4">
              Frequently asked questions
            </h1>
            <p className="text-xl text-slate-400">
              Everything you need to know about Porchivo, the risk score, tracking, pricing, and privacy.
            </p>
          </div>
        </div>
      </section>

      {/* Category nav */}
      <section className="py-8 px-4 sm:px-6 border-b border-slate-800">
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <a
                key={cat.id}
                href={`#${cat.id}`}
                className="px-3.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-600 text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                {cat.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ sections by category */}
      <div className="max-w-3xl mx-auto">
        {CATEGORIES.map((cat) => {
          const categoryFAQs = getFAQsByCategory(cat.id as Parameters<typeof getFAQsByCategory>[0]);
          if (categoryFAQs.length === 0) return null;

          return (
            <section key={cat.id} id={cat.id} className="scroll-mt-20 border-b border-slate-800">
              <div className="px-4 sm:px-6 pt-12 pb-2">
                <h2 className="text-xl font-bold text-slate-100">{cat.label}</h2>
                <p className="text-sm text-slate-500 mt-1">{cat.description}</p>
              </div>
              <FAQSection faqs={categoryFAQs} />
            </section>
          );
        })}
      </div>

      {/* Still need help */}
      <section className="py-16 px-4 sm:px-6 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-100 mb-3">Still have a question?</h2>
          <p className="text-slate-400 mb-6 text-sm">
            Our support team responds within 24 hours on business days.
          </p>
          <a
            href={`mailto:${BRAND.supportEmail}`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm transition-colors"
          >
            Email {BRAND.supportEmail}
            <ChevronRight className="w-4 h-4" />
          </a>
          <div className="mt-8 pt-8 border-t border-slate-800">
            <p className="text-xs text-slate-600 mb-3">Related resources</p>
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <Link to="/features" className="text-amber-400 hover:text-amber-300 transition-colors">Features</Link>
              <Link to="/pricing" className="text-amber-400 hover:text-amber-300 transition-colors">Pricing</Link>
              <Link to="/privacy" className="text-amber-400 hover:text-amber-300 transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="text-amber-400 hover:text-amber-300 transition-colors">Terms of Service</Link>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
