/* ============================================================
   network.jsx — Network View (grouped node map)
   ============================================================ */
function NetworkView({ tick, onOpen }) {
  const [tip, setTip] = React.useState(null);
  const [view, setView] = React.useState("grouped"); // grouped | subnet
  const all = window.WMS.workstations;

  // group by department or by subnet
  const groups = {};
  all.forEach((w) => {
    const key = view === "grouped" ? w.dept : w.ip.split(".").slice(0, 3).join(".") + ".0/24";
    (groups[key] = groups[key] || []).push(w);
  });
  const groupKeys = Object.keys(groups).sort();

  function showTip(e, w) {
    setTip({ w, x: e.clientX, y: e.clientY });
  }

  return (
    <div className="view-enter" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}
      onMouseMove={(e) => tip && setTip((t) => ({ ...t, x: e.clientX, y: e.clientY }))}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 4 }}>
          {[["grouped", "By department"], ["subnet", "By subnet"]].map(([v, l]) => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: "7px 14px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600,
              background: view === v ? "var(--card-3)" : "transparent", color: view === v ? "var(--text)" : "var(--text-dim)",
            }}>{l}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 14 }}>
          {[["healthy", "Healthy"], ["warning", "Warning"], ["critical", "Critical"], ["offline", "Offline"]].map(([k, l]) => (
            <span key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-dim)" }}>
              <span className={`dot ${k}`} style={{ width: 8, height: 8 }} />{l}
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {groupKeys.map((g) => {
          const nodes = groups[g];
          const crit = nodes.filter((n) => n.status === "critical" || n.status === "offline").length;
          return (
            <div key={g} className="card">
              <div className="card-head">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Icon name={view === "subnet" ? "network" : "grid"} size={15} color="var(--text-faint)" />
                  <span className="card-title" style={{ fontFamily: view === "subnet" ? "var(--font-mono)" : "var(--font-display)" }}>{g}</span>
                  <span className="mono" style={{ fontSize: 11, color: "var(--text-faint)" }}>{nodes.length} nodes</span>
                </div>
                {crit > 0 && <span className="badge critical">{crit} need attention</span>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))", gap: 10 }}>
                {nodes.map((w) => {
                  const col = `var(--${w.status})`;
                  return (
                    <div key={w.id}
                      onClick={() => onOpen(w.id)}
                      onMouseEnter={(e) => showTip(e, w)}
                      onMouseLeave={() => setTip(null)}
                      style={{
                        padding: "11px 12px", borderRadius: 10, cursor: "pointer",
                        background: w.status === "offline" ? "rgba(255,255,255,.018)" : `color-mix(in oklab, var(--${w.status}) 8%, var(--card-2))`,
                        border: `1px solid ${w.status === "healthy" ? "var(--border)" : `color-mix(in oklab, var(--${w.status}) 40%, transparent)`}`,
                        position: "relative", transition: "transform .12s, box-shadow .12s", opacity: w.status === "offline" ? .55 : 1,
                      }}
                      onMouseDown={(e) => e.currentTarget.style.transform = "scale(.97)"}
                      onMouseUp={(e) => e.currentTarget.style.transform = ""}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <span className={`dot ${w.status}`} />
                        <OSBadge os={w.os} size={11} />
                      </div>
                      <div className="mono" style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{w.hostname}</div>
                      <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                        {[["C", w.cpu.usage], ["R", w.ram.usedPct], ["D", w.disk.usedPct]].map(([lab, val]) => (
                          <div key={lab} style={{ flex: 1 }} title={`${lab} ${Math.round(val)}%`}>
                            <div style={{ height: 3, background: "var(--card-3)", borderRadius: 2, overflow: "hidden" }}>
                              <div style={{ width: `${w.status === "offline" ? 0 : val}%`, height: "100%", background: window.loadColor(val) }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {tip && (
        <div className="tip" style={{ left: Math.min(tip.x + 16, window.innerWidth - 200), top: tip.y + 16 }}>
          <div className="mono" style={{ fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>{tip.w.hostname}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span className={`dot ${tip.w.status}`} style={{ width: 7, height: 7 }} />
            <span style={{ textTransform: "capitalize", fontSize: 11, color: "var(--text-dim)" }}>{tip.w.status}</span>
            <span style={{ fontSize: 11, color: "var(--text-faint)" }}>· {tip.w.os.short}</span>
          </div>
          {tip.w.status === "offline" ? (
            <div className="mono" style={{ fontSize: 11, color: "var(--text-faint)" }}>last seen {window.WMS.relTime(tip.w.lastSeenMin)}</div>
          ) : (
            [["CPU", tip.w.cpu.usage, "%"], ["RAM", tip.w.ram.usedPct, "%"], ["Disk", tip.w.disk.usedPct, "%"], ["Net", tip.w.net.ethIn, " MB/s"]].map(([l, v, u]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: 11, padding: "1px 0" }}>
                <span style={{ color: "var(--text-faint)" }}>{l}</span>
                <span className="mono" style={{ color: window.loadColor(typeof v === "number" && u === "%" ? v : 0) }}>{v.toFixed(u === "%" ? 0 : 1)}{u}</span>
              </div>
            ))
          )}
          <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 7, borderTop: "1px solid var(--hairline)", paddingTop: 6 }}>{tip.w.ip} · click to open</div>
        </div>
      )}
    </div>
  );
}

window.NetworkView = NetworkView;
