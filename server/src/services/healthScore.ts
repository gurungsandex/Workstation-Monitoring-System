import type { MetricPayload } from "../routes/metrics";

export interface HealthFactor {
  label: string;
  delta: number;
  sev: "critical" | "warning";
}

export interface HealthResult {
  score: number;
  factors: HealthFactor[];
  status: "healthy" | "warning" | "critical";
}

export function computeHealthScore(m: MetricPayload): HealthResult {
  let score = 100;
  const factors: HealthFactor[] = [];

  const add = (label: string, delta: number, sev: "critical" | "warning") => {
    score -= delta;
    factors.push({ label, delta: -delta, sev });
  };

  // RAM thresholds (≥90% critical, ≥72% warning)
  if (m.ram_used_pct >= 90) {
    add(`RAM ${Math.round(m.ram_used_pct)}% sustained`, Math.round((m.ram_used_pct - 85) * 1.4), "critical");
  } else if (m.ram_used_pct >= 72) {
    add(`RAM elevated (${Math.round(m.ram_used_pct)}%)`, Math.round((m.ram_used_pct - 72) * 0.8), "warning");
  }

  // CPU load
  if (m.cpu_usage >= 88) {
    add(`CPU ${Math.round(m.cpu_usage)}% load`, Math.round((m.cpu_usage - 88) * 1.6), "critical");
  } else if (m.cpu_usage >= 68) {
    add(`CPU elevated (${Math.round(m.cpu_usage)}%)`, Math.round((m.cpu_usage - 68) * 0.6), "warning");
  }

  // Disk usage
  if (m.disk_used_pct >= 88) {
    add(`Disk ${Math.round(m.disk_used_pct)}% full`, Math.round((m.disk_used_pct - 88) * 1.2), "critical");
  } else if (m.disk_used_pct >= 78) {
    add(`Disk filling (${Math.round(m.disk_used_pct)}%)`, Math.round((m.disk_used_pct - 78) * 0.7), "warning");
  }

  // CPU temperature
  if (m.cpu_temp >= 84) {
    add(`CPU temp ${Math.round(m.cpu_temp)}°C`, Math.round((m.cpu_temp - 84) * 1.3), "critical");
  } else if (m.cpu_temp >= 72) {
    add(`CPU temp elevated (${Math.round(m.cpu_temp)}°C)`, Math.round((m.cpu_temp - 72) * 0.7), "warning");
  }

  // GPU temperature (independent of CPU temp)
  if (m.gpu_temp >= 90) {
    add(`GPU temp ${Math.round(m.gpu_temp)}°C`, Math.round((m.gpu_temp - 90) * 1.2), "critical");
  } else if (m.gpu_temp >= 80) {
    add(`GPU temp ${Math.round(m.gpu_temp)}°C`, Math.round((m.gpu_temp - 80) * 0.9), "warning");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const status: HealthResult["status"] =
    score >= 80 ? "healthy" :
    score >= 55 ? "warning" : "critical";

  return { score, factors, status };
}
