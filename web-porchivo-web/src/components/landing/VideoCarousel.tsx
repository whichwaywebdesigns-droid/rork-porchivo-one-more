import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import Reveal from "@/components/landing/Reveal";

type CarouselVideo = {
  /** YouTube video id */
  id: string;
  /** Vertical (Shorts) videos render in a centered 9:16 stage */
  vertical: boolean;
};

const VIDEOS: CarouselVideo[] = [
  { id: "Ct7ihuOMXk", vertical: false },
  { id: "WYgMACEgrd8", vertical: true },
  { id: "LE6PIjZypDY", vertical: true },
];

/**
 * Simple YouTube video carousel for the landing page (channel videos).
 * Embeds are click-to-play — nothing is fetched from YouTube until the
 * visitor taps play, so the section costs one thumbnail per video.
 * All copy is i18n-managed (see `landing.videos.*` in locales.ts).
 */
export default function VideoCarousel() {
  const { t } = useTranslation();
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);

  const video = VIDEOS[active];
  if (!video) return null;

  const title = t(`landing.videos.v${active + 1}.title`);
  const description = t(`landing.videos.v${active + 1}.desc`);

  const goTo = useCallback((index: number) => {
    setPlaying(false);
    setActive(((index % VIDEOS.length) + VIDEOS.length) % VIDEOS.length);
  }, []);

  const stage = video.vertical
    ? "mx-auto aspect-[9/16] w-full max-w-[320px]"
    : "aspect-video w-full";

  return (
    <section
      id="videos"
      aria-label={t("landing.videos.sectionAria")}
      className="relative overflow-hidden border-t border-white/5 py-24 sm:py-28"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[360px] w-[780px] max-w-full -translate-x-1/2 rounded-full bg-pv-amber/5 blur-3xl"
      />
      <div className="relative mx-auto max-w-5xl px-4 sm:px-6">
        <Reveal className="text-center">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-pv-amber">
            {t("landing.videos.eyebrow")}
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-white sm:text-5xl">
            {t("landing.videos.title1")}{" "}
            <span className="bg-gradient-to-r from-pv-amber to-pv-electric bg-clip-text text-transparent">
              {t("landing.videos.title2")}
            </span>
          </h2>
        </Reveal>

        <Reveal className="mt-12" delay={0.1}>
          <div className="relative">
            <div
              className={`overflow-hidden rounded-2xl border border-white/10 bg-pv-navy-900 shadow-2xl shadow-black/40 ${stage}`}
            >
              {playing ? (
                <iframe
                  key={video.id}
                  className="h-full w-full"
                  src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0&modestbranding=1`}
                  title={title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setPlaying(true)}
                  className="group relative block h-full w-full cursor-pointer"
                  aria-label={t("landing.videos.play", { title })}
                >
                  <img
                    src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  <span className="absolute inset-0 bg-pv-navy/30 transition-colors group-hover:bg-pv-navy/10" />
                  <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-pv-amber text-pv-navy shadow-lg transition-transform duration-300 group-hover:scale-110">
                    <Play className="ml-0.5 h-7 w-7 fill-current" aria-hidden />
                  </span>
                </button>
              )}
            </div>

            {/* Controls */}
            <div className="mt-6 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => goTo(active - 1)}
                aria-label={t("landing.videos.prev")}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/80 transition-colors hover:border-pv-amber/50 hover:text-pv-amber"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </button>
              <div className="flex items-center gap-2.5">
                {VIDEOS.map((v, i) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => goTo(i)}
                    aria-label={t("landing.videos.goTo", { index: i + 1 })}
                    aria-current={i === active}
                    className={`h-2.5 rounded-full transition-all duration-300 ${
                      i === active
                        ? "w-8 bg-pv-amber"
                        : "w-2.5 bg-white/25 hover:bg-white/50"
                    }`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => goTo(active + 1)}
                aria-label={t("landing.videos.next")}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/80 transition-colors hover:border-pv-amber/50 hover:text-pv-amber"
              >
                <ChevronRight className="h-5 w-5" aria-hidden />
              </button>
            </div>
          </div>
        </Reveal>

        {/* Descriptor */}
        <Reveal className="mx-auto mt-8 max-w-2xl text-center" delay={0.15}>
          <h3 className="font-display text-lg font-bold text-white sm:text-xl">
            {title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-white/60 sm:text-base">
            {description}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
