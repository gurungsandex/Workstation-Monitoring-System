import { exec } from "child_process";
import { promisify } from "util";
import { query } from "../db";
import { config } from "../config";

const execAsync = promisify(exec);

interface HostResult {
  ip: string;
  mac?: string;
  hostname?: string;
  vendor?: string;
  open_ports?: number[];
}

// Convert CIDR to list of IPs (for small /24 subnets)
function cidrToIps(cidr: string): string[] {
  const [base, prefixStr] = cidr.split("/");
  const prefix = parseInt(prefixStr ?? "24");
  if (prefix < 16 || prefix > 30) return []; // safety limit

  const parts = base.split(".").map(Number);
  const hostBits = 32 - prefix;
  const count = Math.pow(2, hostBits) - 2; // exclude network + broadcast
  const baseNum =
    ((parts[0] ?? 0) << 24) |
    ((parts[1] ?? 0) << 16) |
    ((parts[2] ?? 0) << 8)  |
     (parts[3] ?? 0);

  const ips: string[] = [];
  for (let i = 1; i <= count; i++) {
    const n = (baseNum & ~((1 << hostBits) - 1)) + i;
    ips.push(`${(n >>> 24) & 0xff}.${(n >>> 16) & 0xff}.${(n >>> 8) & 0xff}.${n & 0xff}`);
  }
  return ips;
}

// Ping an IP, resolve its hostname
async function probeHost(ip: string, timeoutMs: number): Promise<HostResult | null> {
  try {
    // Try ping (1 packet, short timeout)
    const pingCmd = process.platform === "win32"
      ? `ping -n 1 -w ${timeoutMs} ${ip}`
      : `ping -c 1 -W ${Math.ceil(timeoutMs / 1000)} ${ip}`;

    await execAsync(pingCmd, { timeout: timeoutMs + 500 });

    // Try hostname resolution
    let hostname: string | undefined;
    try {
      const { stdout } = await execAsync(`nslookup ${ip}`, { timeout: 2000 });
      const match = stdout.match(/name\s*=\s*([^\s]+)/i) ?? stdout.match(/Name:\s+([^\s]+)/i);
      hostname = match?.[1]?.replace(/\.$/, "");
    } catch { /* ignore */ }

    // Try ARP for MAC
    let mac: string | undefined;
    try {
      const { stdout } = await execAsync(
        process.platform === "linux" ? `arp -n ${ip}` : `arp ${ip}`,
        { timeout: 1000 }
      );
      const macMatch = stdout.match(/([0-9a-f]{2}[:-]){5}[0-9a-f]{2}/i);
      mac = macMatch?.[0]?.toUpperCase().replace(/-/g, ":");
    } catch { /* ignore */ }

    return { ip, mac, hostname };
  } catch {
    return null; // host unreachable
  }
}

// Run a scan of configured CIDRs, update discovered_hosts table
export async function runScan(sessionId: string, cidrs?: string[]): Promise<void> {
  const targets = cidrs ?? config.scan.cidrs;
  const allIps = targets.flatMap(cidrToIps);

  // Concurrency-limited probe
  const results: HostResult[] = [];
  const concurrency = config.scan.concurrency;
  for (let i = 0; i < allIps.length; i += concurrency) {
    const batch = allIps.slice(i, i + concurrency);
    const settled = await Promise.all(
      batch.map((ip) => probeHost(ip, config.scan.timeoutMs))
    );
    results.push(...settled.filter((r): r is HostResult => r !== null));
  }

  // Upsert discovered_hosts
  for (const host of results) {
    await query(
      `INSERT INTO discovered_hosts (ip, mac, hostname, last_scanned)
       VALUES ($1::inet, $2, $3, NOW())
       ON CONFLICT (ip) DO UPDATE
         SET mac = EXCLUDED.mac,
             hostname = COALESCE(EXCLUDED.hostname, discovered_hosts.hostname),
             last_scanned = NOW()`,
      [host.ip, host.mac ?? null, host.hostname ?? null]
    );
  }

  await query(
    "UPDATE scan_sessions SET completed_at = NOW(), host_count = $2, status = 'done' WHERE id = $1",
    [sessionId, results.length]
  );
}
