import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import Reveal from "@/components/landing/Reveal";

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Does Porchivo require cameras or hardware?",
    answer:
      "No. Porchivo is pure software — no cameras, sensors, gates, or installation crews. Registration takes about five minutes, and risk scoring starts as soon as your residents join. If you already have cameras, Porchivo complements them: cameras record what happened, Porchivo works before it happens.",
  },
  {
    question: "How does risk scoring work?",
    answer:
      "Every incoming package gets a real-time risk score based on timing, neighborhood activity, and theft history. Scores update continuously — so an unclaimed package that looked safe at noon can escalate by evening, and residents and Porch Partners are alerted the moment risk thresholds are crossed.",
  },
  {
    question: "What is a Porch Partner?",
    answer:
      "Porch Partners are trusted neighbors who form a community-held delivery network. They accept handoffs, hold packages safely, and earn extra income while building neighborhood reputation. Every handoff is logged with full chain-of-custody, so managers always know where a package is and who has it.",
  },
  {
    question: "How do residents join?",
    answer:
      "Residents download the app and join with your community's invite code — always free, with full access. There are no in-app purchases, no premium tiers, and no upsells for residents. Free residents are what make the network strong: more members means more Porch Partners and faster responses.",
  },
  {
    question: "What does the manager dashboard show?",
    answer:
      "Managers see active risk zones, theft hotspots, and delivery congestion across the community in real time — plus resident adoption, package volume, and every chain-of-custody record. Community Insights surfaces patterns so you can act on problems before residents report them.",
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
