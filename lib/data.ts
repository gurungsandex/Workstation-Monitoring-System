/* ============================================================
   WorkstationMonSys — mock data + live simulation (TypeScript)
   ============================================================ */

export type OSFamily = "windows" | "mac" | "linux";
export type Status = "healthy" | "warning" | "critical" | "offline";
export type AlertSev = "critical" | "warning" | "info" | "healthy";

export interface OS {
  name: string;
  short: string;
  family: OSFamily;
}

export interface HealthFactor {
  label: string;
  delta: number;
  sev: Status;
}

export interface Workstation {
  id: string;
  hostname: string;
  dept: string;
  user: string;
  os: OS;
  status: Status;
  ip: string;
  mac: string;
  uptimeSec: number;
  lastSeenMin: number;
  cpu: { model: string; cores: number; usage: number; temp: number; perCore: number[] };
  ram: { totalGB: number; usedPct: number };
  disk: { size: string; type: string; usedPct: number; readMBs: number; writeMBs: number };
  gpu: { model: string; load: number; temp: number };
  net: { ethIn: number; ethOut: number; downMbps: number; downMax: number; upMbps: number; upMax: number };
  health: { score: number; factors: HealthFactor[] };
  timeInStateMin: number;
  hist: { cpu: number[]; ram: number[]; disk: number[]; netIn: number[]; netOut: number[]; gpu: number[] };
  spark: { cpu: number[]; ram: number[]; net: number[] };
}

export interface Alert {
  id: number;
  ws: string;
  wsId: string;
  dept: string;
  metric: string;
  value: string;
  threshold: string;
  action: string;
  sev: AlertSev;
  ageMin: number;
  durationMin: number;
  resolved: boolean;
  ack: boolean;
}

export interface LiveEvent {
  id: number;
  sev: AlertSev | "healthy";
  ws: string;
  wsId: string;
  text: string;
  ageMin: number;
}

export interface FleetStats {
  total: number;
  counts: Record<Status, number>;
  avgCpu: number;
  avgRam: number;
  avgDisk: number;
  avgGpu: number;
  netIn: number;
  netOut: number;
}

// ---- helpers ----
const rnd  = (a: number, b: number) => a + Math.random() * (b - a);
const rndInt = (a: number, b: number) => Math.round(rnd(a, b));
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const OS_LIST: OS[] = [
  { name: "Windows 11",    short: "Win 11",   family: "windows" },
  { name: "Windows 10",    short: "Win 10",   family: "windows" },
  { name: "macOS Sonoma",  short: "macOS 14", family: "mac"     },
  { name: "Ubuntu 22.04",  short: "Ubuntu",   family: "linux"   },
];

const CPU_MODELS = [
  { m: "Intel Core i7-13700K", c: 16 }, { m: "Intel Core i5-12500",  c: 6  },
  { m: "AMD Ryzen 7 5800X",    c: 8  }, { m: "AMD Ryzen 9 7900X",    c: 12 },
  { m: "Apple M2 Pro",         c: 10 }, { m: "Apple M3",             c: 8  },
  { m: "Intel Core i9-13900",  c: 24 }, { m: "Intel Core i3-12100",  c: 4  },
];
const GPU_MODELS = [
  "NVIDIA RTX 4070", "NVIDIA RTX 3060", "NVIDIA RTX 4090", "AMD Radeon RX 7800",
  "Intel UHD 770",   "Apple M2 Pro GPU","Apple M3 GPU",    "NVIDIA RTX A2000",
];
const DISKS = [
  { s: "1 TB",   t: "NVMe SSD"  }, { s: "512 GB", t: "NVMe SSD"  },
  { s: "2 TB",   t: "NVMe SSD"  }, { s: "512 GB", t: "SATA SSD"  }, { s: "1 TB", t: "SATA SSD" },
];

const SEEDS: [string, string, string, number][] = [
  ["DEV-WS-01",       "Engineering",    "Priya Nadkarni",  0],
  ["DEV-WS-04",       "Engineering",    "Marcus Feldt",    3],
  ["DEV-WS-07",       "Engineering",    "Lena Ostrom",     0],
  ["DEV-WS-09",       "Engineering",    "Tobias Reyes",    3],
  ["DESIGN-WS-02",    "Design",         "Aiko Tanaka",     2],
  ["DESIGN-WS-05",    "Design",         "Hugo Benitez",    2],
  ["DESIGN-LT-03",    "Design",         "Mira Salko",      2],
  ["QA-WS-01",        "Quality",        "Devon Park",      1],
  ["QA-WS-02",        "Quality",        "Sasha Lindqvist", 0],
  ["FIN-WS-01",       "Finance",        "Robert Mwangi",   0],
  ["FIN-WS-02",       "Finance",        "Yuki Sato",       1],
  ["FIN-LT-08",       "Finance",        "Carla Devine",    1],
  ["ADMIN-LT-12",     "Administration", "Nadia Volkov",    0],
  ["ADMIN-WS-03",     "Administration", "Pete Halloran",   1],
  ["MOM-RECEPTION-01","Reception",      "Front Desk",      1],
  ["OPS-WS-06",       "Operations",     "Greg Tanaka",     3],
  ["OPS-WS-11",       "Operations",     "Imani Cole",      3],
  ["SALES-LT-04",     "Sales",          "Bianca Russo",    0],
  ["SALES-LT-07",     "Sales",          "Owen Frost",      0],
  ["HR-WS-02",        "People Ops",     "Dana Whitfield",  1],
  ["LAB-RIG-01",      "R&D Lab",        "Shared Rig",      3],
  ["LAB-RIG-02",      "R&D Lab",        "Shared Rig",      3],
  ["EXEC-LT-01",      "Executive",      "Helena Cross",    2],
  ["EXEC-LT-02",      "Executive",      "Sam Oduya",       2],
  ["KIOSK-LOBBY-01",  "Facilities",     "Lobby Kiosk",     1],
];

const STATUS_BY_INDEX: Record<number, Status> = {
  1: "warning", 4: "warning", 11: "critical", 14: "warning",
  16: "warning", 20: "critical", 24: "offline",
};

function genHistory(base: number, vol: number, n: number): number[] {
  const arr: number[] = [];
  let v = base;
  for (let i = 0; i < n; i++) {
    v = clamp(v + rnd(-vol, vol), 2, 99);
    arr.push(+v.toFixed(1));
  }
  arr[arr.length - 1] = base;
  return arr;
}

export function uptimeStr(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function relTime(min: number): string {
  if (min < 1) return "just now";
  if (min < 60) return `${Math.round(min)}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ${Math.round(min % 60)}m ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function buildWorkstation(seed: [string, string, string, number], idx: number): Workstation {
  const [hostname, dept, user, osIdx] = seed;
  const os = OS_LIST[osIdx];
  const status = STATUS_BY_INDEX[idx] ?? "healthy";
  const cpuModel = pick(CPU_MODELS);
  const disk = pick(DISKS);

  let cpu = 0, ram = 0, diskPct = 0, gpu = 0, gpuTemp = 0, cpuTemp = 0;
  if (status === "critical") {
    cpu = rnd(88, 98); ram = rnd(90, 98); diskPct = rnd(82, 96);
    gpu = rnd(70, 95); gpuTemp = rnd(82, 92); cpuTemp = rnd(85, 95);
  } else if (status === "warning") {
    cpu = rnd(68, 84); ram = rnd(74, 88); diskPct = rnd(70, 86);
    gpu = rnd(45, 75); gpuTemp = rnd(70, 81); cpuTemp = rnd(72, 82);
  } else if (status === "offline") {
    cpu = 0; ram = 0; diskPct = rnd(40, 75); gpu = 0; gpuTemp = 0; cpuTemp = 0;
  } else {
    cpu = rnd(8, 46); ram = rnd(28, 62); diskPct = rnd(34, 72);
    gpu = rnd(4, 40); gpuTemp = rnd(42, 64); cpuTemp = rnd(44, 66);
  }

  const cores = cpuModel.c;
  const perCore = Array.from({ length: cores }, () =>
    status === "offline" ? 0 : clamp(cpu + rnd(-22, 22), 0, 100));

  const ramTotalGB = pick([8, 16, 16, 32, 32, 64]);
  const downMax = pick([300, 500, 940, 940, 1000]);
  const upMax   = pick([100, 300, 500, 940]);

  let score = 100;
  const factors: HealthFactor[] = [];
  if (status !== "offline") {
    if (ram > 85)       { const p = Math.round((ram - 85) * 1.4);       score -= p; factors.push({ label: `RAM ${Math.round(ram)}% sustained`,     delta: -p, sev: "critical" }); }
    else if (ram > 72)  { const p = Math.round((ram - 72) * 0.8);       score -= p; factors.push({ label: `RAM elevated (${Math.round(ram)}%)`,     delta: -p, sev: "warning"  }); }
    if (cpu > 88)       { const p = Math.round((cpu - 88) * 1.6);       score -= p; factors.push({ label: `CPU ${Math.round(cpu)}% load`,           delta: -p, sev: "critical" }); }
    else if (cpu > 68)  { const p = Math.round((cpu - 68) * 0.6);       score -= p; factors.push({ label: `CPU elevated (${Math.round(cpu)}%)`,     delta: -p, sev: "warning"  }); }
    if (diskPct > 88)   { const p = Math.round((diskPct - 88) * 1.2);   score -= p; factors.push({ label: `Disk ${Math.round(diskPct)}% full`,      delta: -p, sev: "critical" }); }
    else if (diskPct > 78) { const p = Math.round((diskPct - 78) * 0.7);score -= p; factors.push({ label: `Disk filling (${Math.round(diskPct)}%)`, delta: -p, sev: "warning"  }); }
    if (cpuTemp > 84)   { const p = Math.round((cpuTemp - 84) * 1.3);   score -= p; factors.push({ label: `CPU temp ${Math.round(cpuTemp)}°C`,      delta: -p, sev: "critical" }); }
    else if (gpuTemp > 80) { const p = Math.round((gpuTemp - 80) * 0.9);score -= p; factors.push({ label: `GPU temp ${Math.round(gpuTemp)}°C`,      delta: -p, sev: "warning"  }); }
  }

  score = status === "offline" ? 0 : clamp(Math.round(score), 0, 100);
  if (status === "warning")  score = Math.min(score, rndInt(58, 74));
  if (status === "critical") score = Math.min(score, rndInt(24, 42));
  if (status !== "healthy" && status !== "offline" && factors.length === 0) {
    factors.push({ label: `${["CPU","RAM","Disk"][rndInt(0,2)]} sustained pressure`, delta: -(100-score), sev: status });
  }

  const ipBase = `10.4.${Math.floor(idx / 6) + 1}.${20 + idx}`;
  const mac = Array.from({ length: 6 }, () =>
    rndInt(16, 255).toString(16).padStart(2, "0").toUpperCase()).join(":");
  const stateMins = status === "healthy" ? 0 : rndInt(6, 320);

  return {
    id: hostname.toLowerCase(),
    hostname, dept, user, os, status,
    ip: ipBase, mac,
    uptimeSec:   status === "offline" ? 0 : rndInt(3600, 86400 * 23),
    lastSeenMin: status === "offline" ? rndInt(14, 180) : 0,
    cpu: { model: cpuModel.m, cores, usage: cpu, temp: cpuTemp, perCore },
    ram: { totalGB: ramTotalGB, usedPct: ram },
    disk: { size: disk.s, type: disk.t, usedPct: diskPct,
      readMBs:  status === "offline" ? 0 : rnd(2, 220),
      writeMBs: status === "offline" ? 0 : rnd(1, 180) },
    gpu: { model: pick(GPU_MODELS), load: gpu, temp: gpuTemp },
    net: {
      ethIn:   status === "offline" ? 0 : rnd(0.4, 88),
      ethOut:  status === "offline" ? 0 : rnd(0.2, 42),
      downMbps: status === "offline" ? 0 : rnd(downMax * 0.2, downMax), downMax,
      upMbps:   status === "offline" ? 0 : rnd(upMax  * 0.15, upMax),  upMax,
    },
    health: { score, factors },
    timeInStateMin: stateMins,
    hist: {
      cpu:    genHistory(cpu,    9,  48),
      ram:    genHistory(ram,    5,  48),
      disk:   genHistory(diskPct,2,  48),
      netIn:  genHistory(status === "offline" ? 0 : rnd(10,60), 14, 48),
      netOut: genHistory(status === "offline" ? 0 : rnd(5, 30), 10, 48),
      gpu:    genHistory(gpu,   11,  48),
    },
    spark: {
      cpu: genHistory(cpu,  7, 32),
      ram: genHistory(ram,  4, 32),
      net: genHistory(status === "offline" ? 0 : rnd(10,60), 12, 32),
    },
  };
}

// ---- mutable global workstation store ----
export const workstations: Workstation[] = SEEDS.map(buildWorkstation);

// ---- alerts ----
export const ALERT_DEFS = [
  { metric: "RAM Usage",         unit: "%",       action: "Identify memory-heavy applications or schedule a reboot.",    sev: "critical" as AlertSev, thr: "> 90% for 10m"    },
  { metric: "CPU Load",          unit: "%",       action: "Check for runaway compute jobs; consider workload rebalance.", sev: "critical" as AlertSev, thr: "> 95% for 5m"     },
  { metric: "Disk Capacity",     unit: "%",       action: "Free disk space or expand the volume.",                       sev: "warning"  as AlertSev, thr: "> 85%"             },
  { metric: "CPU Temperature",   unit: "°C",      action: "Inspect cooling / dust; verify fan curve.",                   sev: "critical" as AlertSev, thr: "> 85°C"            },
  { metric: "GPU Temperature",   unit: "°C",      action: "Reduce GPU workload or improve airflow.",                     sev: "warning"  as AlertSev, thr: "> 80°C"            },
  { metric: "Agent Heartbeat",   unit: "",        action: "Verify network link and monitoring agent service.",            sev: "critical" as AlertSev, thr: "no signal 5m"      },
  { metric: "Internet Downlink", unit: "Mbit/s",  action: "Check uplink / ISP; test alternate route.",                   sev: "warning"  as AlertSev, thr: "< 30% of plan"    },
  { metric: "Disk I/O Latency",  unit: "ms",      action: "Investigate background indexing or failing drive.",            sev: "warning"  as AlertSev, thr: "> 40ms"           },
];

let _alertId = 1000;
function makeAlert(ws: Workstation, def: typeof ALERT_DEFS[0], ageMin: number, resolved: boolean): Alert {
  return {
    id: ++_alertId,
    ws: ws.hostname, wsId: ws.id, dept: ws.dept,
    metric: def.metric,
    value: def.metric.includes("Temp") ? `${rndInt(80,96)}${def.unit}` : `${rndInt(86,99)}${def.unit}`,
    threshold: def.thr, action: def.action, sev: def.sev,
    ageMin, durationMin: rndInt(4, 240),
    resolved: !!resolved, ack: false,
  };
}

function pickDefsFor(ws: Workstation, n: number) {
  const cands: typeof ALERT_DEFS = [];
  if (ws.ram.usedPct > 85)    cands.push(ALERT_DEFS[0]);
  if (ws.cpu.usage > 92)      cands.push(ALERT_DEFS[1]);
  if (ws.disk.usedPct > 84)   cands.push(ALERT_DEFS[2]);
  if (ws.cpu.temp > 84)       cands.push(ALERT_DEFS[3]);
  if (ws.gpu.temp > 80)       cands.push(ALERT_DEFS[4]);
  while (cands.length < n) cands.push(pick(ALERT_DEFS.slice(0, 5)));
  return cands.slice(0, n);
}

export const alerts: Alert[] = [];
workstations.forEach((ws) => {
  if (ws.status === "critical") {
    pickDefsFor(ws, 2).forEach((d) => alerts.push(makeAlert(ws, d, rndInt(2, 180), false)));
  } else if (ws.status === "warning") {
    if (Math.random() > 0.25)
      pickDefsFor(ws, 1).forEach((d) => alerts.push(makeAlert(ws, d, rndInt(2, 180), false)));
  } else if (ws.status === "offline") {
    alerts.push(makeAlert(ws, ALERT_DEFS[5], ws.lastSeenMin, false));
  }
});
for (let i = 0; i < 14; i++) {
  alerts.push(makeAlert(pick(workstations), pick(ALERT_DEFS), rndInt(180, 2880), true));
}

// ---- events feed ----
const BENIGN: { sev: LiveEvent["sev"]; text: string }[] = [
  { sev: "info",    text: "Monitoring agent reconnected"     },
  { sev: "healthy", text: "Disk cleanup recovered 24 GB"     },
  { sev: "info",    text: "OS security patch applied"        },
  { sev: "healthy", text: "RAM usage returned to normal"     },
  { sev: "warning", text: "GPU temp briefly spiked to 79°C"  },
];

export const events: LiveEvent[] = [];
alerts.filter((a) => !a.resolved).slice(0, 7).forEach((a) => {
  events.push({ id: a.id, sev: a.sev, ws: a.ws, wsId: a.wsId, text: `${a.metric} breached ${a.threshold}`, ageMin: a.ageMin });
});
BENIGN.forEach((b, i) => {
  const ws = pick(workstations);
  events.push({ id: 9000 + i, sev: b.sev, ws: ws.hostname, wsId: ws.id, text: b.text, ageMin: rndInt(1, 90) });
});
events.sort((a, b) => a.ageMin - b.ageMin);

// ---- live tick ----
function tickValue(v: number, vol: number, min: number, max: number) {
  return clamp(v + rnd(-vol, vol), min, max);
}

export function tick(): void {
  workstations.forEach((ws) => {
    if (ws.status === "offline") return;
    const vol = ws.status === "critical" ? 2.4 : ws.status === "warning" ? 3.2 : 5;
    ws.cpu.usage    = tickValue(ws.cpu.usage,   vol,       ws.status === "healthy" ? 4  : 55, ws.status === "critical" ? 100 : 92);
    ws.ram.usedPct  = tickValue(ws.ram.usedPct, vol * 0.4, ws.status === "healthy" ? 22 : 60, 99);
    ws.gpu.load     = tickValue(ws.gpu.load,    vol * 1.3, 0, 100);
    ws.gpu.temp     = tickValue(ws.gpu.temp,    1.1, 38, 94);
    ws.cpu.temp     = tickValue(ws.cpu.temp,    1.2, 40, 97);
    ws.disk.readMBs = tickValue(ws.disk.readMBs,  30, 0, 480);
    ws.disk.writeMBs= tickValue(ws.disk.writeMBs, 24, 0, 360);
    ws.net.ethIn    = tickValue(ws.net.ethIn,  12, 0, 120);
    ws.net.ethOut   = tickValue(ws.net.ethOut,  7, 0, 80);
    ws.net.downMbps = tickValue(ws.net.downMbps, ws.net.downMax * 0.08, 0, ws.net.downMax);
    ws.net.upMbps   = tickValue(ws.net.upMbps,   ws.net.upMax  * 0.08, 0, ws.net.upMax);
    ws.cpu.perCore  = ws.cpu.perCore.map((c) => clamp(c + rnd(-6, 6), 0, 100));
    ws.spark.cpu.push(ws.cpu.usage);   ws.spark.cpu.shift();
    ws.spark.ram.push(ws.ram.usedPct); ws.spark.ram.shift();
    ws.spark.net.push(ws.net.ethIn);   ws.spark.net.shift();
  });
}

// ---- aggregate helpers ----
export function fleet(): FleetStats {
  const online = workstations.filter((w) => w.status !== "offline");
  const avg = (sel: (w: Workstation) => number) =>
    online.reduce((s, w) => s + sel(w), 0) / Math.max(online.length, 1);
  const counts: FleetStats["counts"] = { healthy: 0, warning: 0, critical: 0, offline: 0 };
  workstations.forEach((w) => counts[w.status]++);
  return {
    total:   workstations.length,
    counts,
    avgCpu:  avg((w) => w.cpu.usage),
    avgRam:  avg((w) => w.ram.usedPct),
    avgDisk: avg((w) => w.disk.readMBs + w.disk.writeMBs),
    avgGpu:  avg((w) => w.gpu.load),
    netIn:   workstations.reduce((s, w) => s + w.net.ethIn,  0),
    netOut:  workstations.reduce((s, w) => s + w.net.ethOut, 0),
  };
}

export function byId(id: string): Workstation | undefined {
  return workstations.find((w) => w.id === id);
}
