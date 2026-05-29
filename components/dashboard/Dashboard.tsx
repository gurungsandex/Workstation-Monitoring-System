"use client";
import Link from "next/link";
import { useLive } from "@/lib/LiveContext";
import { GaugeCard } from "./GaugeCard";
import { Donut } from "@/components/charts/Donut";
import { LineChart } from "@/components/charts/LineChart";
import { ProgressBar } from "@/components/charts/ProgressBar";
import { AnimatedNumber } from "@/components/charts/AnimatedNumber";
import type { EnrolledWorkstation } from "@/lib/api";
import type { HistPoint } from "@/lib/useFleetData";

// ── helpers ──────────────────────────────────────────────────────────────────

const STATUS_ORDER = ["healthy", "warning", "critical", "offline"] as const;
type Status = typeof STATUS_ORDER[number];

function relTime(iso?: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function histSeries(history: HistPoint[], key: keyof HistPoint): number[] {
  if (!history.length) return Array(48).fill(0);
  // Downsample or pad to 48 points
  const data = history.map((p) => Number(p[key]) || 0);
  if (data.length >= 48) return data.slice(-48);
  return [...Array(48 - data.length).fill(0), ...data];
}

function makeSpark(rows: EnrolledWorkstation[], key: keyof EnrolledWorkstation, len = 20): number[] {
  const online = rows.filter((r) => r.status !== "offline");
  if (!online.length) return Array(len).fill(0);
  const val = online.reduce((s, r) => s + ((r[key] as number) ?? 0), 0) / online.length;
  // Single-value spark (real sparklines come from 30m history in next milestone)
  return Array(len).fill(0).map((_, i) => val * (0.85 + Math.sin(i * 0.6) * 0.1));
}

const CHART_LABELS = [
  { at: 0, t: "24h" }, { at: 12, t: "18h" },
  { at: 24, t: "12h" }, { at: 36, t: "6h" }, { at: 47, t: "now" },
];

// ── component ─────────────────────────────────────────────────────────────────

export function Dashboard() {
  const { fleetData } = useLive();
  const { fleet, rows, history, loading } = fleetData;

  const f = fleet ?? {
    counts: { healthy: 0, warning: 0, critical: 0, offline: 0 },
    total: 0, avgCpu: 0, avgRam: 0, avgDisk: 0, avgGpu: 0, netIn: 0, netOut: 0,
  };

  const healthyPct = f.total > 0 ? Math.round((f.counts.healthy / f.total) * 100) : 0;

  const needsAttention = [...rows]
    .filter((w) => w.status !== "healthy")
    .sort((a, b) => a.health_score - b.health_score)
    .slice(0, 7);

  const online = rows.filter((w) => w.status !== "offline");
  const topCpu  = [...online].sort((a, b) => (b.snap_cpu_usage    ?? 0) - (a.snap_cpu_usage    ?? 0)).slice(0, 5);
  const topRam  = [...online].sort((a, b) => (b.snap_ram_used_pct ?? 0) - (a.snap_ram_used_pct ?? 0)).slice(0, 5);
  const topDisk = [...online].sort((a, b) => (b.snap_disk_used_pct?? 0) - (a.snap_disk_used_pct?? 0)).slice(0, 5);

  const cpuSpark  = makeSpark(rows, "snap_cpu_usage");
  const ramSpark  = makeSpark(rows, "snap_ram_used_pct");
  const diskSpark = makeSpark(rows, "snap_disk_used_pct");
  const gpuSpark  = makeSpark(rows, "snap_gpu_load");
  const netInSpark  = makeSpark(rows, "snap_net_eth_in");
  const netOutSpark = makeSpark(rows, "snap_net_eth_out");

  const cpuHist  = histSeries(history, "avg_cpu");
  const ramHist  = histSeries(history, "avg_ram");

  if (loading && !fleet) {
    return (
      <div style={{ padding: 60, textAlign: "center", color: "var(--text-dim)" }}>
        <div style={{ fontSize: 13 }}>Loading fleet data…</div>
      </div>
    );
  }

  if (!loading && rows.length === 0) {
    return (
      <div style={{ padding: 60, textAlign: "center", color: "var(--text-dim)" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📡</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>No workstations enrolled yet</div>
        <div style={{ fontSize: 13, marginBottom: 20 }}>Go to <Link href="/network" style={{ color: "var(--info)" }}>Network</Link> to discover hosts and enroll agents.</div>
      </div>
    );
  }

  return (
    <div className="view-enter" style={{ padding: 24, display: "flex", flexDirection: "column", gap: "var(--gap-grid)" }}>

      {/* Row 1 — 6 gauge cards */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(6, 1fr)" }}>
        <GaugeCard label="Avg CPU"      icon="cpu"       value={f.avgCpu}       unit="%" spark={cpuSpark} />
        <GaugeCard label="Avg RAM"      icon="memory"    value={f.avgRam}       unit="%" spark={ramSpark} />
        <GaugeCard label="Avg Disk"     icon="disk"      value={f.avgDisk}      unit="%" spark={diskSpark} />
        <GaugeCard label="Avg GPU"      icon="gpu"       value={f.avgGpu}       unit="%" spark={gpuSpark} color="var(--gpu)" />
        <GaugeCard label="Net Inbound"  icon="arrowDown" value={f.netIn}        unit="MB/s" max={600}
          color="var(--network)" spark={netInSpark} decimals={1} />
        <GaugeCard label="Net Outbound" icon="arrowUp"   value={f.netOut}       unit="MB/s" max={400}
          color="var(--network)" spark={netOutSpark} decimals={1} />
      </div>

      {/* Row 2 — trend chart + donut */}
      <div className="grid" style={{ gridTemplateColumns: "2fr 1fr" }}>
        <div className="card">
          <div className="card-head">
            <div className="card-title">Fleet load · last 24 hours</div>
            <div style={{ display: "flex", gap: 14 }}>
              {[["CPU", "var(--info)"], ["RAM", "var(--gpu)"]].map(([label, color]) => (
                <span key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--text-dim)" }}>
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: color }} />{label}
                </span>
              ))}
            </div>
          </div>
          <LineChart
            series={[
              { name: "CPU %", data: cpuHist, color: "var(--info)" },
              { name: "RAM %", data: ramHist, color: "var(--gpu)" },
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
              {STATUS_ORDER.map((k) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span className={`dot ${k}`} />
                  <span style={{ textTransform: "capitalize", fontSize: 12.5, color: "var(--text-dim)", flex: 1 }}>{k}</span>
                  <span className="mono" style={{ fontWeight: 600, fontSize: 14 }}>{f.counts[k as keyof typeof f.counts]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 3 — attention list + top activity */}
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {/* Workstations needing attention */}
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-head">
            <div className="card-title">Workstations needing attention</div>
            <Link href="/workstations" className="chip">View all</Link>
          </div>
          {needsAttention.length === 0 ? (
            <div style={{ padding: "24px 6px", color: "var(--healthy)", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
              <span className="dot healthy" />All workstations healthy
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {needsAttention.map((w, i) => (
                <Link key={w.id} href={`/workstations/${w.id}`} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 6px", borderTop: i ? "1px solid var(--hairline)" : "none",
                  borderRadius: 6, textDecoration: "none", transition: "background .12s",
                }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,.025)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  <span className={`dot ${w.status as Status}`} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="mono" style={{ fontSize: 13, color: "var(--text)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {w.hostname}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{w.dept ?? w.os_family ?? w.status}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div className="mono" style={{ fontSize: 15, fontWeight: 600, color: `var(--${w.status})` }}>
                      {w.health_score}
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: "var(--text-faint)" }}>
                      {relTime(w.last_seen_at)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent workstation activity */}
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-head">
            <div className="card-title">Recent activity</div>
            <Link href="/alerts" className="chip">Alerts center</Link>
          </div>
          {rows.length === 0 ? (
            <div style={{ padding: "24px 6px", color: "var(--text-dim)", fontSize: 13 }}>No activity yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {[...rows]
                .filter((w) => w.last_seen_at)
                .sort((a, b) => new Date(b.last_seen_at!).getTime() - new Date(a.last_seen_at!).getTime())
                .slice(0, 10)
                .map((w, i) => (
                  <Link key={w.id} href={`/workstations/${w.id}`} style={{
                    display: "flex", alignItems: "flex-start", gap: 11,
                    padding: "9px 6px", borderTop: i ? "1px solid var(--hairline)" : "none",
                    borderRadius: 6, textDecoration: "none", transition: "background .12s",
                  }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,.025)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    <span className={`dot ${w.status as Status}`} style={{ marginTop: 5 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, color: "var(--text)" }}>{w.hostname}</div>
                      <div className="mono" style={{ fontSize: 10.5, color: "var(--text-faint)" }}>
                        CPU {(w.snap_cpu_usage ?? 0).toFixed(0)}% · RAM {(w.snap_ram_used_pct ?? 0).toFixed(0)}%
                      </div>
                    </div>
                    <span className="mono" style={{ fontSize: 10.5, color: "var(--text-faint)", flexShrink: 0, whiteSpace: "nowrap" }}>
                      {relTime(w.last_seen_at)}
                    </span>
                  </Link>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 4 — top N */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <TopNCard title="Top by CPU"  unit="%" items={topCpu}  getValue={(w) => w.snap_cpu_usage    ?? 0} />
        <TopNCard title="Top by RAM"  unit="%" items={topRam}  getValue={(w) => w.snap_ram_used_pct ?? 0} />
        <TopNCard title="Top by Disk" unit="%" items={topDisk} getValue={(w) => w.snap_disk_used_pct?? 0} />
      </div>
    </div>
  );
}

// ── TopNCard ──────────────────────────────────────────────────────────────────

function TopNCard({
  title, unit, items, getValue,
}: {
  title: string; unit: string;
  items: EnrolledWorkstation[];
  getValue: (w: EnrolledWorkstation) => number;
}) {
  const maxV = Math.max(...items.map(getValue), 1);
  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">{title}</div>
        <span className="label">Used {unit}</span>
      </div>
      {items.length === 0 ? (
        <div style={{ color: "var(--text-faint)", fontSize: 13, padding: "12px 0" }}>No data</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {items.map((w) => {
            const v = getValue(w);
            return (
              <Link key={w.id} href={`/workstations/${w.id}`} style={{ textDecoration: "none", cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, gap: 8 }}>
                  <span className="mono" style={{ fontSize: 12, color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {w.hostname}
                  </span>
                  <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", flexShrink: 0 }}>
                    {v.toFixed(0)}{unit}
                  </span>
                </div>
                <ProgressBar value={v} max={unit === "%" ? 100 : maxV} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
