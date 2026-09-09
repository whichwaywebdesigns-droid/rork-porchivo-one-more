import { Clock, NotebookPen, FileDown, Lock } from "lucide-react";
import LazyModelViewer from "@/components/landing/LazyModelViewer";
import ModelFallback from "@/components/landing/ModelFallback";
import Reveal from "@/components/landing/Reveal";

const VAULT_MODEL = "/assets/proof-vault.glb";

const BULLETS = [
  {
    icon: Clock,
    title: "Timestamped photo timeline",
    body: "Every delivery and handoff documented automatically, in order, with the time stamped.",
  },
  {
    icon: NotebookPen,
    title: "Incident notes",
    body: "Capture what happened, what's missing, and who saw what — while it's fresh.",
  },
  {
    icon: FileDown,
    title: "Exportable evidence reports",
    body: "One tap exports a clean, organized report for police, carriers, or insurance.",
  },
] as const;

/**
 * Full-width proof-locker showcase: rotating 3D vault on the left,
 * benefit bullets on the right, deep-navy backdrop.
 */
export default function ProofLockerSection() {
  return (
    <section className="relative overflow-hidden border-y border-white/5 bg-pv-navy-900 py-24">
      {/* Volumetric glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 top-1/2 h-[480px] w-[480px] -translate-y-1/2 rounded-full bg-pv-amber/5 blur-3xl"
      />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* 3D vault */}
          <Reveal className="order-2 h-[340px] sm:h-[440px] lg:order-1 lg:h-[520px]">
            <LazyModelViewer
              src={VAULT_MODEL}
              alt="3D model of a secure vault storing delivery proof"
              cameraOrbit="30deg 70deg auto"
              fallback={
                <ModelFallback
                  icon={Lock}
                  label="A secure vault that stores delivery proof"
                  className="h-full w-full"
                />
              }
              className="h-full w-full"
            />
          </Reveal>

          {/* Copy */}
          <div className="order-1 lg:order-2">
            <Reveal>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-pv-electric/30 bg-pv-electric/10 px-4 py-1.5 text-sm font-medium text-pv-electric-light">
                <Lock className="h-4 w-4" aria-hidden />
                Proof Locker
              </div>
              <h2 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
                Proof when something goes sideways.
              </h2>
            </Reveal>

            <div className="mt-10 space-y-6">
              {BULLETS.map((bullet, index) => (
                <Reveal key={bullet.title} delay={index * 120}>
                  <div className="flex gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-pv-amber/25 bg-pv-amber/10">
                      <bullet.icon className="h-5 w-5 text-pv-amber" aria-hidden />
                    </div>
                    <div>
                      <h3 className="font-display font-semibold text-white">{bullet.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-white/60">{bullet.body}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
