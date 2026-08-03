import { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";

/**
 * Floating "Back to top" button — appears after 500px of scroll.
 * High-contrast orange to ensure visibility for low-vision users.
 * Provides a 48×48px touch target (WCAG 2.5.5 recommended).
 */
export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 500);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <button
      onClick={scrollToTop}
      aria-label="Back to top of page"
      className={`fixed bottom-6 right-6 z-40 w-12 h-12 rounded-2xl
        btn-orange text-white shadow-2xl
        flex items-center justify-center
        transition-all duration-300 ease-out
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy-900
        ${visible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-4 pointer-events-none"
        }`}
    >
      <ArrowUp className="w-5 h-5" strokeWidth={2.5} />
    </button>
  );
}
