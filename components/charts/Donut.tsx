"use client";
import React from "react";
import { sevColor } from "./utils";

interface Segment { value: number; color: string; }

interface DonutProps {
  segments: Segment[];
  size?: number;
  thickness?: number;
  children?: React.ReactNode;
}

export function Donut({ segments, size = 138, thickness = 15, children }: DonutProps) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--card-3)" strokeWidth={thickness} />
        {segments.map((s, i) => {
          const len = (s.value / total) * circ;
          const el = (
            <circle key={i} cx={size/2} cy={size/2} r={r} fill="none"
              stroke={sevColor(s.color)} strokeWidth={thickness}
              strokeDasharray={`${len} ${circ}`}
              strokeDashoffset={-offset}
              style={{ transition: "stroke-dasharray .6s, stroke-dashoffset .6s" }} />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        {children}
      </div>
    </div>
  );
}
