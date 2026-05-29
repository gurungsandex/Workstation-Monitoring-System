"use client";
import { useState } from "react";
import { enrollment, type EnrollTokenResponse } from "@/lib/api";

interface Props {
  onClose: () => void;
}

type Tab = "linux" | "macos" | "windows";

export function EnrollModal({ onClose }: Props) {
  const [hostname, setHostname] = useState("");
  const [dept, setDept] = useState("");
  const [owner, setOwner] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<EnrollTokenResponse | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("linux");
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const res = await enrollment.generateToken({ hostname: hostname || undefined, dept: dept || undefined, owner: owner || undefined });
      setResult(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  const installCmd = result?.install[activeTab] ?? "";

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card" style={{ width: 560, maxWidth: "calc(100vw - 32px)", padding: 28 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600 }}>
              Enroll New Workstation
            </div>
            <div className="label" style={{ marginTop: 2 }}>
              Generate a one-time enrollment token
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", fontSize: 20, lineHeight: 1 }}>
            ✕
          </button>
        </div>

        {!result ? (
          <>
            {/* Form */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { label: "Hostname (optional)", value: hostname, set: setHostname, placeholder: "e.g. ws-dev-01" },
                { label: "Department (optional)", value: dept, set: setDept, placeholder: "e.g. Engineering" },
                { label: "Owner (optional)", value: owner, set: setOwner, placeholder: "e.g. Jane Smith" },
              ].map(({ label, value, set, placeholder }) => (
                <label key={label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span className="label">{label}</span>
                  <input
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    placeholder={placeholder}
                    style={{
                      background: "var(--card-2)", border: "1px solid var(--border)",
                      borderRadius: 6, padding: "8px 10px",
                      color: "var(--text)", fontSize: 13, outline: "none",
                    }}
                  />
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
              <button
                className="btn"
                onClick={generate}
                disabled={loading}
                style={{ background: "var(--info)", color: "#fff", opacity: loading ? 0.6 : 1 }}
              >
                {loading ? "Generating…" : "Generate Token"}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Token display */}
            <div style={{ marginBottom: 16 }}>
              <div className="label" style={{ marginBottom: 6 }}>Enrollment Token</div>
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: 12,
                background: "var(--card-2)", border: "1px solid var(--border)",
                borderRadius: 6, padding: "10px 12px",
                color: "var(--healthy)", wordBreak: "break-all",
              }}>
                {result.enrollment_token}
              </div>
              <div className="label" style={{ marginTop: 4 }}>
                Workstation ID: <span style={{ color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 11 }}>{result.workstation_id}</span>
              </div>
            </div>

            {/* OS tabs */}
            <div className="label" style={{ marginBottom: 8 }}>Install Command</div>
            <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
              {(["linux", "macos", "windows"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  style={{
                    padding: "4px 12px", borderRadius: 4, fontSize: 12, cursor: "pointer", border: "none",
                    background: activeTab === t ? "var(--info)" : "var(--card-2)",
                    color: activeTab === t ? "#fff" : "var(--text-dim)",
                  }}
                >
                  {t === "linux" ? "Linux" : t === "macos" ? "macOS" : "Windows"}
                </button>
              ))}
            </div>

            <div style={{ position: "relative" }}>
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: 11,
                background: "var(--card-2)", border: "1px solid var(--border)",
                borderRadius: 6, padding: "10px 12px 10px 12px",
                color: "var(--text)", whiteSpace: "pre-wrap", wordBreak: "break-all",
                paddingRight: 60,
              }}>
                {installCmd}
              </div>
              <button
                onClick={() => copy(installCmd)}
                style={{
                  position: "absolute", top: 8, right: 8,
                  background: "var(--card-3)", border: "1px solid var(--border)",
                  borderRadius: 4, padding: "3px 8px", cursor: "pointer",
                  fontSize: 11, color: copied ? "var(--healthy)" : "var(--text-dim)",
                }}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>

            <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(76,141,255,0.08)", borderRadius: 6, fontSize: 12, color: "var(--text-dim)" }}>
              Run on the target workstation. The token is single-use and expires after first enrollment.
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn" onClick={onClose} style={{ background: "var(--info)", color: "#fff" }}>Done</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
