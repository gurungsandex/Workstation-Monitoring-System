"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { Shell } from "@/components/shell/Shell";
import { EnrollModal } from "@/components/network/EnrollModal";
import {
  discovery, enrollment,
  type DiscoveredHost, type ScanSession, type EnrolledWorkstation,
} from "@/lib/api";

type Tab = "hosts" | "enrolled" | "sessions";

const STATUS_COLOR: Record<string, string> = {
  healthy: "var(--healthy)", warning: "var(--warning)",
  critical: "var(--critical)", offline: "var(--text-faint)",
};

function relTime(iso?: string) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

const TH = ({ children }: { children: React.ReactNode }) => (
  <th style={{ padding: "8px 14px", textAlign: "left", color: "var(--text-dim)", fontWeight: 500, fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>
    {children}
  </th>
);

export default function NetworkPage() {
  const [tab, setTab] = useState<Tab>("hosts");
  const [hosts, setHosts] = useState<DiscoveredHost[]>([]);
  const [enrolled, setEnrolled] = useState<EnrolledWorkstation[]>([]);
  const [sessions, setSessions] = useState<ScanSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [showEnroll, setShowEnroll] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [cidrs, setCidrs] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const [h, e, s] = await Promise.all([
        discovery.hosts(), enrollment.list(), discovery.sessions(),
      ]);
      setHosts(h); setEnrolled(e); setSessions(s);
    } catch { /* unauthenticated — server will 401 */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runScan() {
    setScanError(""); setScanning(true);
    try {
      const parsed = cidrs.trim() ? cidrs.split(",").map((c) => c.trim()).filter(Boolean) : undefined;
      const { session_id } = await discovery.scan(parsed);
      setSessions((prev) => [{
        id: session_id, cidr: parsed?.join(",") ?? "auto",
        started_at: new Date().toISOString(), host_count: 0, status: "running",
      }, ...prev]);
      setTab("sessions");
      let attempts = 0;
      let errors = 0;
      pollRef.current = setInterval(async () => {
        attempts++;
        try {
          const s = await discovery.session(session_id);
          errors = 0; // reset on success
          setSessions((prev) => prev.map((x) => (x.id === session_id ? s : x)));
          if (s.status !== "running" || attempts > 120) {
            clearInterval(pollRef.current!); setScanning(false);
            if (s.status === "done") load();
          }
        } catch {
          errors++;
          // Only abort after 5 consecutive failures (ignore transient 429 / hiccup)
          if (errors >= 5) { clearInterval(pollRef.current!); setScanning(false); }
        }
      }, 2000);
    } catch (e: unknown) {
      setScanError(e instanceof Error ? e.message : "Scan failed"); setScanning(false);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this agent? The workstation will go offline.")) return;
    setRevoking(id);
    try { await enrollment.revoke(id); setEnrolled((prev) => prev.filter((e) => e.id !== id)); }
    finally { setRevoking(null); }
  }

  const tabCounts = {
    hosts: hosts.length,
    enrolled: enrolled.filter((e) => e.is_enrolled).length,
    sessions: sessions.length,
  };

  return (
    <Shell title="Network" subtitle="Discover hosts, enroll agents, manage workstations">
      {showEnroll && <EnrollModal onClose={() => { setShowEnroll(false); load(); }} />}

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 20 }}>
        <input
          value={cidrs} onChange={(e) => setCidrs(e.target.value)}
          placeholder="CIDRs to scan, e.g. 192.168.1.0/24  (leave blank for defaults)"
          style={{ flex: 1, minWidth: 240, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, padding: "7px 10px", color: "var(--text)", fontSize: 13, outline: "none" }}
        />
        <button className="btn" onClick={runScan} disabled={scanning}
          style={{ background: "var(--card-2)", border: "1px solid var(--border)", whiteSpace: "nowrap" }}>
          {scanning
            ? <><SpinDot /> Scanning…</>
            : "▶  Run Scan"}
        </button>
        <button className="btn" onClick={() => setShowEnroll(true)}
          style={{ background: "var(--info)", color: "#fff", whiteSpace: "nowrap" }}>
          + Enroll Workstation
        </button>
      </div>

      {scanError && (
        <div style={{ marginBottom: 12, padding: "8px 12px", background: "rgba(255,77,125,0.1)", borderRadius: 6, color: "var(--critical)", fontSize: 13 }}>
          {scanError}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
        {(["hosts", "enrolled", "sessions"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: "none", border: "none", cursor: "pointer", padding: "8px 16px", fontSize: 13,
            color: tab === t ? "var(--text)" : "var(--text-dim)",
            borderBottom: tab === t ? "2px solid var(--info)" : "2px solid transparent", marginBottom: -1,
          }}>
            {{
              hosts: `Discovered Hosts (${tabCounts.hosts})`,
              enrolled: `Enrolled (${tabCounts.enrolled})`,
              sessions: `Scan Sessions (${tabCounts.sessions})`,
            }[t]}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-dim)" }}>Loading…</div>
      ) : (
        <>
          {/* ── Discovered Hosts ── */}
          {tab === "hosts" && (
            <div className="card" style={{ overflow: "auto" }}>
              {hosts.length === 0
                ? <Empty>No hosts discovered yet — run a scan to find devices on the network.</Empty>
                : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead><tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <TH>IP Address</TH><TH>Hostname</TH><TH>MAC</TH><TH>Last Scanned</TH><TH>Status</TH>
                    </tr></thead>
                    <tbody>
                      {hosts.map((h) => (
                        <tr key={h.id} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--info)" }}>{h.ip}</td>
                          <td style={{ padding: "10px 14px", color: "var(--text)" }}>{h.hostname ?? <Faint>unknown</Faint>}</td>
                          <td style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>{h.mac ?? "—"}</td>
                          <td style={{ padding: "10px 14px", color: "var(--text-dim)" }}>{relTime(h.last_scanned)}</td>
                          <td style={{ padding: "10px 14px" }}>
                            {h.is_enrolled
                              ? <StatusBadge color="var(--healthy)">Enrolled{h.ws_hostname ? ` (${h.ws_hostname})` : ""}</StatusBadge>
                              : <button className="btn" onClick={() => setShowEnroll(true)}
                                  style={{ fontSize: 11, padding: "3px 10px", background: "var(--card-2)", border: "1px solid var(--border)" }}>
                                  Enroll
                                </button>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
            </div>
          )}

          {/* ── Enrolled Workstations ── */}
          {tab === "enrolled" && (
            <div className="card" style={{ overflow: "auto" }}>
              {enrolled.length === 0
                ? <Empty>No workstations enrolled yet — click &quot;Enroll Workstation&quot; to get started.</Empty>
                : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead><tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <TH>Workstation</TH><TH>OS</TH><TH>Status</TH><TH>Enrolled</TH><TH>Last Seen</TH><TH>Agent</TH><TH>{" "}</TH>
                    </tr></thead>
                    <tbody>
                      {enrolled.map((ws) => (
                        <tr key={ws.id} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "10px 14px" }}>
                            <div style={{ fontWeight: 500, color: "var(--text)" }}>{ws.hostname}</div>
                            {ws.dept && <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{ws.dept}</div>}
                            {ws.ip && <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}>{ws.ip}</div>}
                          </td>
                          <td style={{ padding: "10px 14px", color: "var(--text-dim)", fontSize: 12 }}>{ws.os_family ?? "—"}</td>
                          <td style={{ padding: "10px 14px" }}>
                            <StatusBadge color={STATUS_COLOR[ws.status] ?? "var(--text-dim)"}>{ws.status}</StatusBadge>
                          </td>
                          <td style={{ padding: "10px 14px", color: "var(--text-dim)" }}>{relTime(ws.enrolled_at)}</td>
                          <td style={{ padding: "10px 14px", color: ws.last_seen_at ? "var(--text-dim)" : "var(--text-faint)" }}>{relTime(ws.last_seen_at)}</td>
                          <td style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-faint)" }}>{ws.agent_version ?? "—"}</td>
                          <td style={{ padding: "10px 14px" }}>
                            {ws.is_enrolled && (
                              <button className="btn" onClick={() => revoke(ws.id)} disabled={revoking === ws.id}
                                style={{ fontSize: 11, padding: "3px 10px", background: "rgba(255,77,125,0.1)", border: "1px solid rgba(255,77,125,0.25)", color: "var(--critical)" }}>
                                {revoking === ws.id ? "…" : "Revoke"}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
            </div>
          )}

          {/* ── Scan Sessions ── */}
          {tab === "sessions" && (
            <div className="card" style={{ overflow: "auto" }}>
              {sessions.length === 0
                ? <Empty>No scan sessions yet — run a scan above.</Empty>
                : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead><tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <TH>CIDR</TH><TH>Status</TH><TH>Hosts Found</TH><TH>Started</TH><TH>Duration</TH><TH>By</TH>
                    </tr></thead>
                    <tbody>
                      {sessions.map((s) => {
                        const dur = s.completed_at
                          ? Math.round((new Date(s.completed_at).getTime() - new Date(s.started_at).getTime()) / 1000)
                          : null;
                        return (
                          <tr key={s.id} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)" }}>{s.cidr}</td>
                            <td style={{ padding: "10px 14px" }}>
                              {s.status === "running"
                                ? <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--info)", fontSize: 12 }}><SpinDot /> running</span>
                                : <StatusBadge color={s.status === "done" ? "var(--healthy)" : "var(--critical)"}>{s.status}</StatusBadge>
                              }
                            </td>
                            <td style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)" }}>{s.host_count}</td>
                            <td style={{ padding: "10px 14px", color: "var(--text-dim)" }}>{relTime(s.started_at)}</td>
                            <td style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)" }}>{dur != null ? `${dur}s` : "—"}</td>
                            <td style={{ padding: "10px 14px", color: "var(--text-dim)", fontSize: 12 }}>{s.started_by_email ?? "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
            </div>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </Shell>
  );
}

// ── Micro-components ──────────────────────────────────────────────────────────

function SpinDot() {
  return (
    <span style={{
      display: "inline-block", width: 9, height: 9, borderRadius: "50%",
      border: "2px solid currentColor", borderTopColor: "transparent",
      animation: "spin 0.8s linear infinite", flexShrink: 0,
    }} />
  );
}

function StatusBadge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color, fontSize: 12 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
      {children}
    </span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: 36, textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>
      {children}
    </div>
  );
}

function Faint({ children }: { children: React.ReactNode }) {
  return <span style={{ color: "var(--text-faint)" }}>{children}</span>;
}
