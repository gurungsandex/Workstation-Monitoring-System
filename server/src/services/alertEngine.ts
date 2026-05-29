import { query } from "../db";
import type { MetricPayload } from "../routes/metrics";
import { broadcast } from "../ws/hub";

interface AlertRule {
  metric:    string;
  severity:  "critical" | "warning";
  threshold: string;
  action:    string;
  test:      (m: MetricPayload) => boolean;
}

// Sustained-threshold state: track when a condition first became true
const sustainedStart = new Map<string, Date>(); // key: `${wsId}:${metric}`

const RULES: AlertRule[] = [
  {
    metric: "RAM Usage", severity: "critical", threshold: "> 90% for 10m",
    action: "Identify memory-heavy applications or schedule a reboot.",
    test: (m) => m.ram_used_pct >= 90,
  },
  {
    metric: "CPU Load", severity: "critical", threshold: "> 95% for 5m",
    action: "Check for runaway compute jobs; consider workload rebalance.",
    test: (m) => m.cpu_usage >= 95,
  },
  {
    metric: "Disk Capacity", severity: "warning", threshold: "> 85%",
    action: "Free disk space or expand the volume.",
    test: (m) => m.disk_used_pct >= 85,
  },
  {
    metric: "CPU Temperature", severity: "critical", threshold: "> 85°C",
    action: "Inspect cooling / dust; verify fan curve.",
    test: (m) => m.cpu_temp >= 85,
  },
  {
    metric: "GPU Temperature", severity: "warning", threshold: "> 80°C",
    action: "Reduce GPU workload or improve airflow.",
    test: (m) => m.gpu_temp >= 80,
  },
  {
    metric: "Internet Downlink", severity: "warning", threshold: "< 30% of plan",
    action: "Check uplink / ISP; test alternate route.",
    // Trigger if throughput < 30% of plan — we use 30 Mbps as a floor heuristic
    test: (m) => m.net_down_mbps > 0 && m.net_down_mbps < 30,
  },
];

// Sustained window requirements (in milliseconds)
const SUSTAINED: Partial<Record<string, number>> = {
  "RAM Usage": 10 * 60 * 1000,  // 10 minutes
  "CPU Load":   5 * 60 * 1000,  // 5 minutes
};

export async function evaluateAlerts(
  workstationId: string,
  m: MetricPayload,
  _score: number
): Promise<void> {
  for (const rule of RULES) {
    const key = `${workstationId}:${rule.metric}`;
    const triggered = rule.test(m);

    if (triggered) {
      const sustained = SUSTAINED[rule.metric];
      if (sustained) {
        if (!sustainedStart.has(key)) sustainedStart.set(key, new Date());
        const elapsed = Date.now() - sustainedStart.get(key)!.getTime();
        if (elapsed < sustained) continue; // not yet sustained
      }

      // Check if an open alert already exists
      const [existing] = await query<{ id: string }>(
        "SELECT id FROM alerts WHERE workstation_id = $1 AND metric = $2 AND is_resolved = FALSE LIMIT 1",
        [workstationId, rule.metric]
      );
      if (existing) continue; // already open

      const [alert] = await query<{ id: string }>(
        `INSERT INTO alerts (workstation_id, metric, value, threshold, severity, action)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          workstationId, rule.metric,
          metricValue(rule.metric, m),
          rule.threshold, rule.severity, rule.action,
        ]
      );
      broadcast({ type: "alert_open", alert_id: alert.id, workstation_id: workstationId, metric: rule.metric, severity: rule.severity });
    } else {
      sustainedStart.delete(key);

      // Auto-resolve any open alert for this metric
      const resolved = await query<{ id: string }>(
        `UPDATE alerts SET is_resolved = TRUE, resolved_at = NOW()
         WHERE workstation_id = $1 AND metric = $2 AND is_resolved = FALSE
         RETURNING id`,
        [workstationId, rule.metric]
      );
      for (const r of resolved) {
        broadcast({ type: "alert_resolved", alert_id: r.id, workstation_id: workstationId });
      }
    }
  }
}

// Open "agent heartbeat lost" alert (called by heartbeat watchdog)
export async function raiseHeartbeatAlert(workstationId: string): Promise<void> {
  const [existing] = await query<{ id: string }>(
    "SELECT id FROM alerts WHERE workstation_id = $1 AND metric = 'Agent Heartbeat' AND is_resolved = FALSE LIMIT 1",
    [workstationId]
  );
  if (existing) return;
  await query(
    `INSERT INTO alerts (workstation_id, metric, value, threshold, severity, action)
     VALUES ($1, 'Agent Heartbeat', 'no signal', 'no signal 5m', 'critical',
             'Verify network link and monitoring agent service.')`,
    [workstationId]
  );
  // Mark workstation offline
  await query("UPDATE workstations SET status = 'offline' WHERE id = $1", [workstationId]);
}

function metricValue(metric: string, m: MetricPayload): string {
  switch (metric) {
    case "RAM Usage":         return `${m.ram_used_pct.toFixed(1)}%`;
    case "CPU Load":          return `${m.cpu_usage.toFixed(1)}%`;
    case "Disk Capacity":     return `${m.disk_used_pct.toFixed(1)}%`;
    case "CPU Temperature":   return `${m.cpu_temp.toFixed(0)}°C`;
    case "GPU Temperature":   return `${m.gpu_temp.toFixed(0)}°C`;
    case "Internet Downlink": return `${m.net_down_mbps.toFixed(1)} Mbps`;
    default: return "";
  }
}
