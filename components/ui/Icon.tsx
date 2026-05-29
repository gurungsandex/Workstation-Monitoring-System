import React from "react";

const ICONS: Record<string, string> = {
  dashboard:  "M3 3h7v7H3zM14 3h7v4h-7zM14 11h7v10h-7zM3 14h7v7H3z",
  grid:       "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  alert:      "M12 3l9 16H3zM12 10v4M12 17h.01",
  network:    "M5 9a3 3 0 100-6 3 3 0 000 6zM19 9a3 3 0 100-6 3 3 0 000 6zM12 21a3 3 0 100-6 3 3 0 000 6zM6.5 7.5l4 6M17.5 7.5l-4 6",
  cpu:        "M9 3v2M15 3v2M9 19v2M15 19v2M3 9h2M3 15h2M19 9h2M19 15h2M5 5h14v14H5zM9 9h6v6H9z",
  memory:     "M6 19v2M10 19v2M14 19v2M18 19v2M4 4h16v12H4zM8 8v4M12 8v4M16 8v4",
  disk:       "M22 12a10 10 0 11-20 0 10 10 0 0120 0zM12 12h.01",
  gpu:        "M2 7h20v10H2zM6 7v10M2 11h4M18 11a2 2 0 100 4 2 2 0 000-4z",
  thermo:     "M14 14.76V4a2 2 0 10-4 0v10.76a4 4 0 104 0z",
  globe:      "M12 22a10 10 0 100-20 10 10 0 000 20zM2 12h20M12 2a15 15 0 010 20 15 15 0 010-20z",
  bell:       "M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0",
  search:     "M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3",
  chevron:    "M9 6l6 6-6 6",
  chevronDown:"M6 9l6 6 6-6",
  arrowUp:    "M12 19V5M5 12l7-7 7 7",
  arrowDown:  "M12 5v14M5 12l7 7 7-7",
  collapse:   "M15 6l-6 6 6 6",
  pulse:      "M3 12h4l2 6 4-14 2 8h6",
  check:      "M20 6L9 17l-5-5",
  x:          "M18 6L6 18M6 6l12 12",
  filter:     "M22 3H2l8 9.46V19l4 2v-8.54z",
  clock:      "M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2",
  download:   "M12 3v12M7 10l5 5 5-5M5 21h14",
  sun:        "M12 7a5 5 0 100 10 5 5 0 000-10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
};

interface IconProps {
  name: string;
  size?: number;
  stroke?: number;
  color?: string;
  style?: React.CSSProperties;
}

export function Icon({ name, size = 18, stroke = 1.7, color = "currentColor", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d={ICONS[name] ?? ""} />
    </svg>
  );
}
