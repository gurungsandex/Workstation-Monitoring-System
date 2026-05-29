"use client";
import { useState } from "react";
import Link from "next/link";
import { Shell } from "@/components/shell/Shell";
import { useLive } from "@/lib/LiveContext";
import { ProgressBar } from "@/components/charts/ProgressBar";
import type { EnrolledWorkstation } from "@/lib/api";

const STATUS_ORDER = ["healthy", "warning", "critical", "offline"] as const;
type Status = typeof STATUS_ORDER[number];

const OS_LABEL: Record<string, string> = { windows: "Windows", mac: "macOS", linux: "Linux" };

function relTime(iso?: string | null) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function uptimeStr(sec?: number | null) {
  if (!sec) return "—";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

type SortKey = "hostname" | "status" | "cpu" | "ram" | "disk" | "health" | "last_seen";

export default function WorkstationsPage() {
  const { fleetData } = useLive();
  const { rows, loading } = fleetData;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [osFilter, setOsFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("health");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(key: SortKey) {
    if (sort === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSort(key); setSortDir(key === "health" ? "asc" : "desc"); }
  }

  const filtered = rows
    .filter((w) => {
      if (statusFilter !== "all" && w.status !== statusFilter) return false;
      if (osFilter !== "all" && w.os_family !== osFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          w.hostname.toLowerCase().includes(q) ||
          (w.owner_name ?? "").toLowerCase().includes(q) ||
          (w.dept ?? "").toLowerCase().includes(q) ||
          (w.ip ?? "").includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sort === "hostname") cmp = a.hostname.localeCompare(b.hostname);
      else if (sort === "status") cmp = STATUS_ORDER.indexOf(a.status as Status) - STATUS_ORDER.indexOf(b.status as Status);
      else if (sort === "cpu")  cmp = (a.snap_cpu_usage    ?? 0) - (b.snap_cpu_usage    ?? 0);
      else if (sort === "ram")  cmp = (a.snap_ram_used_pct ?? 0) - (b.snap_ram_used_pct ?? 0);
      else if (sort === "disk") cmp = (a.snap_disk_used_pct?? 0) - (b.snap_disk_used_pct?? 0);
      else if (sort === "health") cmp = a.health_score - b.health_score;
      else if (sort === "last_seen") cmp = new Date(a.last_seen_at ?? 0).getTime() - new Date(b.last_seen_at ?? 0).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });

  const SortHdr = ({ label, k }: { label: string; k: SortKey }) => (
    <th onClick={() => toggleSort(k)} style={{
      padding: "8px 14px", textAlign: "left", cursor: "pointer",
      color: sort === k ? "var(--text)" : "var(--text-dim)",
      fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em",
      userSelect: "none", whiteSpace: "nowrap",
    }}>
      {label}{sort === k ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
    </th>
  );

  const counts = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = rows.filter((w) => w.status === s).length;
    return acc;
  }, {} as Record<Status, number>);

  return (
    <Shell title="Workstations" subtitle={`${rows.length} enrolled devices`}>
      {/* Status strip */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {([["all", "All", "var(--text-dim)"], ...STATUS_ORDER.map((s) => [s, s, `var(--${s})`])] as [string, string, string][]).map(([val, label, color]) => (
          <button key={val} onClick={() => setStatusFilter(val as Status | "all")}
            style={{
              padding: "5px 14px", borderRadius: 6, border: "1px solid",
              borderColor: statusFilter === val ? color : "var(--border)",
              background: statusFilter === val ? `color-mix(in oklab,${color} 12%,transparent)` : "var(--card)",
              color: statusFilter === val ? color : "var(--text-dim)",
              fontSize: 12, cursor: "pointer", textTransform: "capitalize",
              display: "flex", alignItems: "center", gap: 6,
            }}>
            {val !== "all" && <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />}
            {val === "all" ? `All (${rows.length})` : `${label} (${counts[val as Status] ?? 0})`}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        {/* OS filter */}
        <select value={osFilter} onChange={(e) => setOsFilter(e.target.value)}
          style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, padding: "5px 10px", color: "var(--text-dim)", fontSize: 12, cursor: "pointer" }}>
          <option value="all">All OS</option>
          {Object.entries(OS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        {/* Search */}
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search hostname, owner, dept, IP…"
          style={{
            background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6,
            padding: "5px 10px", color: "var(--text)", fontSize: 12, outline: "none", width: 240,
          }} />
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: "auto" }}>
        {loading && rows.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-dim)" }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>
            No workstations match the current filters.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <SortHdr label="Workstation" k="hostname" />
                <SortHdr label="Status" k="status" />
                <SortHdr label="CPU" k="cpu" />
                <SortHdr label="RAM" k="ram" />
                <SortHdr label="Disk" k="disk" />
                <th style={{ padding: "8px 14px", textAlign: "left", color: "var(--text-dim)", fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>Uptime</th>
                <SortHdr label="Health" k="health" />
                <SortHdr label="Last Seen" k="last_seen" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((ws) => (
                <WorkstationRow key={ws.id} ws={ws} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Shell>
  );
}

function WorkstationRow({ ws }: { ws: EnrolledWorkstation }) {
  const cpu  = ws.snap_cpu_usage    ?? 0;
  const ram  = ws.snap_ram_used_pct ?? 0;
  const disk = ws.snap_disk_used_pct?? 0;
  const statusColor = `var(--${ws.status})`;

  return (
    <tr style={{ borderBottom: "1px solid var(--border)", transition: "background .1s" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,.02)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>

      {/* Workstation */}
      <td style={{ padding: "11px 14px" }}>
        <Link href={`/workstations/${ws.id}`} style={{ textDecoration: "none" }}>
          <div style={{ fontWeight: 600, color: "var(--text)", fontSize: 13 }}>{ws.hostname}</div>
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 1 }}>
            {ws.dept ?? ""}{ws.dept && ws.ip ? " · " : ""}{ws.ip ?? ""}
          </div>
          {ws.os_family && (
            <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{OS_LABEL[ws.os_family] ?? ws.os_family}</div>
          )}
        </Link>
      </td>

      {/* Status */}
      <td style={{ padding: "11px 14px" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: statusColor, fontSize: 12, textTransform: "capitalize" }}>
          <span className={`dot ${ws.status}`} />
          {ws.status}
        </span>
      </td>

      {/* CPU */}
      <td style={{ padding: "11px 14px", minWidth: 90 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span className="mono" style={{ fontSize: 12, color: "var(--text)" }}>{cpu.toFixed(0)}%</span>
        </div>
        <ProgressBar value={cpu} max={100} height={3} />
      </td>

      {/* RAM */}
      <td style={{ padding: "11px 14px", minWidth: 90 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span className="mono" style={{ fontSize: 12, color: "var(--text)" }}>{ram.toFixed(0)}%</span>
        </div>
        <ProgressBar value={ram} max={100} height={3} />
      </td>

      {/* Disk */}
      <td style={{ padding: "11px 14px", minWidth: 90 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span className="mono" style={{ fontSize: 12, color: "var(--text)" }}>{disk.toFixed(0)}%</span>
        </div>
        <ProgressBar value={disk} max={100} height={3} />
      </td>

      {/* Uptime */}
      <td style={{ padding: "11px 14px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)" }}>
        {uptimeStr(ws.uptime_sec)}
      </td>

      {/* Health score */}
      <td style={{ padding: "11px 14px" }}>
        <span className="mono" style={{ fontSize: 15, fontWeight: 700, color: statusColor }}>
          {ws.health_score}
        </span>
      </td>

      {/* Last seen */}
      <td style={{ padding: "11px 14px", color: "var(--text-dim)", fontSize: 12 }}>
        {relTime(ws.last_seen_at)}
      </td>
    </tr>
  );
}
