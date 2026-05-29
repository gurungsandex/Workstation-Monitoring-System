/* ============================================================
   components.jsx — shared UI shell + atoms
   ============================================================ */
const { useState: useStateUI } = React;

/* ---- minimal line-icon set (lucide-ish) ---- */
const ICONS = {
  dashboard: "M3 3h7v7H3zM14 3h7v4h-7zM14 11h7v10h-7zM3 14h7v7H3z",
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  alert: "M12 3l9 16H3zM12 10v4M12 17h.01",
  network: "M5 9a3 3 0 100-6 3 3 0 000 6zM19 9a3 3 0 100-6 3 3 0 000 6zM12 21a3 3 0 100-6 3 3 0 000 6zM6.5 7.5l4 6M17.5 7.5l-4 6",
  cpu: "M9 3v2M15 3v2M9 19v2M15 19v2M3 9h2M3 15h2M19 9h2M19 15h2M5 5h14v14H5zM9 9h6v6H9z",
  search: "M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3",
  chevron: "M9 6l6 6-6 6",
  chevronDown: "M6 9l6 6 6-6",
  arrowUp: "M12 19V5M5 12l7-7 7 7",
  arrowDown: "M12 5v14M5 12l7 7 7-7",
  bell: "M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0",
  collapse: "M15 6l-6 6 6 6",
  pulse: "M3 12h4l2 6 4-14 2 8h6",
  memory: "M6 19v2M10 19v2M14 19v2M18 19v2M4 4h16v12H4zM8 8v4M12 8v4M16 8v4",
  disk: "M22 12a10 10 0 11-20 0 10 10 0 0120 0zM12 12h.01",
  thermo: "M14 14.76V4a2 2 0 10-4 0v10.76a4 4 0 104 0z",
  globe: "M12 22a10 10 0 100-20 10 10 0 000 20zM2 12h20M12 2a15 15 0 010 20 15 15 0 010-20z",
  check: "M20 6L9 17l-5-5",
  x: "M18 6L6 18M6 6l12 12",
  filter: "M22 3H2l8 9.46V19l4 2v-8.54z",
  clock: "M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2",
  gpu: "M2 7h20v10H2zM6 7v10M2 11h4M18 11a2 2 0 100 4 2 2 0 000-4z",
  download: "M12 3v12M7 10l5 5 5-5M5 21h14",
  sun: "M12 7a5 5 0 100 10 5 5 0 000-10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
};
function Icon({ name, size = 18, stroke = 1.7, color = "currentColor", style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d={ICONS[name] || ""} />
    </svg>
  );
}

/* OS glyph (text-based, brand-neutral) */
function OSBadge({ os, size = 13 }) {
  const map = { windows: "WIN", mac: "MAC", linux: "LNX" };
  const colorMap = { windows: "var(--info)", mac: "var(--text-dim)", linux: "var(--warning)" };
  return (
    <span className="mono" style={{ fontSize: size - 2.5, fontWeight: 700, letterSpacing: ".06em", color: colorMap[os.family], opacity: .9 }}>
      {map[os.family]}
    </span>
  );
}

function StatusDot({ status, label }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
      <span className={`dot ${status}`} />
      {label && <span style={{ textTransform: "capitalize", color: status === "offline" ? "var(--text-faint)" : "var(--text-dim)", fontSize: 12.5 }}>{status}</span>}
    </span>
  );
}

/* ---- Sidebar ---- */
const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard", route: "#/" },
  { id: "workstations", label: "Workstations", icon: "grid", route: "#/workstations" },
  { id: "alerts", label: "Alerts", icon: "alert", route: "#/alerts" },
  { id: "network", label: "Network", icon: "network", route: "#/network" },
];

function Sidebar({ active, collapsed, onToggle, alertCount }) {
  const f = window.WMS.fleet();
  return (
    <aside style={{
      width: collapsed ? "var(--sidebar-w-collapsed)" : "var(--sidebar-w)",
      flex: "none", borderRight: "1px solid var(--border)", background: "var(--bg-2)",
      display: "flex", flexDirection: "column", transition: "width .22s cubic-bezier(.4,0,.2,1)",
      position: "relative", zIndex: 5,
    }}>
      {/* brand */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: collapsed ? "18px 0" : "18px 18px", justifyContent: collapsed ? "center" : "flex-start", height: 64, borderBottom: "1px solid var(--border)" }}>
        <div style={{ width: 30, height: 30, flex: "none", borderRadius: 8, background: "linear-gradient(135deg, var(--info), var(--network))", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 16px color-mix(in oklab, var(--info) 40%, transparent)" }}>
          <Icon name="pulse" size={17} color="#04070d" stroke={2.4} />
        </div>
        {!collapsed && (
          <div style={{ lineHeight: 1.1 }}>
            <div className="display" style={{ fontWeight: 700, fontSize: 14.5, letterSpacing: "-.01em" }}>WorkstationMonSys</div>
            <div className="mono" style={{ fontSize: 9, color: "var(--text-faint)", letterSpacing: ".08em" }}>FLEET TELEMETRY</div>
          </div>
        )}
      </div>

      {/* nav */}
      <nav style={{ padding: collapsed ? "12px 10px" : "12px", display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
        {!collapsed && <div className="label" style={{ padding: "8px 8px 4px" }}>Monitor</div>}
        {NAV.map((n) => {
          const on = active === n.id;
          return (
            <a key={n.id} href={n.route} title={n.label} style={{
              display: "flex", alignItems: "center", gap: 11, padding: collapsed ? "10px 0" : "9px 11px",
              justifyContent: collapsed ? "center" : "flex-start",
              borderRadius: 9, fontSize: 13, fontWeight: 500,
              color: on ? "var(--text)" : "var(--text-dim)",
              background: on ? "color-mix(in oklab, var(--info) 14%, transparent)" : "transparent",
              boxShadow: on ? "inset 0 0 0 1px color-mix(in oklab, var(--info) 30%, transparent)" : "none",
              position: "relative", transition: "background .14s, color .14s",
            }}
              onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = "rgba(255,255,255,.03)"; }}
              onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = "transparent"; }}>
              {on && <span style={{ position: "absolute", left: collapsed ? 6 : -1, top: "50%", transform: "translateY(-50%)", width: 3, height: 18, borderRadius: 3, background: "var(--info)" }} />}
              <Icon name={n.icon} size={18} color={on ? "var(--info)" : "currentColor"} />
              {!collapsed && <span style={{ flex: 1 }}>{n.label}</span>}
              {!collapsed && n.id === "alerts" && alertCount > 0 && (
                <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, background: "var(--critical)", color: "#fff", borderRadius: 999, padding: "1px 7px" }}>{alertCount}</span>
              )}
            </a>
          );
        })}
      </nav>

      {/* fleet mini status */}
      {!collapsed && (
        <div style={{ padding: 12, borderTop: "1px solid var(--border)" }}>
          <div className="label" style={{ marginBottom: 9 }}>Fleet Status</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[["healthy", f.counts.healthy], ["warning", f.counts.warning], ["critical", f.counts.critical], ["offline", f.counts.offline]].map(([k, v]) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <span className={`dot ${k}`} />
                <span style={{ textTransform: "capitalize", color: "var(--text-dim)", flex: 1 }}>{k}</span>
                <span className="mono" style={{ color: "var(--text)", fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* collapse toggle */}
      <button onClick={onToggle} title="Collapse" style={{
        margin: collapsed ? "0 auto 14px" : "0 12px 14px", width: collapsed ? 40 : "auto",
        background: "transparent", border: "1px solid var(--border)", borderRadius: 8,
        color: "var(--text-faint)", padding: "8px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      }}>
        <Icon name="collapse" size={16} style={{ transform: collapsed ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
        {!collapsed && <span style={{ fontSize: 12 }}>Collapse</span>}
      </button>
    </aside>
  );
}

/* ---- Topbar ---- */
function Topbar({ title, subtitle, children, live, onToggleLive }) {
  const [now, setNow] = useStateUI(new Date());
  React.useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return (
    <header style={{
      height: 64, flex: "none", borderBottom: "1px solid var(--border)",
      display: "flex", alignItems: "center", gap: 16, padding: "0 24px", background: "color-mix(in oklab, var(--bg-2) 75%, transparent)",
      backdropFilter: "blur(8px)", position: "sticky", top: 0, zIndex: 4,
    }}>
      <div style={{ minWidth: 0 }}>
        <h1 className="display" style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-.02em", lineHeight: 1.1 }}>{title}</h1>
        {subtitle && <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 1 }}>{subtitle}</div>}
      </div>
      <div style={{ flex: 1 }} />
      {children}
      <button onClick={onToggleLive} className="btn" style={{ padding: "7px 11px" }} title="Toggle live updates">
        <span style={{ width: 8, height: 8, borderRadius: 99, background: live ? "var(--healthy)" : "var(--text-faint)", boxShadow: live ? "0 0 8px var(--healthy)" : "none", animation: live ? "pulse 1.8s infinite" : "none" }} />
        <span style={{ fontSize: 12 }}>{live ? "Live" : "Paused"}</span>
      </button>
      <div className="mono" style={{ fontSize: 12, color: "var(--text-dim)", textAlign: "right" }}>
        {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </div>
    </header>
  );
}

/* metric tile label row */
function MetricLabel({ icon, text, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      {icon && <Icon name={icon} size={14} color={color || "var(--text-faint)"} />}
      <span className="label">{text}</span>
    </div>
  );
}

/* empty / skeleton card */
function SkeletonCard({ h = 120 }) {
  return <div className="card" style={{ height: h }}><div className="skel" style={{ width: "40%", height: 12, marginBottom: 14 }} /><div className="skel" style={{ width: "70%", height: 28 }} /></div>;
}

Object.assign(window, {
  Icon, OSBadge, StatusDot, Sidebar, Topbar, MetricLabel, SkeletonCard, NAV,
});
