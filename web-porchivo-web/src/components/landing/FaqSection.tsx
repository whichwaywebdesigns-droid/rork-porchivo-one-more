import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import Reveal from "@/components/landing/Reveal";

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Does Porchivo require cameras or hardware installed in our community?",
    answer:
      "No. Porchivo is a software platform — there's no hardware to buy, no installation, and no IT project for your team. Residents use the phones they already have, and managers get a web dashboard. Most communities are fully registered and protecting deliveries in under five minutes.",
  },
  {
    question: "How does package risk scoring actually work?",
    answer:
      "Every incoming delivery is scored in real time based on timing patterns, neighborhood theft activity, and your community's delivery history. Packages crossing a risk threshold trigger instant alerts to the resident and nearby Porch Partners — trusted neighbors who've opted in to receive and hold deliveries safely. Every handoff is logged with a full chain-of-custody record.",
  },
  {
    question: "What is a Porch Partner, and how do residents become one?",
    answer:
      "Porch Partners are residents who opt in to receive packages for neighbors when risk is high or no one's home. Partners earn extra income per secure handoff and build a neighborhood reputation score. It's opt-in only — no resident is ever obligated, and your board controls whether the network is enabled for your community.",
  },
  {
    question: "How do our residents get started?",
    answer:
      "Residents download the app and join with your community's invite code — it takes about a minute. They always join free: no in-app purchases, no upsells, no cost to residents ever. Your management team just distributes the invite code through your existing email or resident portal.",
  },
  {
    question: "What does the manager dashboard show?",
    answer:
      "Managers see active risk zones, theft hotspots, delivery congestion patterns, and chain-of-custody records for every protected handoff — plus resident engagement and satisfaction signals that help you spot renewal risk before it becomes a resignation letter. All exportable for board reports.",
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
