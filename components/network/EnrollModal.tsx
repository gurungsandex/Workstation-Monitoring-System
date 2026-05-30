"use client";
import { useState } from "react";
import { enrollment, type EnrollTokenResponse } from "@/lib/api";

interface Props { onClose: () => void }
type Tab = "macos" | "linux" | "windows";

export function EnrollModal({ onClose }: Props) {
  const [hostname, setHostname] = useState("");
  const [dept, setDept]         = useState("");
  const [owner, setOwner]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [result, setResult]     = useState<EnrollTokenResponse | null>(null);
  const [tab, setTab]           = useState<Tab>("macos");
  const [copied, setCopied]     = useState<string | null>(null);

  async function generate() {
    setLoading(true); setError("");
    try {
      setResult(await enrollment.generateToken({
        hostname: hostname || undefined,
        dept:     dept     || undefined,
        owner:    owner    || undefined,
      }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally { setLoading(false); }
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    });
  }

  const OVERLAY: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 100,
    background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
    display: "flex", alignItems: "center", justifyContent: "center",
  };
  const INPUT: React.CSSProperties = {
    background: "var(--card-2)", border: "1px solid var(--border)", borderRadius: 6,
    padding: "8px 10px", color: "var(--text)", fontSize: 13, outline: "none",
  };
  const CODE: React.CSSProperties = {
    fontFamily: "var(--font-mono)", fontSize: 12,
    background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6,
    padding: "10px 44px 10px 12px", color: "var(--text)",
    whiteSpace: "pre-wrap", wordBreak: "break-all", lineHeight: 1.6,
  };

  const cmd = result?.install[tab] ?? "";

  return (
    <div style={OVERLAY} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card" style={{ width: 580, maxWidth: "calc(100vw - 32px)", padding: 28 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600 }}>
              Enroll Workstation
            </div>
            <div className="label" style={{ marginTop: 3 }}>
              No SSH or credentials needed on the target
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", fontSize: 20, lineHeight: 1, padding: 0 }}>✕</button>
        </div>

        {!result ? (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {([
                ["Hostname (optional)", hostname, setHostname, "e.g. ws-dev-01"],
                ["Department (optional)", dept, setDept, "e.g. Engineering"],
                ["Owner (optional)", owner, setOwner, "e.g. Jane Smith"],
              ] as [string, string, (v: string) => void, string][]).map(([label, value, set, placeholder]) => (
                <label key={label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span className="label">{label}</span>
                  <input value={value} onChange={(e) => set(e.target.value)}
                    placeholder={placeholder} style={INPUT} />
                </label>
              ))}
            </div>

            {error && (
              <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(255,77,125,0.12)", borderRadius: 6, color: "var(--critical)", fontSize: 13 }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
              <button className="btn" onClick={onClose} style={{ background: "var(--card-2)" }}>Cancel</button>
              <button className="btn" onClick={generate} disabled={loading}
                style={{ background: "var(--info)", color: "#fff", opacity: loading ? 0.6 : 1 }}>
                {loading ? "Generating…" : "Generate Install Link"}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* How it works */}
            <div style={{ marginBottom: 18, padding: "12px 14px", background: "rgba(76,141,255,0.07)", border: "1px solid rgba(76,141,255,0.18)", borderRadius: 8, fontSize: 13, lineHeight: 1.6, color: "var(--text-dim)" }}>
              <strong style={{ color: "var(--info)" }}>How to use:</strong> Go to the target workstation, open Terminal, and paste the command below.
              That&apos;s it — no SSH, no passwords, no Go required. The agent binary is downloaded automatically from this server.
            </div>

            {/* Share URL */}
            <div style={{ marginBottom: 16 }}>
              <div className="label" style={{ marginBottom: 6 }}>
                Share this link — or run it directly on the target
              </div>
              <div style={{ position: "relative" }}>
                <div style={{ ...CODE, color: "var(--info)", paddingRight: 70 }}>
                  {result.install.url}
                </div>
                <button onClick={() => copy(result.install.url, "url")}
                  style={{ position: "absolute", top: "50%", right: 8, transform: "translateY(-50%)", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontSize: 11, color: copied === "url" ? "var(--healthy)" : "var(--text-dim)", whiteSpace: "nowrap" }}>
                  {copied === "url" ? "✓ Copied" : "Copy URL"}
                </button>
              </div>
            </div>

            {/* OS tabs */}
            <div className="label" style={{ marginBottom: 8 }}>Install Command</div>
            <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
              {(["macos", "linux", "windows"] as Tab[]).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  style={{ padding: "4px 14px", borderRadius: 4, fontSize: 12, cursor: "pointer", border: "none",
                    background: tab === t ? "var(--info)" : "var(--card-2)",
                    color: tab === t ? "#fff" : "var(--text-dim)" }}>
                  {t === "macos" ? "macOS" : t === "linux" ? "Linux" : "Windows"}
                </button>
              ))}
            </div>

            <div style={{ position: "relative" }}>
              <div style={CODE}>{cmd}</div>
              <button onClick={() => copy(cmd, "cmd")}
                style={{ position: "absolute", top: 8, right: 8, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontSize: 11, color: copied === "cmd" ? "var(--healthy)" : "var(--text-dim)" }}>
                {copied === "cmd" ? "✓" : "Copy"}
              </button>
            </div>

            {tab === "windows" && (
              <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-faint)" }}>
                Run in PowerShell as Administrator on the target Windows machine.
              </div>
            )}

            <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(158,227,79,0.06)", border: "1px solid rgba(158,227,79,0.15)", borderRadius: 6, fontSize: 12, color: "var(--text-dim)" }}>
              Token is single-use. Once the agent enrolls it becomes a permanent workstation entry.
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn" onClick={onClose}
                style={{ background: "var(--info)", color: "#fff" }}>Done</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
