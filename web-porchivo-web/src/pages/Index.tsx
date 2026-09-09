import SEOHead from "@/components/SEOHead";
import LandingNav from "@/components/landing/LandingNav";
import HeroSection from "@/components/landing/HeroSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import PricingSection from "@/components/landing/PricingSection";
import FaqSection from "@/components/landing/FaqSection";
import { FinalCtaSection, LandingFooter } from "@/components/landing/FinalCtaFooter";
import { getPageSEO } from "@/config/seo";
import {
  buildWebPageSchema,
  buildOrganizationSchema,
  buildWebSiteSchema,
  buildMobileAppSchema,
} from "@/config/schema";

// B2B meta per spec: title names the category; description is the hero subhead.
const PAGE_TITLE = "Porchivo — Package Security & Resident Retention for Communities";
const PAGE_DESCRIPTION =
  "Real-time package risk scoring, instant alerts to residents and Porch Partners, and a neighbor-held delivery network — with no hardware or IT project required.";
// Canonical URL comes from the shared SEO config; only title/description change.
const seo = getPageSEO("home");

/**
 * Immersive B2B 3D landing page (porchivo.com):
 * Nav → Hero (video + community-shield 3D + stat bar) → How It Works
 * → Features (incl. risk-vault wide card) → Pricing → FAQ → Final CTA → Footer.
 *
 * Self-contained navy design system (pv-* tokens) — independent of the
 * site's light/dark theme. 3D assets and the hero video lazy-load only
 * when their sections approach the viewport (see LazyModelViewer).
 */
export default function IndexPage() {
  const schemas = [
    buildOrganizationSchema(),
    buildWebSiteSchema(),
    buildMobileAppSchema(),
    buildWebPageSchema({ name: PAGE_TITLE, description: PAGE_DESCRIPTION, url: seo.canonical }),
  ];

  return (
    <div className="min-h-screen bg-pv-navy font-body text-white antialiased">
      <SEOHead
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        canonical={seo.canonical}
        ogTitle={PAGE_TITLE}
        ogDescription={PAGE_DESCRIPTION}
        schemas={schemas}
      />

      <LandingNav />
      <main>
        <HeroSection />
        <HowItWorksSection />
        <FeaturesSection />
        <PricingSection />
        <FaqSection />
        <FinalCtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
