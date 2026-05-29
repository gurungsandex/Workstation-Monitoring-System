// Thin API client — reads NEXT_PUBLIC_API_URL at runtime, falls back to relative
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

async function req<T>(
  path: string,
  opts?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) },
    ...opts,
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(msg || String(res.status));
  }
  return res.json() as Promise<T>;
}

// ---------- types ----------

export interface DiscoveredHost {
  id: string;
  ip: string;
  mac?: string;
  hostname?: string;
  vendor?: string;
  open_ports?: number[];
  last_scanned: string;
  is_enrolled: boolean;
  workstation_id?: string;
  status?: string;
  ws_hostname?: string;
  dept?: string;
}

export interface ScanSession {
  id: string;
  cidr: string;
  started_at: string;
  completed_at?: string;
  host_count: number;
  status: "running" | "done" | "error";
  started_by_email?: string;
}

export interface EnrolledWorkstation {
  id: string;
  hostname: string;
  ip?: string;
  mac?: string;
  dept?: string;
  owner_name?: string;
  os_family?: string;
  os_name?: string;
  status: string;
  health_score: number;
  enrolled_at?: string;
  last_seen_at?: string;
  agent_version?: string;
  is_enrolled: boolean;
  // latest metric snapshot (populated after first agent ingest)
  snap_cpu_usage?:     number;
  snap_cpu_temp?:      number;
  snap_ram_used_pct?:  number;
  snap_disk_used_pct?: number;
  snap_disk_read_mbs?: number;
  snap_disk_write_mbs?:number;
  snap_gpu_load?:      number;
  snap_gpu_temp?:      number;
  snap_net_eth_in?:    number;
  snap_net_eth_out?:   number;
  snap_net_down_mbps?: number;
  snap_net_up_mbps?:   number;
}

export interface EnrollTokenResponse {
  workstation_id: string;
  enrollment_token: string;
  install: {
    linux: string;
    macos: string;
    windows: string;
  };
}

export interface FleetStats {
  counts: { healthy: number; warning: number; critical: number; offline: number };
  total: number;
  avgCpu: number;
  avgRam: number;
  avgDisk: number;
  avgGpu: number;
  netIn: number;
  netOut: number;
}

// ---------- discovery ----------

export const discovery = {
  hosts: () => req<DiscoveredHost[]>("/discover/hosts"),
  sessions: () => req<ScanSession[]>("/discover/sessions"),
  session: (id: string) => req<ScanSession>(`/discover/sessions/${id}`),
  scan: (cidrs?: string[]) =>
    req<{ session_id: string; status: string }>("/discover", {
      method: "POST",
      body: JSON.stringify({ cidrs }),
    }),
};

// ---------- enrollment ----------

export const enrollment = {
  list: () => req<EnrolledWorkstation[]>("/enroll/list"),
  generateToken: (data: { hostname?: string; ip?: string; dept?: string; owner?: string }) =>
    req<EnrollTokenResponse>("/enroll/token", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  revoke: (id: string) =>
    req<{ ok: boolean }>(`/enroll/${id}`, { method: "DELETE" }),
};

// ---------- workstations ----------

export const workstations = {
  fleet: () => req<FleetStats>("/workstations/fleet"),
  list: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return req<{ total: number; rows: EnrolledWorkstation[] }>(`/workstations${qs}`);
  },
  get: (id: string) => req<EnrolledWorkstation>(`/workstations/${id}`),
};

// ---------- alerts ----------

export interface AlertRow {
  id: string;
  workstation_id: string;
  hostname: string;
  dept?: string;
  metric: string;
  value?: string;
  threshold: string;
  severity: "critical" | "warning";
  action?: string;
  is_resolved: boolean;
  is_ack: boolean;
  ack_by?: string;
  started_at: string;
  resolved_at?: string;
  duration_min?: number;
}

export interface AlertSummary {
  activeCritical: number;
  activeWarning: number;
  acknowledged: number;
  resolved24h: number;
}

export const alerts = {
  list: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return req<{ total: number; rows: AlertRow[] }>(`/alerts${qs}`);
  },
  summary: () => req<AlertSummary>("/alerts/summary"),
  ack: (ids: string[]) =>
    req<{ ok: boolean; count: number }>("/alerts/ack", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),
};
