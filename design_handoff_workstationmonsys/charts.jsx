/* ============================================================
   charts.jsx — SVG chart primitives
   ============================================================ */
const { useState: useStateC, useRef: useRefC, useEffect: useEffectC } = React;

const SEV_VAR = {
  info: "var(--info)", healthy: "var(--healthy)", warning: "var(--warning)",
  critical: "var(--critical)", network: "var(--network)", gpu: "var(--gpu)",
  offline: "#4a5160",
};
function sevColor(name) { return SEV_VAR[name] || name; }

// pick semantic color from a percent value (load-style: green→amber→red)
function loadColor(pct) {
  if (pct >= 90) return "var(--critical)";
  if (pct >= 75) return "var(--warning)";
  if (pct >= 55) return "var(--info)";
  return "var(--healthy)";
}

/* animated number that ticks toward target */
function useTween(target, dur = 700) {
  const [val, setVal] = useStateC(target);
  const ref = useRefC({ from: target, start: 0, raf: 0 });
  useEffectC(() => {
    const o = ref.current;
    o.from = val; o.start = performance.now();
    const step = (t) => {
      const k = Math.min((t - o.start) / dur, 1);
      const e = 1 - Math.pow(1 - k, 3);
      setVal(o.from + (target - o.from) * e);
      if (k < 1) o.raf = requestAnimationFrame(step);
    };
    cancelAnimationFrame(o.raf);
    o.raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(o.raf);
  }, [target]);
  return val;
}

function AnimatedNumber({ value, decimals = 0, className = "", suffix = "" }) {
  const v = useTween(value, 650);
  return <span className={className}>{v.toFixed(decimals)}{suffix}</span>;
}

/* ---------- Gauge: ring / arc / bar ---------- */
function Gauge({ value, max = 100, size = 92, color, style = "ring", thickness = 8, label }) {
  const pct = Math.max(0, Math.min(1, value / max));
  const v = useTween(pct, 800);
  const col = color || loadColor(value / max * 100);

  if (style === "bar") {
    return (
      <div style={{ width: "100%" }}>
        <div style={{ height: thickness + 2, background: "var(--card-3)", borderRadius: 999, overflow: "hidden" }}>
          <div style={{ width: `${v * 100}%`, height: "100%", background: col, borderRadius: 999, boxShadow: `0 0 12px ${col}`, transition: "background .3s" }} />
        </div>
      </div>
    );
  }

  const r = (size - thickness) / 2;
  const cx = size / 2, cy = size / 2;

  if (style === "arc") {
    // 270° arc, gap at bottom
    const startA = 135, sweep = 270;
    const circ = 2 * Math.PI * r;
    const arcLen = circ * (sweep / 360);
    const dash = `${arcLen * v} ${circ}`;
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: `rotate(${startA}deg)` }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--card-3)" strokeWidth={thickness}
          strokeDasharray={`${arcLen} ${circ}`} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={col} strokeWidth={thickness}
          strokeDasharray={dash} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 5px ${col})` }} />
      </svg>
    );
  }

  // ring (full circle)
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--card-3)" strokeWidth={thickness} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={col} strokeWidth={thickness}
        strokeDasharray={`${circ * v} ${circ}`} strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 5px ${col})` }} />
    </svg>
  );
}

/* ---------- Sparkline ---------- */
function Sparkline({ data, w = 120, h = 34, color = "var(--info)", fill = true, strokeW = 1.6 }) {
  if (!data || !data.length) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - 3 - ((d - min) / range) * (h - 6);
    return [x, y];
  });
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  const gid = "sg" + Math.round(Math.abs(data[0] * 97 + data.length));
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${gid})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth={strokeW} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.2" fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
    </svg>
  );
}

/* ---------- Donut (multi-segment) ---------- */
function Donut({ segments, size = 150, thickness = 16, children }) {
  // segments: [{value, color}]
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--card-3)" strokeWidth={thickness} />
        {segments.map((s, i) => {
          const len = (s.value / total) * circ;
          const el = (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke={sevColor(s.color)} strokeWidth={thickness}
              strokeDasharray={`${len} ${circ}`} strokeDashoffset={-offset}
              style={{ transition: "stroke-dasharray .6s, stroke-dashoffset .6s" }} />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        {children}
      </div>
    </div>
  );
}

/* ---------- Area/Line chart (24h trend) ---------- */
function LineChart({ series, w = 600, h = 180, pad = 8, yMax, showGrid = true, labels }) {
  // series: [{data:[], color, fill}]
  const ref = useRefC(null);
  const [hover, setHover] = useStateC(null);
  const allMax = yMax || Math.max(...series.flatMap((s) => s.data), 1);
  const n = series[0].data.length;
  const innerW = w - pad * 2, innerH = h - pad * 2 - 14;

  const xFor = (i) => pad + (i / (n - 1)) * innerW;
  const yFor = (v) => pad + innerH - (v / allMax) * innerH;

  function onMove(e) {
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * w;
    const i = Math.round(((x - pad) / innerW) * (n - 1));
    if (i >= 0 && i < n) setHover({ i, x: xFor(i) });
  }

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={i} id={`lc${i}-${Math.round(s.data[0])}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {showGrid && [0, 0.25, 0.5, 0.75, 1].map((g, i) => (
          <line key={i} x1={pad} x2={w - pad} y1={pad + innerH * g} y2={pad + innerH * g}
            stroke="var(--hairline)" strokeWidth="1" />
        ))}
        {series.map((s, si) => {
          const line = s.data.map((d, i) => `${i ? "L" : "M"}${xFor(i).toFixed(1)},${yFor(d).toFixed(1)}`).join(" ");
          const area = `${line} L${xFor(n - 1)},${pad + innerH} L${pad},${pad + innerH} Z`;
          return (
            <g key={si}>
              {s.fill !== false && <path d={area} fill={`url(#lc${si}-${Math.round(s.data[0])})`} />}
              <path d={line} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            </g>
          );
        })}
        {hover && (
          <g>
            <line x1={hover.x} x2={hover.x} y1={pad} y2={pad + innerH} stroke="var(--border-strong)" strokeWidth="1" />
            {series.map((s, si) => (
              <circle key={si} cx={hover.x} cy={yFor(s.data[hover.i])} r="3" fill={s.color} stroke="var(--bg)" strokeWidth="1.5" />
            ))}
          </g>
        )}
        {/* x labels */}
        {labels && labels.map((l, i) => (
          <text key={i} x={pad + (l.at / (n - 1)) * innerW} y={h - 2} fontSize="9" fill="var(--text-faint)"
            textAnchor="middle" fontFamily="var(--font-mono)">{l.t}</text>
        ))}
      </svg>
      {hover && (
        <div style={{ position: "absolute", left: `${(hover.x / w) * 100}%`, top: 0, transform: "translateX(8px)",
          background: "#0c1118", border: "1px solid var(--border-strong)", borderRadius: 8, padding: "7px 9px",
          fontSize: 11, pointerEvents: "none", whiteSpace: "nowrap", boxShadow: "0 8px 24px rgba(0,0,0,.5)" }}>
          {series.map((s, si) => (
            <div key={si} style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-dim)" }}>
              <span style={{ width: 7, height: 7, borderRadius: 2, background: s.color }} />
              <span className="mono" style={{ color: "var(--text)" }}>{s.data[hover.i].toFixed(1)}</span>
              <span>{s.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- horizontal progress bar (top-N) ---------- */
function ProgressBar({ value, max = 100, color, height = 6 }) {
  const pct = Math.max(0, Math.min(1, value / max));
  const v = useTween(pct, 700);
  const col = color || loadColor(value / max * 100);
  return (
    <div style={{ height, background: "var(--card-3)", borderRadius: 999, overflow: "hidden", width: "100%" }}>
      <div style={{ width: `${v * 100}%`, height: "100%", background: col, borderRadius: 999, transition: "background .3s" }} />
    </div>
  );
}

Object.assign(window, {
  Gauge, Sparkline, Donut, LineChart, ProgressBar, AnimatedNumber,
  useTween, sevColor, loadColor,
});
