"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/api";
import { Icon } from "@/components/ui/Icon";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  // If already logged in, skip login
  useEffect(() => {
    auth.me().then(() => router.replace("/")).catch(() => {});
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await auth.login(email.trim(), password);
      router.replace("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid credentials");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg)", padding: 24,
    }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 36, justifyContent: "center" }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: "linear-gradient(135deg, var(--info), var(--network))",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 24px color-mix(in oklab, var(--info) 40%, transparent)",
          }}>
            <Icon name="pulse" size={20} color="#04070d" stroke={2.4} />
          </div>
          <div>
            <div className="display" style={{ fontWeight: 700, fontSize: 17, letterSpacing: "-.01em" }}>
              WorkstationMonSys
            </div>
            <div className="mono" style={{ fontSize: 9, color: "var(--text-faint)", letterSpacing: ".08em" }}>
              FLEET TELEMETRY
            </div>
          </div>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: "32px 28px" }}>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", margin: 0 }}>Sign in</h1>
            <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 4 }}>
              Enter your admin or viewer credentials.
            </p>
          </div>

          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label className="label">Email</label>
              <input
                type="email" required autoFocus
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@wms.local"
                style={{
                  background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 8,
                  padding: "9px 12px", color: "var(--text)", fontSize: 13, outline: "none",
                  transition: "border-color .15s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--info)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label className="label">Password</label>
              <input
                type="password" required
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 8,
                  padding: "9px 12px", color: "var(--text)", fontSize: 13, outline: "none",
                  transition: "border-color .15s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--info)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
              />
            </div>

            {error && (
              <div style={{
                padding: "9px 12px", borderRadius: 7, fontSize: 12,
                background: "rgba(255,77,125,0.08)", border: "1px solid rgba(255,77,125,0.2)",
                color: "var(--critical)",
              }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{
                marginTop: 4, padding: "10px 0", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer",
                background: loading ? "var(--border)" : "var(--info)",
                color: loading ? "var(--text-dim)" : "#04070d",
                border: "none", fontSize: 13, fontWeight: 700, transition: "opacity .15s",
                opacity: loading ? 0.7 : 1,
              }}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", fontSize: 11, color: "var(--text-faint)", marginTop: 20 }}>
          Default: admin@wms.local / changeme123
        </p>
      </div>
    </div>
  );
}
