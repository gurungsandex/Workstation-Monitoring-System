import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg:           "var(--bg)",
        "bg-2":       "var(--bg-2)",
        card:         "var(--card)",
        "card-2":     "var(--card-2)",
        "card-3":     "var(--card-3)",
        info:         "var(--info)",
        healthy:      "var(--healthy)",
        warning:      "var(--warning)",
        critical:     "var(--critical)",
        network:      "var(--network)",
        gpu:          "var(--gpu)",
        offline:      "var(--offline)",
        text:         "var(--text)",
        "text-dim":   "var(--text-dim)",
        "text-faint": "var(--text-faint)",
        "text-ghost": "var(--text-ghost)",
      },
      borderColor: {
        DEFAULT:  "var(--border)",
        strong:   "var(--border-strong)",
        hairline: "var(--hairline)",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body:    ["var(--font-body)", "system-ui", "sans-serif"],
        mono:    ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        card: "var(--radius)",
        sm:   "var(--radius-sm)",
      },
      keyframes: {
        statusPulse: {
          "0%,100%": { boxShadow: "0 0 0 0 color-mix(in oklab, var(--critical) 45%, transparent)" },
          "50%":     { boxShadow: "0 0 0 6px color-mix(in oklab, var(--critical) 0%, transparent)" },
        },
        livePulse: {
          "0%,100%": { boxShadow: "0 0 0 0 color-mix(in oklab, var(--healthy) 55%, transparent)" },
          "50%":     { boxShadow: "0 0 0 5px color-mix(in oklab, var(--healthy) 0%, transparent)" },
        },
        viewIn: {
          from: { transform: "translateY(8px)" },
          to:   { transform: "none" },
        },
      },
      animation: {
        "status-pulse": "statusPulse 1.6s ease-in-out infinite",
        "live-pulse":   "livePulse 1.8s ease-in-out infinite",
        "view-in":      "viewIn .34s cubic-bezier(.2,.7,.2,1) both",
      },
    },
  },
  plugins: [],
};

export default config;
