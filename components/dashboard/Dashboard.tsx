"use client";
import Link from "next/link";
import { fleet, workstations, events, relTime } from "@/lib/data";
import { useLive } from "@/lib/LiveContext";
import { GaugeCard } from "./GaugeCard";
import { Donut } from "@/components/charts/Donut";
import { LineChart } from "@/components/charts/LineChart";
import { ProgressBar } from "@/components/charts/ProgressBar";
import { AnimatedNumber } from "@/components/charts/AnimatedNumber";
import { loadColor } from "@/components/charts/utils";
import type { Status } from "@/lib/data";

function avgSpark(key: "cpu" | "ram" | "net"): number[] {
  const len = workstations[0].spark[key].length;
  return Array.from({ length: len }, (_, i) => {
    const on = workstations.filter((w) => w.status !== "offline");
    return on.reduce((s, w) => s + w.spark[key][i], 0) / on.length;
  });
}

function histAvg(key: "cpu" | "ram" | "netIn" | "netOut"): number[] {
  return Array.from({ length: 48 }, (_, i) => {
    const on = workstations.filter((w) => w.status !== "offline");
    return on.reduce((s, w) => s + w.hist[key][i], 0) / on.length;
  });
}

const CHART_LABELS = [
  { at: 0, t: "24h" }, { at: 12, t: "18h" },
  { at: 24, t: "12h" }, { at: 36, t: "6h" }, { at: 47, t: "now" },
];

export function Dashboard() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { tickCount } = useLive();
  const f = fleet();
  const cpuSpark = avgSpark("cpu");
  const ramSpark = avgSpark("ram");
  const netSpark = avgSpark("net");
  const healthyPct = Math.round((f.counts.healthy / f.total) * 100);

  const needsAttention = workstations
    .filter((w) => w.status !== "healthy")
    .sort((a, b) => a.health.score - b.health.score)
    .slice(0, 7);

  const topCpu  = [...workstations].filter((w) => w.status !== "offline").sort((a, b) => b.cpu.usage - a.cpu.usage).slice(0, 5);
  const topRam  = [...workstations].filter((w) => w.status !== "offline").sort((a, b) => b.ram.usedPct - a.ram.usedPct).slice(0, 5);
  const topDisk = [...workstations].filter((w) => w.status !== "offline").sort((a, b) => b.disk.usedPct - a.disk.usedPct).slice(0, 5);

  return (
    <div className="view-enter" style={{ padding: 24, display: "flex", flexDirection: "column", gap: "var(--gap-grid)" }}>

      {/* Row 1 — 6 gauge cards */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(6, 1fr)" }}>
        <GaugeCard label="Avg CPU"      icon="cpu"       value={f.avgCpu}  unit="%" spark={cpuSpark} />
        <GaugeCard label="Avg RAM"      icon="memory"    value={f.avgRam}  unit="%" spark={ramSpark} />
        <GaugeCard label="Avg Disk I/O" icon="disk"      value={f.avgDisk} unit="MB/s" max={400}
          color="var(--info)" spark={cpuSpark.map(v => v * 3)} decimals={0} />
        <GaugeCard label="Avg GPU"      icon="gpu"       value={f.avgGpu}  unit="%" spark={ramSpark.map(v => v * 0.9)}
          color="var(--gpu)" />
        <GaugeCard label="Net Inbound"  icon="arrowDown" value={f.netIn}   unit="Mb/s" max={600}
          color="var(--network)" spark={netSpark} decimals={0} />
        <GaugeCard label="Net Outbound" icon="arrowUp"   value={f.netOut}  unit="Mb/s" max={400}
          color="var(--network)" spark={netSpark.map(v => v * 0.6)} decimals={0} />
      </div>

      {/* Row 2 — trend chart + donut */}
      <div className="grid" style={{ gridTemplateColumns: "2fr 1fr" }}>
        <div className="card">
          <div className="card-head">
            <div className="card-title">Fleet load · last 24 hours</div>
            <div style={{ display: "flex", gap: 14 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--text-dim)" }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: "var(--info)" }} />CPU
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--text-dim)" }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: "var(--gpu)" }} />RAM
              </span>
            </div>
          </div>
          <LineChart
            series={[
              { name: "CPU %", data: histAvg("cpu"), color: "var(--info)" },
              { name: "RAM %", data: histAvg("ram"), color: "var(--gpu)" },
            ]}
            yMax={100}
            labels={CHART_LABELS}
          />
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-head"><div className="card-title">Fleet health</div></div>
          <div style={{ display: "flex", alignItems: "center", gap: 18, flex: 1 }}>
            <Donut size={138} thickness={15} segments={[
              { value: f.counts.healthy,  color: "healthy"  },
              { value: f.counts.warning,  color: "warning"  },
              { value: f.counts.critical, color: "critical" },
              { value: f.counts.offline,  color: "offline"  },
            ]}>
              <span className="mono" style={{ fontSize: 30, fontWeight: 600, lineHeight: 1 }}>
                <AnimatedNumber value={healthyPct} />%
              </span>
              <span className="label" style={{ marginTop: 3 }}>Healthy</span>
            </Donut>
            <div style={{ display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
              {(["healthy","warning","critical","offline"] as Status[]).map((k) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span className={`dot ${k}`} />
                  <span style={{ textTransform: "capitalize", fontSize: 12.5, color: "var(--text-dim)", flex: 1 }}>{k}</span>
                  <span className="mono" style={{ fontWeight: 600, fontSize: 14 }}>{f.counts[k]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 3 — attention list + alert feed */}
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {/* Workstations needing attention */}
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-head">
            <div className="card-title">Workstations needing attention</div>
            <Link href="/workstations" className="chip">View all</Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {needsAttention.map((w, i) => {
              const f0 = w.health.factors[0];
              return (
                <Link key={w.id} href={`/workstations/${w.id}`} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 6px", borderTop: i ? "1px solid var(--hairline)" : "none",
                  borderRadius: 6, textDecoration: "none",
                  transition: "background .12s",
                }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,.025)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  <span className={`dot ${w.status}`} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="mono" style={{ fontSize: 13, color: "var(--text)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.hostname}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{f0 ? f0.label : w.status} · {w.dept}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div className="mono" style={{ fontSize: 15, fontWeight: 600, color: `var(--${w.status})` }}>{w.health.score}</div>
                    <div className="mono" style={{ fontSize: 10, color: "var(--text-faint)" }}>
                      {w.status === "offline" ? relTime(w.lastSeenMin) : relTime(w.timeInStateMin)}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Live alert feed */}
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-head">
            <div className="card-title">Live alert feed</div>
            <Link href="/alerts" className="chip">Alerts center</Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {events.slice(0, 10).map((ev, i) => (
              <Link key={ev.id} href={`/workstations/${ev.wsId}`} style={{
                display: "flex", alignItems: "flex-start", gap: 11,
                padding: "9px 6px", borderTop: i ? "1px solid var(--hairline)" : "none",
                borderRadius: 6, textDecoration: "none",
                transition: "background .12s",
              }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,.025)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                <span className={`dot ${ev.sev}`} style={{ marginTop: 5 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: "var(--text)" }}>{ev.text}</div>
                  <div className="mono" style={{ fontSize: 10.5, color: "var(--text-faint)" }}>{ev.ws}</div>
                </div>
                <span className="mono" style={{ fontSize: 10.5, color: "var(--text-faint)", flexShrink: 0, whiteSpace: "nowrap" }}>
                  {relTime(ev.ageMin)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4 — top N */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <TopNCard title="Top by CPU" metric="Load %" unit="%" items={topCpu} getValue={(w) => w.cpu.usage} />
        <TopNCard title="Top by RAM" metric="Used %" unit="%" items={topRam} getValue={(w) => w.ram.usedPct} />
        <TopNCard title="Top by Disk" metric="Used %" unit="%" items={topDisk} getValue={(w) => w.disk.usedPct} />
      </div>
    </div>
  );
}

function TopNCard({
  title, metric, unit, items, getValue,
}: {
  title: string; metric: string; unit: string;
  items: typeof workstations;
  getValue: (w: typeof workstations[0]) => number;
}) {
  const maxV = Math.max(...items.map(getValue), 1);
  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">{title}</div>
        <span className="label">{metric}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {items.map((w) => {
          const v = getValue(w);
          return (
            <Link key={w.id} href={`/workstations/${w.id}`} style={{ textDecoration: "none", cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, gap: 8 }}>
                <span className="mono" style={{ fontSize: 12, color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.hostname}</span>
                <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", flexShrink: 0 }}>
                  {v.toFixed(unit === "%" ? 0 : 1)}{unit}
                </span>
              </div>
              <ProgressBar value={v} max={unit === "%" ? 100 : maxV} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
