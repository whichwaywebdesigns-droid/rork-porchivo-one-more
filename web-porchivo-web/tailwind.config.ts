import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // ── Porchivo brand palette (CSS vars — switches with light/dark theme) ──
        "brand-navy": {
          500: "var(--brand-navy-500)",
          600: "var(--brand-navy-600)",
          700: "var(--brand-navy-700)",
          800: "var(--brand-navy-800)",
          900: "var(--brand-navy-900)",
        },
        "brand-blue": {
          DEFAULT: "var(--brand-blue)",
          light: "var(--brand-blue-light)",
        },
        "brand-orange": {
          DEFAULT: "var(--brand-orange)",
          light: "var(--brand-orange-light)",
        },
        "brand-text": {
          primary: "var(--brand-text-primary)",
          secondary: "var(--brand-text-secondary)",
          muted: "var(--brand-text-muted)",
        },
        // ── Locked brand palette (2026-09-19 spec — self-contained navy system) ──
        // bg navy #0a0f1e · surface #121b31 · border #1e2a45 · primary emerald
        // #34d399/#10b981 · alert red #f87171 · warning amber #fbbf24 · info blue #38bdf8
        // Key names are legacy: amber→primary emerald, electric→info blue, coral→alert red.
        pv: {
          navy: {
            DEFAULT: "#0a0f1e",
            600: "#1e2a45",
            700: "#121b31",
            800: "#0e1526",
            900: "#070b16",
          },
          electric: {
            DEFAULT: "#38bdf8",
            light: "#7dd3fc",
            dim: "#0284c7",
          },
          amber: {
            DEFAULT: "#34d399",
            light: "#6ee7b7",
            dim: "#10b981",
          },
          coral: {
            DEFAULT: "#f87171",
            light: "#fca5a5",
          },
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        // Immersive landing motion (all consumed via motion-safe utilities)
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 24px -6px rgba(52, 211, 153, 0.55)" },
          "50%": { boxShadow: "0 0 48px -2px rgba(52, 211, 153, 0.85)" },
        },
        // One-shot attention glow for the hero stat numbers — drop-shadow
        // without a color uses currentColor, so coral and emerald tones
        // each glow in their own hue.
        "stat-glow": {
          "0%, 100%": { filter: "drop-shadow(0 0 0px rgba(0, 0, 0, 0))" },
          "50%": { filter: "drop-shadow(0 0 12px currentColor)" },
        },
        "scroll-dot": {
          "0%": { transform: "translateY(0)", opacity: "1" },
          "70%": { transform: "translateY(14px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "0" },
        },
        "ring-pulse": {
          "0%": { transform: "scale(0.85)", opacity: "0.7" },
          "100%": { transform: "scale(1.5)", opacity: "0" },
        },
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        float: "float 6s ease-in-out infinite",
        "glow-pulse": "glow-pulse 2.4s ease-in-out infinite",
        "stat-glow": "stat-glow 1.1s ease-in-out 2",
        "scroll-dot": "scroll-dot 1.8s ease-in-out infinite",
        "ring-pulse": "ring-pulse 2.6s ease-out infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
