import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";

type ThemeOption = "light" | "system" | "dark";

const OPTIONS: { value: ThemeOption; icon: typeof Sun; label: string }[] = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "system", icon: Monitor, label: "System" },
  { value: "dark", icon: Moon, label: "Dark" },
];

/**
 * Theme toggle — compact segmented control for the site header.
 * Cycles through Light → System → Dark on click, or shows dropdown.
 */
export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  // Avoid hydration mismatch — render placeholder until mounted
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-theme-toggle]")) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!mounted) {
    // Placeholder with same dimensions to prevent layout shift
    return (
      <div className="w-9 h-9 rounded-lg flex items-center justify-center">
        <Sun className="w-4 h-4 text-brand-text-muted" />
      </div>
    );
  }

  const current = (theme as ThemeOption) || "system";
  const CurrentIcon = OPTIONS.find((o) => o.value === current)?.icon ?? Sun;

  return (
    <div className="relative" data-theme-toggle>
      <button
        onClick={() => setOpen(!open)}
        className="w-9 h-9 rounded-lg flex items-center justify-center text-brand-text-muted hover:text-brand-text-primary hover:bg-brand-navy-600/50 transition-colors"
        aria-label={`Theme: ${current}. Click to change.`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <CurrentIcon className="w-4 h-4" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 mt-1.5 min-w-[140px] rounded-xl border border-brand-navy-500/40 bg-brand-navy-800/95 backdrop-blur-xl shadow-2xl overflow-hidden z-[60]"
        >
          {OPTIONS.map(({ value, icon: Icon, label }) => {
            const active = current === value;
            return (
              <button
                key={value}
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setTheme(value);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] font-medium transition-colors ${
                  active
                    ? "text-brand-blue-light bg-brand-blue/10"
                    : "text-brand-text-muted hover:text-brand-text-primary hover:bg-brand-navy-700/60"
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
                {active && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-blue-light" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
