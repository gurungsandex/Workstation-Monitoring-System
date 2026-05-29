"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { useLive } from "@/lib/LiveContext";

interface TopbarProps {
  title: string;
  subtitle?: string;
}

export function Topbar({ title, subtitle }: TopbarProps) {
  const { live, setLive } = useLive();
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  return (
    <header style={{
      height: 64, flexShrink: 0, borderBottom: "1px solid var(--border)",
      display: "flex", alignItems: "center", gap: 16, padding: "0 24px",
      background: "color-mix(in oklab, var(--bg-2) 75%, transparent)",
      backdropFilter: "blur(8px)", position: "sticky", top: 0, zIndex: 4,
    }}>
      <div style={{ minWidth: 0 }}>
        <h1 className="display" style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-.02em", lineHeight: 1.1, margin: 0 }}>
          {title}
        </h1>
        {subtitle && <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 1 }}>{subtitle}</div>}
      </div>
      <div style={{ flex: 1 }} />

      {/* bell */}
      <Link href="/alerts" className="btn" style={{ padding: "8px 11px" }}>
        <Icon name="bell" size={16} />
      </Link>

      {/* live toggle */}
      <button onClick={() => setLive(!live)} className="btn" style={{ padding: "7px 12px" }}>
        <span style={{
          width: 8, height: 8, borderRadius: 99,
          background: live ? "var(--healthy)" : "var(--text-faint)",
          boxShadow: live ? "0 0 8px var(--healthy)" : "none",
          animation: live ? "livePulse 1.8s infinite" : "none",
          flexShrink: 0,
        }} />
        <span style={{ fontSize: 12 }}>{live ? "Live" : "Paused"}</span>
      </button>

      {/* clock */}
      <div className="mono" style={{ fontSize: 12, color: "var(--text-dim)", width: 70, textAlign: "right" }}>
        {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
      </div>
    </header>
  );
}
