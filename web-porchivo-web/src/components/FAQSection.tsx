import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { FAQ } from "@/content/faqs";

interface FAQSectionProps {
  faqs: FAQ[];
  title?: string;
  subtitle?: string;
}

export default function FAQSection({
  faqs,
  title = "Frequently asked questions",
  subtitle,
}: FAQSectionProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section className="py-20 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        {(title || subtitle) && (
          <div className="text-center mb-12">
            {title && (
              <h2 className="text-3xl font-bold text-brand-text-primary mb-3">{title}</h2>
            )}
            {subtitle && (
              <p className="text-brand-text-secondary text-lg">{subtitle}</p>
            )}
          </div>
        )}

        <div className="divide-y divide-brand-navy-500/30">
          {faqs.map((faq) => (
            <div key={faq.id}>
              <button
                onClick={() => setOpenId(openId === faq.id ? null : faq.id)}
                className="w-full flex items-start justify-between gap-4 py-5 text-left group"
                aria-expanded={openId === faq.id}
              >
                <span className="text-base font-medium text-brand-text-secondary group-hover:text-brand-text-primary transition-colors leading-snug">
                  {faq.question}
                </span>
                <ChevronDown
                  className={`w-5 h-5 flex-shrink-0 text-brand-text-muted transition-transform duration-200 mt-0.5 ${
                    openId === faq.id ? "rotate-180 text-brand-blue-light" : ""
                  }`}
                />
              </button>
              {openId === faq.id && (
                <div className="pb-5">
                  <p className="text-brand-text-muted text-sm leading-relaxed">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
