import SEOHead from "@/components/SEOHead";
import LandingNav from "@/components/landing/LandingNav";
import HeroSection from "@/components/landing/HeroSection";
import ProblemSection from "@/components/landing/ProblemSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import ProofLockerSection from "@/components/landing/ProofLockerSection";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
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

const seo = getPageSEO("home");
// Immersive landing meta title (per redesign spec); description stays the
// established home copy.
const PAGE_TITLE = "Porchivo — Neighborhood Package Protection";

/**
 * Immersive 3D landing page (porchivo.com):
 * Nav → Hero (video + 3D porch-shield) → Problem stats → How It Works
 * → Features → Proof Locker (3D vault) → Testimonials → Pricing → FAQ
 * → Final CTA → Footer.
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
    buildWebPageSchema({ name: PAGE_TITLE, description: seo.description, url: seo.canonical }),
  ];

  return (
    <div className="min-h-screen bg-pv-navy font-body text-white antialiased">
      <SEOHead
        title={PAGE_TITLE}
        description={seo.description}
        canonical={seo.canonical}
        ogTitle={PAGE_TITLE}
        ogDescription={seo.ogDescription}
        schemas={schemas}
      />

      <LandingNav />
      <main>
        <HeroSection />
        <ProblemSection />
        <HowItWorksSection />
        <FeaturesSection />
        <ProofLockerSection />
        <TestimonialsSection />
        <PricingSection />
        <FaqSection />
        <FinalCtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
