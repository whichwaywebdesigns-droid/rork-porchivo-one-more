import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import Reveal from "@/components/landing/Reveal";

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Is my data private? Who can see my deliveries?",
    answer:
      "Only you and the neighbors you explicitly invite. Your deliveries, photos, and proof locker are private to your home and your trusted circle — never public, never sold, and no ads. You can export or delete your data anytime.",
  },
  {
    question: "How do delivery alerts work?",
    answer:
      "Porchivo watches your home zone and follows carrier activity, so you know the moment a package lands, lingers longer than usual, or needs attention. Alerts go to you — and to the neighbors you choose.",
  },
  {
    question: "How do neighbor invites work?",
    answer:
      "Invite the neighbors you trust by name or email. They only see what you share — like pickup requests or porch-watch alerts — and you can remove them from your circle anytime. Every handoff is logged with full chain-of-custody.",
  },
  {
    question: "What happens if a package goes missing?",
    answer:
      "Open your proof locker: every delivery is documented with a timestamped photo timeline and notes. Export an evidence report in one tap for carriers, police, or insurance — Porchivo organizes the proof so you don't have to.",
  },
  {
    question: "Does Porchivo replace my doorbell camera?",
    answer:
      "No — it completes it. A camera records a theft after it happens. Porchivo works before that, with risk-aware alerts, trusted neighbors who can step in, and documentation that makes recovery painless.",
  },
];

/**
 * FAQ accordion — keyboard-navigable (native buttons, aria-expanded,
 * aria-controls + labelled regions) with a smooth grid-rows height animation.
 */
export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const uid = useId();

  return (
    <section id="faq" className="scroll-mt-24 py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center">
          <h2 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Questions, answered
          </h2>
        </Reveal>

        <div className="mt-12 space-y-3">
          {FAQ_ITEMS.map((item, index) => {
            const open = openIndex === index;
            const buttonId = `${uid}-faq-btn-${index}`;
            const panelId = `${uid}-faq-panel-${index}`;

            return (
              <Reveal key={item.question} delay={index * 80}>
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl">
                  <button
                    type="button"
                    id={buttonId}
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => setOpenIndex(open ? null : index)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-display font-semibold text-white transition-colors hover:bg-white/[0.03]"
                  >
                    {item.question}
                    <ChevronDown
                      className={`h-5 w-5 shrink-0 text-pv-amber transition-transform duration-300 ${
                        open ? "rotate-180" : ""
                      }`}
                      aria-hidden
                    />
                  </button>
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    className={`grid transition-all duration-300 ease-out ${
                      open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="px-5 pb-5 text-sm leading-relaxed text-white/65">
                        {item.answer}
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
