"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { Shell } from "@/components/shell/Shell";
import { EnrollModal } from "@/components/network/EnrollModal";
import {
  discovery, enrollment, deploy,
  type DiscoveredHost, type ScanSession, type EnrolledWorkstation, type DeployParams,
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
  const [deployTarget, setDeployTarget] = useState<DiscoveredHost | null>(null);
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
      {showEnroll   && <EnrollModal onClose={() => { setShowEnroll(false); load(); }} />}
      {deployTarget && <DeployModal host={deployTarget} onClose={() => { setDeployTarget(null); load(); }} />}

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
                      <TH>IP Address</TH><TH>Hostname</TH><TH>MAC</TH><TH>Last Scanned</TH><TH>Status</TH><TH>{" "}</TH>
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
                              : <StatusBadge color="var(--text-faint)">Not enrolled</StatusBadge>
                            }
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            {!h.is_enrolled && (
                              <button className="btn" onClick={() => setDeployTarget(h)}
                                style={{ fontSize: 11, padding: "3px 10px", background: "color-mix(in oklab,var(--info) 12%,transparent)", border: "1px solid color-mix(in oklab,var(--info) 30%,transparent)", color: "var(--info)", whiteSpace: "nowrap" }}>
                                ⬆ Deploy Agent
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

// ── DeployModal ───────────────────────────────────────────────────────────────

function DeployModal({ host, onClose }: { host: DiscoveredHost; onClose: () => void }) {
  const [sshUser, setSshUser]         = useState("root");
  const [sshPassword, setSshPassword] = useState("");
  const [sshPort, setSshPort]         = useState("22");
  const [hostname, setHostname]       = useState(host.hostname ?? host.ip);
  const [dept, setDept]               = useState("");
  const [owner, setOwner]             = useState("");
  const [deploying, setDeploying]     = useState(false);
  const [logs, setLogs]               = useState<string[]>([]);
  const [done, setDone]               = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  async function runDeploy(e: React.FormEvent) {
    e.preventDefault();
    setDeploying(true);
    setLogs([]);

    const params: DeployParams = {
      host_id:      host.id,
      ip:           host.ip,
      ssh_user:     sshUser,
      ssh_password: sshPassword,
      ssh_port:     parseInt(sshPort) || 22,
      hostname,
      dept:         dept || undefined,
      owner:        owner || undefined,
    };

    try {
      const res = await deploy.run(params);
      if (!res.body) { setLogs(["[error] No response body"]); setDeploying(false); return; }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buf     = "";

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        lines.filter(Boolean).forEach((l) => setLogs((prev) => [...prev, l]));
      }
      if (buf) setLogs((prev) => [...prev, buf]);
    } catch (err: unknown) {
      setLogs((prev) => [...prev, `[error] ${err instanceof Error ? err.message : String(err)}`]);
    }

    setDeploying(false);
    setDone(true);
  }

  const OVERLAY: React.CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
  };
  const MODAL: React.CSSProperties = {
    background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12,
    padding: 28, width: 540, maxWidth: "95vw", display: "flex", flexDirection: "column", gap: 18,
  };
  const INPUT: React.CSSProperties = {
    background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 8,
    padding: "8px 12px", color: "var(--text)", fontSize: 13, outline: "none", width: "100%",
  };

  return (
    <div style={OVERLAY} onClick={(e) => e.target === e.currentTarget && !deploying && onClose()}>
      <div style={MODAL}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Deploy Agent via SSH</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 3 }}>
              Target: <span style={{ fontFamily: "var(--font-mono)", color: "var(--info)" }}>{host.ip}</span>
              {host.hostname && <span style={{ marginLeft: 6, color: "var(--text-faint)" }}>({host.hostname})</span>}
            </div>
          </div>
          {!deploying && (
            <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-dim)", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>×</button>
          )}
        </div>

        {!done ? (
          <form onSubmit={runDeploy} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: 10 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>SSH User</label>
                <input value={sshUser} onChange={(e) => setSshUser(e.target.value)} required style={INPUT} placeholder="root" />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Port</label>
                <input value={sshPort} onChange={(e) => setSshPort(e.target.value)} style={INPUT} placeholder="22" />
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>SSH Password</label>
              <input type="password" value={sshPassword} onChange={(e) => setSshPassword(e.target.value)} style={INPUT} placeholder="Password or leave blank if using key auth" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Workstation Name</label>
                <input value={hostname} onChange={(e) => setHostname(e.target.value)} required style={INPUT} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Dept</label>
                <input value={dept} onChange={(e) => setDept(e.target.value)} style={INPUT} placeholder="e.g. Engineering" />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, gridColumn: "2 / -1" }}>
                <label style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Owner</label>
                <input value={owner} onChange={(e) => setOwner(e.target.value)} style={INPUT} placeholder="e.g. John Doe" />
              </div>
            </div>
            <button type="submit" disabled={deploying}
              style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "var(--info)", color: "#04070d", fontWeight: 700, fontSize: 13, cursor: deploying ? "not-allowed" : "pointer", opacity: deploying ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {deploying ? <><SpinDot /> Deploying…</> : "⬆  Deploy Agent"}
            </button>
          </form>
        ) : (
          <button onClick={onClose}
            style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--card-2)", color: "var(--text)", fontSize: 13, cursor: "pointer" }}>
            Close
          </button>
        )}

        {/* Log output */}
        {logs.length > 0 && (
          <div ref={logRef} style={{
            background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8,
            padding: 12, maxHeight: 220, overflowY: "auto",
            fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.6,
            display: "flex", flexDirection: "column", gap: 1,
          }}>
            {logs.map((l, i) => (
              <div key={i} style={{
                color: l.startsWith("[error]") ? "var(--critical)"
                     : l.startsWith("[stderr]") ? "var(--warning)"
                     : l.includes("✓") ? "var(--healthy)"
                     : l.includes("✗") ? "var(--critical)"
                     : "var(--text-dim)",
              }}>{l}</div>
            ))}
            {deploying && <div style={{ color: "var(--info)", display: "flex", alignItems: "center", gap: 6 }}><SpinDot /> running…</div>}
          </div>
        )}
      </div>
    </div>
  );
}
