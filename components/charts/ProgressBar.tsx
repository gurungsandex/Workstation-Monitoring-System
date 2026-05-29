"use client";
import { useTween } from "./AnimatedNumber";
import { loadColor } from "./utils";

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  height?: number;
}

export function ProgressBar({ value, max = 100, color, height = 6 }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, value / max));
  const v   = useTween(pct, 700);
  const col = color ?? loadColor((value / max) * 100);
  return (
    <div style={{ height, background: "var(--card-3)", borderRadius: 999, overflow: "hidden", width: "100%" }}>
      <div style={{ width: `${v * 100}%`, height: "100%", background: col, borderRadius: 999, transition: "background .3s" }} />
    </div>
  );
}
