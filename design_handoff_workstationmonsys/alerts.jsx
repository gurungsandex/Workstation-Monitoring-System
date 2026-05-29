/* ============================================================
   alerts.jsx — Alerts Center (active / resolved, bulk ack)
   ============================================================ */
function AlertsCenter({ tick, onOpen }) {
  const [tab, setTab] = React.useState("active");
  const [sevF, setSevF] = React.useState("all");
  const [acked, setAcked] = React.useState({});
  const [sel, setSel] = React.useState({});

  const all = window.WMS.alerts;
  const base = all.filter((a) => (tab === "active" ? !a.resolved : a.resolved));
  let rows = base.filter((a) => sevF === "all" || a.sev === sevF);
  rows = rows.filter((a) => !(tab === "active" && acked[a.id]));
  rows.sort((a, b) => a.ageMin - b.ageMin);

  const activeCount = all.filter((a) => !a.resolved && !acked[a.id]).length;
  const resolvedCount = all.filter((a) => a.resolved).length;
  const sevCounts = { all: rows.length };
  ["critical", "warning"].forEach((s) => sevCounts[s] = base.filter((a) => a.sev === s && !(tab === "active" && acked[a.id])).length);

  const selIds = Object.keys(sel).filter((k) => sel[k]);
  function toggleSel(id) { setSel((s) => ({ ...s, [id]: !s[id] })); }
  function selectAll() {
    if (selIds.length === rows.length) setSel({});
    else { const n = {}; rows.forEach((r) => n[r.id] = true); setSel(n); }
  }
  function bulkAck() {
    setAcked((a) => { const n = { ...a }; selIds.forEach((id) => n[id] = true); return n; });
    setSel({});
  }

  return (
    <div className="view-enter" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      {/* summary strip */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {[
          { l: "Active critical", v: all.filter(a => !a.resolved && a.sev === "critical" && !acked[a.id]).length, c: "critical", icon: "alert" },
          { l: "Active warning", v: all.filter(a => !a.resolved && a.sev === "warning" && !acked[a.id]).length, c: "warning", icon: "bell" },
          { l: "Acknowledged", v: Object.values(acked).filter(Boolean).length, c: "info", icon: "check" },
          { l: "Resolved (24h)", v: resolvedCount, c: "healthy", icon: "clock" },
        ].map((s) => (
          <div key={s.l} className="card" style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `color-mix(in oklab, var(--${s.c}) 16%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
              <Icon name={s.icon} size={19} color={`var(--${s.c})`} />
            </div>
            <div>
              <div className="mono display" style={{ fontSize: 26, fontWeight: 600, lineHeight: 1 }}>{s.v}</div>
              <div className="label" style={{ marginTop: 3 }}>{s.l}</div>
            </div>
          </div>
        ))}
      </div>

      {/* tabs + filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 4 }}>
          {[["active", `Active · ${activeCount}`], ["resolved", `Resolved · ${resolvedCount}`]].map(([v, l]) => (
            <button key={v} onClick={() => { setTab(v); setSel({}); }} style={{
              padding: "7px 16px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600,
              background: tab === v ? "var(--card-3)" : "transparent", color: tab === v ? "var(--text)" : "var(--text-dim)",
            }}>{l}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["all", "critical", "warning"].map((s) => (
            <button key={s} className={`chip ${sevF === s ? "active" : ""}`} onClick={() => setSevF(s)}>
              {s !== "all" && <span className={`dot ${s}`} style={{ width: 7, height: 7 }} />}
              <span style={{ textTransform: "capitalize" }}>{s}</span>
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {tab === "active" && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {selIds.length > 0 && <span className="mono" style={{ fontSize: 12, color: "var(--text-dim)" }}>{selIds.length} selected</span>}
            <button className="btn" onClick={selectAll}>{selIds.length === rows.length && rows.length ? "Clear" : "Select all"}</button>
            <button className="btn primary" disabled={!selIds.length} onClick={bulkAck}><Icon name="check" size={15} /> Acknowledge</button>
          </div>
        )}
      </div>

      {/* list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.length === 0 && (
          <div className="card" style={{ padding: 48, textAlign: "center", color: "var(--text-faint)" }}>
            <Icon name="check" size={28} color="var(--healthy)" style={{ marginBottom: 10 }} />
            <div>No {tab} alerts{sevF !== "all" ? ` at ${sevF} severity` : ""}.</div>
          </div>
        )}
        {rows.map((a) => (
          <div key={a.id} className="card" style={{
            display: "flex", alignItems: "center", gap: 16, padding: "14px 18px",
            borderLeft: `3px solid var(--${a.sev})`,
          }}>
            {tab === "active" && (
              <button onClick={() => toggleSel(a.id)} style={{
                width: 20, height: 20, borderRadius: 5, flex: "none", cursor: "pointer",
                border: `1.5px solid ${sel[a.id] ? "var(--info)" : "var(--border-strong)"}`,
                background: sel[a.id] ? "var(--info)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center",
              }}>{sel[a.id] && <Icon name="check" size={13} color="#04070d" stroke={3} />}</button>
            )}
            <span className={`dot ${a.sev}`} style={{ flex: "none" }} />
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                <span className="display" style={{ fontWeight: 600, fontSize: 14 }}>{a.metric}</span>
                <span className={`badge ${a.sev}`}>{a.sev}</span>
              </div>
              <a href={`#/workstations/${a.wsId}`} className="mono" style={{ fontSize: 11.5, color: "var(--info)" }}>{a.ws}</a>
              <span className="mono" style={{ fontSize: 11.5, color: "var(--text-faint)" }}> · {a.dept}</span>
            </div>
            <div style={{ flex: "0 0 120px", textAlign: "center" }}>
              <div className="label">Value</div>
              <div className="mono" style={{ fontSize: 16, fontWeight: 600, color: `var(--${a.sev})` }}>{a.value}</div>
              <div className="mono" style={{ fontSize: 10, color: "var(--text-faint)" }}>thr {a.threshold}</div>
            </div>
            <div style={{ flex: "1 1 240px", minWidth: 0 }}>
              <div className="label">Suggested action</div>
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{a.action}</div>
            </div>
            <div style={{ flex: "0 0 90px", textAlign: "right" }}>
              <div className="mono" style={{ fontSize: 12, color: "var(--text)" }}>{Math.floor(a.durationMin / 60) ? `${Math.floor(a.durationMin / 60)}h ` : ""}{a.durationMin % 60}m</div>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--text-faint)" }}>{window.WMS.relTime(a.ageMin)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

window.AlertsCenter = AlertsCenter;
