import { Quote } from "lucide-react";
import Reveal from "@/components/landing/Reveal";

/** Placeholder testimonials (names + neighborhoods) per the landing spec. */
const TESTIMONIALS = [
  {
    quote:
      "Three stolen packages a month down to zero. Our block actually talks now — Porchivo made it easy.",
    name: "Maya R.",
    neighborhood: "Maple Grove HOA",
  },
  {
    quote:
      "The proof timeline turned a he-said-she-said claim into a five-minute insurance report.",
    name: "Daniel K.",
    neighborhood: "Cedar Ridge",
  },
  {
    quote:
      "I know the second a box hits my porch, even from the office. That peace of mind is everything.",
    name: "Priya S.",
    neighborhood: "Willow Park",
  },
] as const;

/** Social proof: headline plus three short testimonial cards. */
export default function TestimonialsSection() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Trusted on <span className="text-pv-amber">12,000+</span> porches nationwide
          </h2>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((testimonial, index) => (
            <Reveal key={testimonial.name} delay={index * 130}>
              <figure className="h-full rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
                <Quote className="h-6 w-6 text-pv-amber/70" aria-hidden />
                <blockquote className="mt-4 text-sm leading-relaxed text-white/75">
                  "{testimonial.quote}"
                </blockquote>
                <figcaption className="mt-5 border-t border-white/10 pt-4">
                  <div className="font-display font-semibold text-white">{testimonial.name}</div>
                  <div className="text-sm text-white/50">{testimonial.neighborhood}</div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
