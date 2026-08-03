import { BRAND } from "@/config/brand";

interface AppStoreBadgesProps {
  orientation?: "row" | "stack";
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: "h-10",
  md: "h-12",
  lg: "h-14",
};

export default function AppStoreBadges({
  orientation = "row",
  size = "md",
}: AppStoreBadgesProps) {
  const h = sizes[size];

  return (
    <div
      className={`flex ${orientation === "stack" ? "flex-col" : "flex-row flex-wrap"} gap-3`}
    >
      {/* Apple App Store */}
      <a
        href={BRAND.appStoreUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Download Porchivo on the App Store"
        className="inline-block hover:opacity-90 transition-opacity"
      >
        <div
          className={`${h} aspect-[3.35/1] bg-brand-navy-700/80 border border-brand-navy-500/60 rounded-xl flex items-center justify-center gap-2.5 px-4 hover:border-brand-blue/40 hover:bg-brand-navy-600/60 transition-all card-lift`}
        >
          {/* Apple glyph */}
          <svg
            className="w-5 h-5 text-brand-text-primary flex-shrink-0"
            viewBox="0 0 814 1000"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.8 0 663.5 0 541.8c0-207.2 123.4-317 245.3-317 61.6 0 112.9 40.8 151.8 40.8 37.4 0 96.1-43.4 165.9-43.4 25.4 0 108.2 2.6 168.1 80.1zm-136.9-91.8c28.8-34.8 49.5-83.1 49.5-131.4 0-6.8-.6-13.6-1.9-20.4-46.8 1.9-101.5 31.3-134.6 70.1-26.1 30-51.6 78.3-51.6 127.3 0 7.4 1.3 14.8 1.9 17.4 3.2.6 8.4 1.3 13.6 1.3 42.2 0 93.5-28.1 123.1-64.3z" />
          </svg>
          <div className="flex flex-col leading-tight">
            <span className="text-[9px] text-brand-text-muted uppercase tracking-wider">Download on the</span>
            <span className="text-sm font-semibold text-brand-text-primary">App Store</span>
          </div>
        </div>
      </a>

      {/* Google Play */}
      <a
        href={BRAND.playStoreUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Get Porchivo on Google Play"
        className="inline-block hover:opacity-90 transition-opacity"
      >
        <div
          className={`${h} aspect-[3.35/1] bg-brand-navy-700/80 border border-brand-navy-500/60 rounded-xl flex items-center justify-center gap-2.5 px-4 hover:border-brand-blue/40 hover:bg-brand-navy-600/60 transition-all card-lift`}
        >
          {/* Play icon glyph */}
          <svg
            className="w-5 h-5 flex-shrink-0"
            viewBox="0 0 512 512"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="gp1" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#00D2FF" />
                <stop offset="100%" stopColor="#3A7BD5" />
              </linearGradient>
              <linearGradient id="gp2" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FF6B35" />
                <stop offset="100%" stopColor="#F7C59F" />
              </linearGradient>
            </defs>
            <path d="M30 0L288 256 30 512c-16.9-8.4-28-25.8-28-46V46C2 25.8 13.1 8.4 30 0z" fill="url(#gp1)" />
            <path d="M382 160L30 0l258 256L382 160z" fill="#87CEEB" />
            <path d="M382 352l-94 96L30 512l352-160z" fill="#4CAF50" />
            <path d="M510 235c13.4 7.5 13.4 28.5 0 36L382 352 288 256l94-96L510 235z" fill="#F44336" />
          </svg>
          <div className="flex flex-col leading-tight">
            <span className="text-[9px] text-brand-text-muted uppercase tracking-wider">Get it on</span>
            <span className="text-sm font-semibold text-brand-text-primary">Google Play</span>
          </div>
        </div>
      </a>
    </div>
  );
}
