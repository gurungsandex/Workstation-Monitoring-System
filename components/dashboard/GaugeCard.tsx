"use client";
import { AnimatedNumber } from "@/components/charts/AnimatedNumber";
import { Gauge } from "@/components/charts/Gauge";
import { Sparkline } from "@/components/charts/Sparkline";
import { Icon } from "@/components/ui/Icon";
import { loadColor } from "@/components/charts/utils";

interface GaugeCardProps {
  label: string;
  icon: string;
  value: number;
  unit: string;
  max?: number;
  color?: string;
  spark: number[];
  decimals?: number;
  gaugeStyle?: "ring" | "arc" | "bar";
}

export function GaugeCard({ label, icon, value, unit, max, color, spark, decimals = 0, gaugeStyle = "ring" }: GaugeCardProps) {
  const pct = max ? (value / max) * 100 : value;
  const col = color ?? loadColor(pct);

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
      {/* label row */}
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <Icon name={icon} size={14} color={col} />
        <span className="label">{label}</span>
      </div>

      {gaugeStyle === "bar" ? (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span className="mono" style={{ fontSize: "var(--metric-size)", fontWeight: 600, lineHeight: 1, color: "var(--text)" }}>
              <AnimatedNumber value={value} decimals={decimals} />
            </span>
            <span className="mono" style={{ fontSize: 13, color: "var(--text-faint)" }}>{unit}</span>
          </div>
          <Gauge value={value} max={max ?? 100} style="bar" color={col} thickness={7} />
        </>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
              <span className="mono" style={{ fontSize: "var(--metric-size)", fontWeight: 600, lineHeight: 1, color: "var(--text)" }}>
                <AnimatedNumber value={value} decimals={decimals} />
              </span>
              <span className="mono" style={{ fontSize: 12, color: "var(--text-faint)" }}>{unit}</span>
            </div>
          </div>
          <div style={{ flexShrink: 0 }}>
            <Gauge value={value} max={max ?? 100} style={gaugeStyle} size={62} thickness={7} color={col} />
          </div>
        </div>
      )}

      {/* sparkline pinned to bottom */}
      <div style={{ marginTop: "auto", opacity: 0.85 }}>
        <Sparkline data={spark} h={26} color={col} />
      </div>
    </div>
  );
}
