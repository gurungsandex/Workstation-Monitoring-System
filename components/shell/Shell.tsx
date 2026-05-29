"use client";
import React, { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

interface ShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function Shell({ title, subtitle, children }: ShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div style={{ display: "flex", height: "100vh", position: "relative", zIndex: 1 }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        <Topbar title={title} subtitle={subtitle} />
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
