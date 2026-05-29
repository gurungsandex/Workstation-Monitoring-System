"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Shell } from "@/components/shell/Shell";
import { useLive } from "@/lib/LiveContext";
import { alerts as alertsApi, type AlertRow, type AlertSummary } from "@/lib/api";

function relTime(iso?: string | null) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function durStr(min?: number | null) {
  if (!min) return "—";
  if (min < 60) return `${min}m`;
  if (min < 1440) return `${Math.floor(min / 60)}h ${min % 60}m`;
  return `${Math.floor(min / 1440)}d`;
}

type FilterTab = "active" | "acked" | "resolved";
type SevFilter = "all" | "critical" | "warning";

export default function AlertsPage() {
  const { alertBadge } = useLive();

  const [tab, setTab] = useState<FilterTab>("active");
  const [sev, setSev] = useState<SevFilter>("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<AlertRow[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<AlertSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [acking, setAcking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        limit: "100",
      };
      if (tab === "active")   { params.resolved = "false"; }
      if (tab === "acked")    { params.resolved = "false"; }
      if (tab === "resolved") { params.resolved = "true"; }
      if (sev !== "all") params.severity = sev;

      const [listRes, sumRes] = await Promise.all([
        alertsApi.list(params),
        alertsApi.summary(),
      ]);

      let filtered = listRes.rows;
      if (tab === "acked")  filtered = filtered.filter((r) => r.is_ack);
      if (tab === "active") filtered = filtered.filter((r) => !r.is_ack);
      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(
          (r) =>
            r.hostname.toLowerCase().includes(q) ||
            r.metric.toLowerCase().includes(q) ||
            (r.dept ?? "").toLowerCase().includes(q)
        );
      }
      setRows(filtered);
      setTotal(listRes.total);
      setSummary(sumRes);
    } finally {
      setLoading(false);
    }
  }, [tab, sev, search]);

  useEffect(() => { load(); }, [load]);

  // Re-fetch when live alert badge changes (new alert opened/resolved)
  useEffect(() => { load(); }, [alertBadge]); // eslint-disable-line react-hooks/exhaustive-deps

  async function ackSelected() {
    if (selected.size === 0) return;
    setAcking(true);
    try {
      await alertsApi.ack(Array.from(selected));
      setSelected(new Set());
      await load();
    } finally {
      setAcking(false);
    }
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const ackable = rows.filter((r) => !r.is_ack && !r.is_resolved);
    if (selected.size === ackable.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(ackable.map((r) => r.id)));
    }
  }

  const ackable = rows.filter((r) => !r.is_ack && !r.is_resolved);

  return (
    <Shell title="Alerts Center" subtitle="Active threshold breaches and history">
      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Summary strip */}
        {summary && (
          <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
            {[
              { label: "Active Critical", value: summary.activeCritical, color: "var(--critical)" },
              { label: "Active Warning",  value: summary.activeWarning,  color: "var(--warning)" },
              { label: "Acknowledged",    value: summary.acknowledged,   color: "var(--info)" },
              { label: "Resolved (24h)",  value: summary.resolved24h,    color: "var(--healthy)" },
            ].map(({ label, value, color }) => (
              <div key={label} className="card" style={{ padding: "16px 20px" }}>
                <div className="label" style={{ marginBottom: 6 }}>{label}</div>
                <div className="mono" style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tab bar + filters */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {(["active", "acked", "resolved"] as FilterTab[]).map((t) => (
            <button key={t} onClick={() => { setTab(t); setSelected(new Set()); }}
              style={{
                padding: "5px 16px", borderRadius: 6, border: "1px solid",
                borderColor: tab === t ? "var(--info)" : "var(--border)",
                background: tab === t ? "color-mix(in oklab,var(--info) 12%,transparent)" : "var(--card)",
                color: tab === t ? "var(--info)" : "var(--text-dim)",
                fontSize: 12, cursor: "pointer", textTransform: "capitalize",
              }}>
              {t === "active" ? "Active" : t === "acked" ? "Acknowledged" : "Resolved"}
            </button>
          ))}

          <div style={{ flex: 1 }} />

          {/* Severity filter */}
          <select value={sev} onChange={(e) => setSev(e.target.value as SevFilter)}
            style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, padding: "5px 10px", color: "var(--text-dim)", fontSize: 12, cursor: "pointer" }}>
            <option value="all">All severity</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
          </select>

          {/* Search */}
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search host, metric…"
            style={{
              background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6,
              padding: "5px 10px", color: "var(--text)", fontSize: 12, outline: "none", width: 200,
            }} />
        </div>

        {/* Ack toolbar */}
        {tab !== "resolved" && ackable.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={toggleAll}
              style={{ fontSize: 12, color: "var(--text-dim)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              {selected.size === ackable.length ? "Deselect all" : `Select all (${ackable.length})`}
            </button>
            {selected.size > 0 && (
              <button onClick={ackSelected} disabled={acking}
                style={{
                  padding: "5px 14px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                  background: "color-mix(in oklab,var(--info) 15%,transparent)",
                  border: "1px solid color-mix(in oklab,var(--info) 30%,transparent)",
                  color: "var(--info)",
                }}>
                {acking ? "Acknowledging…" : `Acknowledge ${selected.size}`}
              </button>
            )}
          </div>
        )}

        {/* Table */}
        <div className="card" style={{ overflow: "auto" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-dim)" }}>Loading…</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>
              {tab === "active" ? "No active alerts — fleet looks healthy." : "No alerts match filters."}
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {tab !== "resolved" && (
                    <th style={{ width: 36, padding: "8px 14px" }} />
                  )}
                  <th style={TH}>Severity</th>
                  <th style={TH}>Workstation</th>
                  <th style={TH}>Metric</th>
                  <th style={TH}>Value</th>
                  <th style={TH}>Threshold</th>
                  <th style={TH}>Duration</th>
                  <th style={TH}>Started</th>
                  <th style={TH}>Status</th>
                  <th style={TH}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <AlertTableRow
                    key={r.id}
                    row={r}
                    showCheckbox={tab !== "resolved"}
                    checked={selected.has(r.id)}
                    onCheck={() => toggleRow(r.id)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && rows.length > 0 && (
          <div style={{ fontSize: 11, color: "var(--text-faint)", textAlign: "right" }}>
            Showing {rows.length} of {total} alerts
          </div>
        )}
      </div>
    </Shell>
  );
}

const TH: React.CSSProperties = {
  padding: "8px 14px", textAlign: "left",
  color: "var(--text-dim)", fontWeight: 500, fontSize: 11,
  textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap",
};

function AlertTableRow({
  row, showCheckbox, checked, onCheck,
}: {
  row: AlertRow;
  showCheckbox: boolean;
  checked: boolean;
  onCheck: () => void;
}) {
  const sevColor = row.severity === "critical" ? "var(--critical)" : "var(--warning)";
  const canCheck = showCheckbox && !row.is_ack && !row.is_resolved;

  return (
    <tr
      style={{ borderBottom: "1px solid var(--border)", transition: "background .1s" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,.02)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {showCheckbox && (
        <td style={{ padding: "10px 14px", width: 36 }}>
          {canCheck && (
            <input type="checkbox" checked={checked} onChange={onCheck}
              style={{ cursor: "pointer", accentColor: "var(--info)" }} />
          )}
        </td>
      )}

      {/* Severity */}
      <td style={{ padding: "10px 14px" }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          color: sevColor, fontSize: 11, fontWeight: 600, textTransform: "capitalize",
          padding: "2px 8px", borderRadius: 4,
          background: `color-mix(in oklab,${sevColor} 12%,transparent)`,
          border: `1px solid color-mix(in oklab,${sevColor} 25%,transparent)`,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: sevColor }} />
          {row.severity}
        </span>
      </td>

      {/* Workstation */}
      <td style={{ padding: "10px 14px" }}>
        <Link href={`/workstations/${row.workstation_id}`} style={{ textDecoration: "none" }}>
          <div style={{ fontWeight: 600, color: "var(--text)", fontSize: 13 }}>{row.hostname}</div>
          {row.dept && <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{row.dept}</div>}
        </Link>
      </td>

      {/* Metric */}
      <td style={{ padding: "10px 14px", color: "var(--text)", fontWeight: 500 }}>{row.metric}</td>

      {/* Value */}
      <td style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 12, color: sevColor, fontWeight: 600 }}>
        {row.value ?? "—"}
      </td>

      {/* Threshold */}
      <td style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
        {row.threshold}
      </td>

      {/* Duration */}
      <td style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)" }}>
        {row.is_resolved ? durStr(row.duration_min) : relTime(row.started_at)}
      </td>

      {/* Started */}
      <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-dim)", whiteSpace: "nowrap" }}>
        {relTime(row.started_at)}
      </td>

      {/* Status */}
      <td style={{ padding: "10px 14px" }}>
        {row.is_resolved ? (
          <span style={{ fontSize: 11, color: "var(--healthy)", fontWeight: 600 }}>Resolved</span>
        ) : row.is_ack ? (
          <span style={{ fontSize: 11, color: "var(--info)" }}>
            Acked by {row.ack_by ?? "?"}
          </span>
        ) : (
          <span style={{ fontSize: 11, color: sevColor, fontWeight: 600 }}>Open</span>
        )}
      </td>

      {/* Recommended action */}
      <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--text-faint)", maxWidth: 220 }}>
        {row.action ?? "—"}
      </td>
    </tr>
  );
}
