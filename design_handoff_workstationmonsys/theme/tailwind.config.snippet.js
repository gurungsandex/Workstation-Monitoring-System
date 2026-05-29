// ============================================================
// WorkstationMonSys — Tailwind theme extension
// Merge `theme.extend` into your tailwind.config.{js,ts}.
// Colors reference the CSS variables in theme/globals.css, so the
// "electric"/"refined" palette + density swap work at runtime via
// a class on <html> with zero rebuild.
// ============================================================
module.exports = {
  theme: {
    extend: {
      colors: {
        bg:        "var(--bg)",
        "bg-2":    "var(--bg-2)",
        card:      "var(--card)",
        "card-2":  "var(--card-2)",
        "card-3":  "var(--card-3)",
        // semantic accents
        info:      "var(--info)",
        healthy:   "var(--healthy)",
        warning:   "var(--warning)",
        critical:  "var(--critical)",
        network:   "var(--network)",
        gpu:       "var(--gpu)",
        offline:   "var(--offline)",
        // text
        text:        "var(--text)",
        "text-dim":  "var(--text-dim)",
        "text-faint":"var(--text-faint)",
        "text-ghost":"var(--text-ghost)",
      },
      borderColor: {
        DEFAULT: "var(--border)",
        strong:  "var(--border-strong)",
        hairline:"var(--hairline)",
      },
      fontFamily: {
        display: ["Space Grotesk", "system-ui", "sans-serif"],
        body:    ["IBM Plex Sans", "system-ui", "sans-serif"],
        mono:    ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        card: "var(--radius)",
        sm:   "var(--radius-sm)",
      },
      keyframes: {
        // critical status-dot pulse
        pulse: {
          "0%,100%": { boxShadow: "0 0 0 0 color-mix(in oklab, var(--critical) 45%, transparent)" },
          "50%":     { boxShadow: "0 0 0 6px color-mix(in oklab, var(--critical) 0%, transparent)" },
        },
        // view entrance — TRANSFORM ONLY (never animate opacity from 0;
        // a backgrounded tab can freeze it and hide content)
        viewIn: {
          from: { transform: "translateY(8px)" },
          to:   { transform: "none" },
        },
      },
      animation: {
        pulse:  "pulse 1.6s ease-in-out infinite",
        viewIn: "viewIn .34s cubic-bezier(.2,.7,.2,1) both",
      },
    },
  },
};
