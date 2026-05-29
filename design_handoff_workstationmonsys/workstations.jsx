/* ============================================================
   workstations.jsx — Workstation List (search / filter / sort)
   ============================================================ */
function MiniBar({ value, color }) {
  const col = color || window.loadColor(value);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 5, background: "var(--card-3)", borderRadius: 99, overflow: "hidden", minWidth: 42 }}>
        <div style={{ width: `${value}%`, height: "100%", background: col, borderRadius: 99, transition: "width .4s, background .3s" }} />
      </div>
      <span className="mono tnum" style={{ fontSize: 12, color: "var(--text-dim)", width: 32, textAlign: "right" }}>{Math.round(value)}%</span>
    </div>
  );
}

function WorkstationList({ tick, onOpen }) {
  const [q, setQ] = React.useState("");
  const [statusF, setStatusF] = React.useState("all");
  const [osF, setOsF] = React.useState("all");
  const [sortKey, setSortKey] = React.useState("status");
  const [sortDir, setSortDir] = React.useState("asc");

  const STATUS_ORDER = { critical: 0, warning: 1, offline: 2, healthy: 3 };
  const all = window.WMS.workstations;

  function sortVal(w) {
    switch (sortKey) {
      case "hostname": return w.hostname;
      case "user": return w.user;
      case "os": return w.os.name;
      case "status": return STATUS_ORDER[w.status];
      case "cpu": return w.cpu.usage;
      case "ram": return w.ram.usedPct;
      case "disk": return w.disk.usedPct;
      case "uptime": return w.uptimeSec;
      default: return 0;
    }
  }

  let rows = all.filter((w) => {
    if (statusF !== "all" && w.status !== statusF) return false;
    if (osF !== "all" && w.os.family !== osF) return false;
    if (q) {
      const s = (w.hostname + " " + w.user + " " + w.dept + " " + w.ip).toLowerCase();
      if (!s.includes(q.toLowerCase())) return false;
    }
    return true;
  });
  rows.sort((a, b) => {
    const va = sortVal(a), vb = sortVal(b);
    const cmp = typeof va === "string" ? va.localeCompare(vb) : va - vb;
    return sortDir === "asc" ? cmp : -cmp;
  });

  function toggleSort(k) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir(k === "hostname" || k === "user" || k === "os" ? "asc" : "desc"); }
  }

  const counts = { all: all.length };
  ["healthy", "warning", "critical", "offline"].forEach((s) => counts[s] = all.filter((w) => w.status === s).length);

  const COLS = [
    { k: "hostname", t: "Hostname", w: "auto", align: "left" },
    { k: "user", t: "User", w: 150, align: "left" },
    { k: "os", t: "OS", w: 110, align: "left" },
    { k: "status", t: "Status", w: 120, align: "left" },
    { k: "cpu", t: "CPU", w: 130, align: "left" },
    { k: "ram", t: "RAM", w: 130, align: "left" },
    { k: "disk", t: "Disk", w: 130, align: "left" },
    { k: "uptime", t: "Uptime", w: 90, align: "right" },
  ];

  function SortHead({ c }) {
    const on = sortKey === c.k;
    return (
      <th onClick={() => toggleSort(c.k)} style={{
        textAlign: c.align, padding: "0 14px 10px", cursor: "pointer", userSelect: "none",
        width: c.w === "auto" ? undefined : c.w, whiteSpace: "nowrap",
      }}>
        <span className="label" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: on ? "var(--text)" : "var(--text-faint)" }}>
          {c.t}
          {on && <Icon name={sortDir === "asc" ? "arrowUp" : "arrowDown"} size={11} color="var(--info)" />}
        </span>
      </th>
    );
  }

  return (
    <div className="view-enter" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      {/* controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 280px", maxWidth: 380 }}>
          <Icon name="search" size={16} color="var(--text-faint)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search hostname, user, dept, IP…"
            style={{ width: "100%", padding: "10px 12px 10px 36px", background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 9, color: "var(--text)", fontSize: 13, outline: "none" }}
            onFocus={(e) => e.target.style.borderColor = "var(--info)"} onBlur={(e) => e.target.style.borderColor = "var(--border-strong)"} />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["all", "healthy", "warning", "critical", "offline"].map((s) => (
            <button key={s} className={`chip ${statusF === s ? "active" : ""}`} onClick={() => setStatusF(s)}>
              {s !== "all" && <span className={`dot ${s}`} style={{ width: 7, height: 7 }} />}
              <span style={{ textTransform: "capitalize" }}>{s}</span>
              <span className="mono" style={{ opacity: .6 }}>{counts[s]}</span>
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 6 }}>
          {[["all", "All OS"], ["windows", "Windows"], ["mac", "macOS"], ["linux", "Linux"]].map(([v, l]) => (
            <button key={v} className={`chip ${osF === v ? "active" : ""}`} onClick={() => setOsF(v)}>{l}</button>
          ))}
        </div>
      </div>

      {/* table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "16px 0 10px 18px", width: 16 }}></th>
                {COLS.map((c) => <SortHead key={c.k} c={c} />)}
                <th style={{ width: 30 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.id} onClick={() => onOpen(w.id)} style={{ borderBottom: "1px solid var(--hairline)", cursor: "pointer", transition: "background .12s" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,.022)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "0 0 0 18px" }}><span className={`dot ${w.status}`} /></td>
                  <td style={{ padding: "12px 14px" }}>
                    <div className="mono" style={{ fontWeight: 600, color: "var(--text)" }}>{w.hostname}</div>
                    <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{w.dept} · {w.ip}</div>
                  </td>
                  <td style={{ padding: "12px 14px", color: "var(--text-dim)" }}>{w.user}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><OSBadge os={w.os} /><span style={{ color: "var(--text-dim)", fontSize: 12 }}>{w.os.short}</span></span>
                  </td>
                  <td style={{ padding: "12px 14px" }}><span className={`badge ${w.status}`}>{w.status}</span></td>
                  <td style={{ padding: "12px 14px" }}>{w.status === "offline" ? <span className="mono" style={{ color: "var(--text-ghost)" }}>—</span> : <MiniBar value={w.cpu.usage} />}</td>
                  <td style={{ padding: "12px 14px" }}>{w.status === "offline" ? <span className="mono" style={{ color: "var(--text-ghost)" }}>—</span> : <MiniBar value={w.ram.usedPct} />}</td>
                  <td style={{ padding: "12px 14px" }}><MiniBar value={w.disk.usedPct} color="var(--info)" /></td>
                  <td style={{ padding: "12px 14px", textAlign: "right" }}>
                    <span className="mono" style={{ color: w.status === "offline" ? "var(--text-ghost)" : "var(--text-dim)", fontSize: 12 }}>
                      {w.status === "offline" ? "offline" : window.WMS.uptimeStr(w.uptimeSec)}
                    </span>
                  </td>
                  <td style={{ textAlign: "center", color: "var(--text-faint)" }}><Icon name="chevron" size={15} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <div style={{ padding: 50, textAlign: "center", color: "var(--text-faint)" }}>No workstations match your filters.</div>}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-faint)" }} className="mono">{rows.length} of {all.length} workstations</div>
    </div>
  );
}

window.WorkstationList = WorkstationList;
