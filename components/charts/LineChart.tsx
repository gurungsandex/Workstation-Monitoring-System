"use client";
import { useRef, useState } from "react";

interface Series {
  name: string;
  data: number[];
  color: string;
  fill?: boolean;
}

interface Label { at: number; t: string; }

interface LineChartProps {
  series: Series[];
  w?: number;
  h?: number;
  pad?: number;
  yMax?: number;
  showGrid?: boolean;
  labels?: Label[];
}

export function LineChart({ series, w = 620, h = 190, pad = 8, yMax, showGrid = true, labels }: LineChartProps) {
  const ref  = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ i: number; x: number } | null>(null);

  const n       = series[0]?.data.length ?? 0;
  const allMax  = yMax ?? Math.max(...series.flatMap((s) => s.data), 1);
  const innerW  = w - pad * 2;
  const innerH  = h - pad * 2 - 14;

  const xFor = (i: number) => pad + (i / (n - 1)) * innerW;
  const yFor = (v: number) => pad + innerH - (v / allMax) * innerH;

  function onMove(e: React.MouseEvent) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * w;
    const i = Math.round(((x - pad) / innerW) * (n - 1));
    if (i >= 0 && i < n) setHover({ i, x: xFor(i) });
  }

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}
      onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={i} id={`lc-${i}-${Math.round(s.data[0] ?? 0)}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={s.color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0"    />
            </linearGradient>
          ))}
        </defs>
        {showGrid && [0, 0.25, 0.5, 0.75, 1].map((g, i) => (
          <line key={i} x1={pad} x2={w - pad} y1={pad + innerH * g} y2={pad + innerH * g}
            stroke="var(--hairline)" strokeWidth="1" />
        ))}
        {series.map((s, si) => {
          if (!s.data.length) return null;
          const linePath = s.data.map((d, i) => `${i ? "L" : "M"}${xFor(i).toFixed(1)},${yFor(d).toFixed(1)}`).join(" ");
          const areaPath = `${linePath} L${xFor(n-1)},${pad+innerH} L${pad},${pad+innerH} Z`;
          return (
            <g key={si}>
              {s.fill !== false && <path d={areaPath} fill={`url(#lc-${si}-${Math.round(s.data[0] ?? 0)})`} />}
              <path d={linePath} fill="none" stroke={s.color} strokeWidth="2"
                strokeLinejoin="round" strokeLinecap="round" />
            </g>
          );
        })}
        {hover && (
          <g>
            <line x1={hover.x} x2={hover.x} y1={pad} y2={pad + innerH}
              stroke="var(--border-strong)" strokeWidth="1" />
            {series.map((s, si) => (
              <circle key={si} cx={hover.x} cy={yFor(s.data[hover.i] ?? 0)} r="3"
                fill={s.color} stroke="var(--bg)" strokeWidth="1.5" />
            ))}
          </g>
        )}
        {labels?.map((l, i) => (
          <text key={i} x={pad + (l.at / (n - 1)) * innerW} y={h - 2}
            fontSize="9" fill="var(--text-faint)" textAnchor="middle"
            fontFamily="var(--font-mono)">{l.t}</text>
        ))}
      </svg>
      {hover && (
        <div style={{
          position: "absolute", left: `${(hover.x / w) * 100}%`, top: 8,
          transform: "translateX(8px)", background: "#0c1118",
          border: "1px solid var(--border-strong)", borderRadius: 8,
          padding: "7px 9px", fontSize: 11, pointerEvents: "none",
          whiteSpace: "nowrap", boxShadow: "0 8px 24px rgba(0,0,0,.5)", zIndex: 10,
        }}>
          {series.map((s, si) => (
            <div key={si} style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-dim)" }}>
              <span style={{ width: 7, height: 7, borderRadius: 2, background: s.color }} />
              <span className="mono" style={{ color: "var(--text)" }}>{(s.data[hover.i] ?? 0).toFixed(1)}</span>
              <span>{s.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
