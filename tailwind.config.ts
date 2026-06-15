import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Page surfaces — kept legacy names for back-compat, mapped to new tokens
        bg: "var(--vellum)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        border: "var(--rule)",
        // Text
        "text-1": "var(--ink)",
        "text-2": "var(--graphite)",
        "text-3": "var(--chalk)",
        // Named tokens (preferred)
        vellum: "var(--vellum)",
        ink: "var(--ink)",
        graphite: "var(--graphite)",
        chalk: "var(--chalk)",
        rule: "var(--rule)",
        marker: "var(--marker)",
        // Single accent — points at the new marker token
        accent: {
          DEFAULT: "var(--marker)",
          fg: "var(--ink)",
          soft: "var(--marker-soft)",
        },
        // Trace event opacities use ink — these are semantic, not branding
        success: "var(--success)",
        warn: "var(--warn)",
        danger: "var(--danger)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular"],
        serif: ["var(--font-serif)", "ui-serif", "Georgia"],
      },
      fontSize: {
        // A tighter, more deliberate scale
        xs: ["0.75rem", { lineHeight: "1.1rem", letterSpacing: "0.01em" }],
        sm: ["0.8125rem", { lineHeight: "1.35rem" }],
        base: ["0.9375rem", { lineHeight: "1.55rem" }],
        lg: ["1.0625rem", { lineHeight: "1.65rem" }],
        xl: ["1.25rem", { lineHeight: "1.75rem" }],
        "2xl": ["1.625rem", { lineHeight: "2rem", letterSpacing: "-0.01em" }],
        "3xl": ["2.125rem", { lineHeight: "2.4rem", letterSpacing: "-0.015em" }],
        "4xl": ["2.875rem", { lineHeight: "3.1rem", letterSpacing: "-0.02em" }],
        "5xl": ["3.75rem", { lineHeight: "3.9rem", letterSpacing: "-0.025em" }],
      },
      borderRadius: {
        // Pulled in — the lab feel rejects soft corners
        sm: "2px",
        md: "3px",
        lg: "4px",
        xl: "6px",
      },
      boxShadow: {
        "elev-1": "0 0 0 1px var(--rule)",
        "elev-2": "0 1px 0 var(--rule), 0 0 0 1px var(--rule)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "trace-draw": {
          "0%": { strokeDashoffset: "1000" },
          "100%": { strokeDashoffset: "0" },
        },
        "trace-tick": {
          "0%": { transform: "scaleY(0)", opacity: "0" },
          "100%": { transform: "scaleY(1)", opacity: "1" },
        },
        "marker-pulse": {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.25)", opacity: "0.85" },
        },
      },
      animation: {
        "fade-up": "fade-up 320ms cubic-bezier(0.22, 0.61, 0.36, 1) both",
        "trace-draw": "trace-draw 1400ms ease-out both",
        "trace-tick": "trace-tick 240ms cubic-bezier(0.22, 0.61, 0.36, 1) both",
        "marker-pulse": "marker-pulse 2.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;

