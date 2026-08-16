import { useState, useCallback } from "react";
import { Share2, Check, Copy } from "lucide-react";
import { BRAND } from "@/config/brand";

const SHARE_URL = `${BRAND.url}/download`;
const SHARE_TITLE = "Porchivo — Package theft protection for your neighborhood";
const SHARE_TEXT = `Check out Porchivo — it tracks your packages, warns you about porch theft risk, and connects you with neighbors who can hold deliveries. Free on iOS and Android: ${SHARE_URL}`;

type ShareButtonProps = {
  className?: string;
  label?: string;
};

export default function ShareButton({ className = "", label = "Share Porchivo" }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url: SHARE_URL });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(SHARE_TEXT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Last resort: select-and-copy prompt
      window.prompt("Copy this link to share:", SHARE_URL);
    }
  }, []);

  return (
    <button
      onClick={handleShare}
      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-orange/10 border border-brand-orange/30 text-brand-orange hover:bg-brand-orange/20 hover:border-brand-orange/50 font-semibold text-sm transition-all ${className}`}
      aria-label="Share Porchivo with friends"
    >
      {copied ? (
        <>
          <Check className="w-4 h-4" />
          Copied!
        </>
      ) : (
        <>
          <Share2 className="w-4 h-4" />
          {label}
        </>
      )}
    </button>
  );
}
