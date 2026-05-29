"use client";
import { useTween } from "./AnimatedNumber";
import { loadColor } from "./utils";

interface GaugeProps {
  value: number;
  max?: number;
  size?: number;
  color?: string;
  style?: "ring" | "arc" | "bar";
  thickness?: number;
}

export function Gauge({ value, max = 100, size = 62, color, style = "ring", thickness = 7 }: GaugeProps) {
  const pct = Math.max(0, Math.min(1, value / max));
  const v = useTween(pct, 800);
  const col = color ?? loadColor((value / max) * 100);

  if (style === "bar") {
    return (
      <div style={{ width: "100%" }}>
        <div style={{ height: thickness + 2, background: "var(--card-3)", borderRadius: 999, overflow: "hidden" }}>
          <div style={{
            width: `${v * 100}%`, height: "100%",
            background: col, borderRadius: 999,
            boxShadow: `0 0 10px ${col}`,
            transition: "background .3s",
          }} />
        </div>
      </div>
    );
  }

  const r = (size - thickness) / 2;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;

  if (style === "arc") {
    const sweep = 270;
    const arcLen = circ * (sweep / 360);
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(135deg)" }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--card-3)" strokeWidth={thickness}
          strokeDasharray={`${arcLen} ${circ}`} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={col} strokeWidth={thickness}
          strokeDasharray={`${arcLen * v} ${circ}`} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 5px ${col})` }} />
      </svg>
    );
  }

  // ring (full circle)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--card-3)" strokeWidth={thickness} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={col} strokeWidth={thickness}
        strokeDasharray={`${circ * v} ${circ}`} strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 5px ${col})` }} />
    </svg>
  );
}
