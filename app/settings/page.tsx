"use client";
import { useEffect, useState, useCallback } from "react";
import { Shell } from "@/components/shell/Shell";
import { useAuth } from "@/lib/AuthContext";
import { auth, type UserRow, type AuditRow } from "@/lib/api";

function relTime(iso?: string | null) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

type Tab = "users" | "audit" | "password";

export default function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [tab, setTab] = useState<Tab>(isAdmin ? "users" : "password");

  return (
    <Shell title="Settings" subtitle="User management, audit log, and account">
      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 6, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
          {(isAdmin ? ["users", "audit", "password"] : ["password"]).map((t) => (
            <button key={t} onClick={() => setTab(t as Tab)}
              style={{
                padding: "8px 18px", borderRadius: "6px 6px 0 0", border: "1px solid",
                borderBottom: "none",
                borderColor: tab === t ? "var(--border)" : "transparent",
                background: tab === t ? "var(--card)" : "transparent",
                color: tab === t ? "var(--text)" : "var(--text-dim)",
                fontSize: 13, cursor: "pointer", textTransform: "capitalize",
                marginBottom: -1,
              }}>
              {t === "users" ? "Users" : t === "audit" ? "Audit Log" : "Change Password"}
            </button>
          ))}
        </div>

        {tab === "users"    && <UsersPanel />}
        {tab === "audit"    && <AuditPanel />}
        {tab === "password" && <PasswordPanel />}
      </div>
    </Shell>
  );
}

// ── Users panel ───────────────────────────────────────────────────────────────

function UsersPanel() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail]       = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole]         = useState("viewer");
  const [creating, setCreating]       = useState(false);
  const [createErr, setCreateErr]     = useState("");
  const [deleting, setDeleting]       = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setUsers(await auth.listUsers()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setCreateErr("");
    setCreating(true);
    try {
      await auth.createUser({ email: newEmail, password: newPassword, role: newRole });
      setNewEmail(""); setNewPassword(""); setNewRole("viewer");
      await load();
    } catch (err: unknown) {
      setCreateErr(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setCreating(false);
    }
  }

  async function deleteUser(id: string) {
    if (!confirm("Delete this user?")) return;
    setDeleting(id);
    try {
      await auth.deleteUser(id);
      await load();
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* User table */}
      <div className="card" style={{ overflow: "auto" }}>
        <div className="card-head"><div className="card-title">Accounts</div></div>
        {loading ? (
          <div style={{ padding: 24, color: "var(--text-dim)", fontSize: 13 }}>Loading…</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Email", "Role", "Created", "Last login", ""].map((h) => (
                  <th key={h} style={{ padding: "8px 14px", textAlign: "left", color: "var(--text-dim)", fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 14px", color: "var(--text)", fontWeight: 500 }}>
                    {u.email}
                    {u.id === me?.id && (
                      <span style={{ marginLeft: 6, fontSize: 10, color: "var(--info)", background: "color-mix(in oklab,var(--info) 12%,transparent)", padding: "1px 6px", borderRadius: 4 }}>you</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      color: u.role === "admin" ? "var(--warning)" : "var(--text-dim)",
                      background: u.role === "admin" ? "rgba(255,176,32,0.10)" : "var(--card-2)",
                      padding: "2px 8px", borderRadius: 4, textTransform: "capitalize",
                    }}>{u.role}</span>
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-dim)" }}>{relTime(u.created_at)}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-dim)" }}>{relTime(u.last_login_at)}</td>
                  <td style={{ padding: "10px 14px" }}>
                    {u.id !== me?.id && (
                      <button
                        onClick={() => deleteUser(u.id)}
                        disabled={deleting === u.id}
                        style={{ fontSize: 11, color: "var(--critical)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                        {deleting === u.id ? "…" : "Delete"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create user form */}
      <div className="card" style={{ maxWidth: 480 }}>
        <div className="card-head"><div className="card-title">Add user</div></div>
        <form onSubmit={createUser} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label className="label">Email</label>
            <input required type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
              placeholder="user@example.com"
              style={INPUT_STYLE} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label className="label">Password</label>
            <input required type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min 8 characters"
              style={INPUT_STYLE} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label className="label">Role</label>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value)}
              style={{ ...INPUT_STYLE, cursor: "pointer" }}>
              <option value="viewer">Viewer</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {createErr && <div style={{ fontSize: 12, color: "var(--critical)" }}>{createErr}</div>}
          <button type="submit" disabled={creating}
            style={{ padding: "9px 18px", borderRadius: 7, border: "none", cursor: creating ? "not-allowed" : "pointer", background: "var(--info)", color: "#04070d", fontWeight: 700, fontSize: 13, opacity: creating ? 0.7 : 1 }}>
            {creating ? "Creating…" : "Create user"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Audit log panel ────────────────────────────────────────────────────────────

function AuditPanel() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await auth.auditLog(page);
      setRows(res.rows);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="card" style={{ overflow: "auto" }}>
      <div className="card-head">
        <div className="card-title">Audit log</div>
        <span className="label">{total} entries</span>
      </div>
      {loading ? (
        <div style={{ padding: 24, color: "var(--text-dim)", fontSize: 13 }}>Loading…</div>
      ) : (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["When", "User", "Action", "Entity", "IP"].map((h) => (
                  <th key={h} style={{ padding: "8px 14px", textAlign: "left", color: "var(--text-dim)", fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "9px 14px", color: "var(--text-dim)", whiteSpace: "nowrap" }}>{relTime(r.created_at)}</td>
                  <td style={{ padding: "9px 14px", color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 11 }}>{r.email ?? "—"}</td>
                  <td style={{ padding: "9px 14px", color: "var(--text)", fontWeight: 500 }}>{r.action}</td>
                  <td style={{ padding: "9px 14px", color: "var(--text-dim)", fontSize: 11 }}>
                    {r.entity_type ? `${r.entity_type}` : ""}
                    {r.entity_id ? <span style={{ fontFamily: "var(--font-mono)", marginLeft: 4 }}>{r.entity_id.slice(0, 8)}…</span> : ""}
                  </td>
                  <td style={{ padding: "9px 14px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-faint)" }}>{r.ip_addr ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div style={{ display: "flex", gap: 8, padding: "12px 14px", justifyContent: "flex-end", alignItems: "center", borderTop: "1px solid var(--border)" }}>
              <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Page {page} of {totalPages}</span>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                style={PAGE_BTN}>← Prev</button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={PAGE_BTN}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Change password panel ──────────────────────────────────────────────────────

function PasswordPanel() {
  const [current, setCurrent]   = useState("");
  const [next, setNext]         = useState("");
  const [confirm, setConfirm]   = useState("");
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (next !== confirm) { setMsg({ ok: false, text: "Passwords do not match" }); return; }
    if (next.length < 8) { setMsg({ ok: false, text: "Password must be at least 8 characters" }); return; }
    setSaving(true);
    try {
      await auth.changePassword(current, next);
      setMsg({ ok: true, text: "Password changed successfully." });
      setCurrent(""); setNext(""); setConfirm("");
    } catch (err: unknown) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 420 }}>
      <div className="card-head"><div className="card-title">Change password</div></div>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {[
          { label: "Current password", value: current, set: setCurrent },
          { label: "New password",     value: next,    set: setNext },
          { label: "Confirm password", value: confirm, set: setConfirm },
        ].map(({ label, value, set }) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label className="label">{label}</label>
            <input required type="password" value={value} onChange={(e) => set(e.target.value)}
              placeholder="••••••••" style={INPUT_STYLE} />
          </div>
        ))}
        {msg && (
          <div style={{
            padding: "9px 12px", borderRadius: 7, fontSize: 12,
            background: msg.ok ? "rgba(158,227,79,0.08)" : "rgba(255,77,125,0.08)",
            border: `1px solid ${msg.ok ? "rgba(158,227,79,0.2)" : "rgba(255,77,125,0.2)"}`,
            color: msg.ok ? "var(--healthy)" : "var(--critical)",
          }}>{msg.text}</div>
        )}
        <button type="submit" disabled={saving}
          style={{ padding: "9px 18px", borderRadius: 7, border: "none", cursor: saving ? "not-allowed" : "pointer", background: "var(--info)", color: "#04070d", fontWeight: 700, fontSize: 13, opacity: saving ? 0.7 : 1 }}>
          {saving ? "Saving…" : "Update password"}
        </button>
      </form>
    </div>
  );
}

// ── Shared styles ──────────────────────────────────────────────────────────────

const INPUT_STYLE: React.CSSProperties = {
  background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 8,
  padding: "9px 12px", color: "var(--text)", fontSize: 13, outline: "none",
};

const PAGE_BTN: React.CSSProperties = {
  padding: "4px 12px", borderRadius: 6, border: "1px solid var(--border)",
  background: "var(--card)", color: "var(--text-dim)", fontSize: 12, cursor: "pointer",
};
