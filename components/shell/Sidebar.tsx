"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { useLive } from "@/lib/LiveContext";
import { useAuth } from "@/lib/AuthContext";

const NAV = [
  { id: "dashboard",    label: "Dashboard",   icon: "dashboard", href: "/"            },
  { id: "workstations", label: "Workstations", icon: "grid",      href: "/workstations"},
  { id: "alerts",       label: "Alerts",       icon: "alert",     href: "/alerts"      },
  { id: "network",      label: "Network",      icon: "network",   href: "/network"     },
  { id: "settings",     label: "Settings",     icon: "settings",  href: "/settings"    },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname   = usePathname();
  const { fleetData, alertBadge } = useLive();
  const { user, logout } = useAuth();
  const f = fleetData.fleet ?? { counts: { healthy: 0, warning: 0, critical: 0, offline: 0 }, total: 0 };
  const alertCount = alertBadge;

  const activeId = pathname === "/" ? "dashboard"
    : pathname.startsWith("/workstations") ? "workstations"
    : pathname.startsWith("/alerts")       ? "alerts"
    : pathname.startsWith("/network")      ? "network"
    : pathname.startsWith("/settings")     ? "settings"
    : "dashboard";

  return (
    <aside style={{
      width: collapsed ? "var(--sidebar-w-collapsed)" : "var(--sidebar-w)",
      flexShrink: 0, borderRight: "1px solid var(--border)", background: "var(--bg-2)",
      display: "flex", flexDirection: "column",
      transition: "width .22s cubic-bezier(.4,0,.2,1)", position: "relative", zIndex: 5,
    }}>
      {/* brand */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: collapsed ? "18px 0" : "18px 18px",
        justifyContent: collapsed ? "center" : "flex-start",
        height: 64, borderBottom: "1px solid var(--border)",
      }}>
        <div style={{
          width: 30, height: 30, flexShrink: 0, borderRadius: 8,
          background: "linear-gradient(135deg, var(--info), var(--network))",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 16px color-mix(in oklab, var(--info) 40%, transparent)",
        }}>
          <Icon name="pulse" size={17} color="#04070d" stroke={2.4} />
        </div>
        {!collapsed && (
          <div style={{ lineHeight: 1.1 }}>
            <div className="display" style={{ fontWeight: 700, fontSize: 14.5, letterSpacing: "-.01em" }}>
              WorkstationMonSys
            </div>
            <div className="mono" style={{ fontSize: 9, color: "var(--text-faint)", letterSpacing: ".08em" }}>
              FLEET TELEMETRY
            </div>
          </div>
        )}
      </div>

      {/* nav */}
      <nav style={{
        padding: collapsed ? "12px 10px" : "12px",
        display: "flex", flexDirection: "column", gap: 3, flex: 1,
      }}>
        {!collapsed && <div className="label" style={{ padding: "8px 8px 4px" }}>Monitor</div>}
        {NAV.map((n) => {
          const active = activeId === n.id;
          return (
            <Link key={n.id} href={n.href} title={n.label} style={{
              display: "flex", alignItems: "center", gap: 11,
              padding: collapsed ? "10px 0" : "9px 11px",
              justifyContent: collapsed ? "center" : "flex-start",
              borderRadius: 9, fontSize: 13, fontWeight: 500,
              color: active ? "var(--text)" : "var(--text-dim)",
              background: active ? "color-mix(in oklab, var(--info) 14%, transparent)" : "transparent",
              boxShadow: active ? "inset 0 0 0 1px color-mix(in oklab, var(--info) 30%, transparent)" : "none",
              position: "relative", transition: "background .14s, color .14s", textDecoration: "none",
            }}>
              {active && (
                <span style={{
                  position: "absolute", left: collapsed ? 6 : -1, top: "50%",
                  transform: "translateY(-50%)", width: 3, height: 18,
                  borderRadius: 3, background: "var(--info)",
                }} />
              )}
              <Icon name={n.icon} size={18} color={active ? "var(--info)" : "currentColor"} />
              {!collapsed && <span style={{ flex: 1 }}>{n.label}</span>}
              {!collapsed && n.id === "alerts" && alertCount > 0 && (
                <span className="mono" style={{
                  fontSize: 10.5, fontWeight: 700, background: "var(--critical)",
                  color: "#fff", borderRadius: 999, padding: "1px 7px",
                }}>{alertCount}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* fleet mini status */}
      {!collapsed && (
        <div style={{ padding: 12, borderTop: "1px solid var(--border)" }}>
          <div className="label" style={{ marginBottom: 9 }}>Fleet Status</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(["healthy","warning","critical","offline"] as const).map((k) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <span className={`dot ${k}`} />
                <span style={{ textTransform: "capitalize", color: "var(--text-dim)", flex: 1 }}>{k}</span>
                <span className="mono" style={{ color: "var(--text)", fontWeight: 600 }}>{f.counts[k]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User + logout */}
      {!collapsed && user && (
        <div style={{ padding: "10px 12px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
            <div style={{ fontSize: 10, color: "var(--text-faint)", textTransform: "capitalize" }}>{user.role}</div>
          </div>
          <button onClick={logout} title="Sign out"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", padding: 4, display: "flex", alignItems: "center" }}>
            <Icon name="logout" size={15} />
          </button>
        </div>
      )}

      {/* collapse button */}
      <button onClick={onToggle} style={{
        margin: collapsed ? "0 auto 14px" : "0 12px 14px",
        width: collapsed ? 40 : "auto",
        background: "transparent", border: "1px solid var(--border)", borderRadius: 8,
        color: "var(--text-faint)", padding: "8px", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      }}>
        <Icon name="collapse" size={16} style={{ transform: collapsed ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
        {!collapsed && <span style={{ fontSize: 12 }}>Collapse</span>}
      </button>
    </aside>
  );
}
