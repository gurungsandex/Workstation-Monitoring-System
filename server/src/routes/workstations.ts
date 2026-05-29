import type { FastifyInstance } from "fastify";
import { query, queryOne } from "../db";
import { requireAuth, requireAdmin } from "../auth/middleware";
import type { JwtPayload } from "../auth/middleware";

export async function workstationRoutes(app: FastifyInstance) {
  // GET /api/workstations — list with filter/sort/search
  app.get<{
    Querystring: {
      search?: string;
      status?: string;   // healthy|warning|critical|offline|all
      os?: string;       // windows|mac|linux|all
      dept?: string;
      sort?: string;     // hostname|status|cpu|ram|disk|health
      dir?: string;      // asc|desc
      page?: string;
      limit?: string;
    };
  }>("/api/workstations", { preHandler: [requireAuth] }, async (req) => {
    const {
      search = "", status = "all", os = "all", dept,
      sort = "hostname", dir = "asc",
      page = "1", limit = "50",
    } = req.query;

    const SAFE_SORT: Record<string, string> = {
      hostname: "hostname", status: "status",
      cpu:  "snap_cpu_usage",  ram:  "snap_ram_used_pct",
      disk: "snap_disk_used_pct", health: "health_score",
      last_seen: "last_seen_at",
    };
    const sortCol = SAFE_SORT[sort] ?? "hostname";
    const sortDir = dir === "desc" ? "DESC" : "ASC";

    const conditions: string[] = ["enrolled_at IS NOT NULL"];
    const params: unknown[] = [];
    let pi = 1;

    if (search) {
      conditions.push(`(hostname ILIKE $${pi} OR owner_name ILIKE $${pi} OR dept ILIKE $${pi} OR ip::text ILIKE $${pi})`);
      params.push(`%${search}%`);
      pi++;
    }
    if (status !== "all") {
      conditions.push(`status = $${pi++}`);
      params.push(status);
    }
    if (os !== "all") {
      conditions.push(`os_family = $${pi++}`);
      params.push(os);
    }
    if (dept) {
      conditions.push(`dept = $${pi++}`);
      params.push(dept);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [{ count }] = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM workstations ${where}`,
      params
    );

    const rows = await query(
      `SELECT id, hostname, ip, mac, dept, owner_name,
              os_name, os_short, os_family, status, health_score,
              snap_cpu_usage, snap_ram_used_pct, snap_disk_used_pct,
              snap_net_eth_in, snap_net_eth_out,
              uptime_sec, last_seen_at, enrolled_at, agent_version
       FROM workstations ${where}
       ORDER BY ${sortCol} ${sortDir}
       LIMIT $${pi} OFFSET $${pi + 1}`,
      [...params, parseInt(limit), offset]
    );

    return { total: parseInt(count), rows };
  });

  // GET /api/workstations/fleet  — fleet aggregate for dashboard
  app.get("/api/workstations/fleet", { preHandler: [requireAuth] }, async () => {
    const [totals] = await query<Record<string, string>>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'healthy')  AS healthy,
         COUNT(*) FILTER (WHERE status = 'warning')  AS warning,
         COUNT(*) FILTER (WHERE status = 'critical') AS critical,
         COUNT(*) FILTER (WHERE status = 'offline')  AS offline,
         COUNT(*) AS total,
         AVG(snap_cpu_usage)     FILTER (WHERE status != 'offline') AS avg_cpu,
         AVG(snap_ram_used_pct)  FILTER (WHERE status != 'offline') AS avg_ram,
         AVG(snap_disk_used_pct) FILTER (WHERE status != 'offline') AS avg_disk,
         AVG(snap_gpu_load)      FILTER (WHERE status != 'offline') AS avg_gpu,
         SUM(snap_net_eth_in)    AS net_in,
         SUM(snap_net_eth_out)   AS net_out
       FROM workstations WHERE enrolled_at IS NOT NULL`
    );
    return {
      counts: {
        healthy:  parseInt(totals.healthy ?? "0"),
        warning:  parseInt(totals.warning ?? "0"),
        critical: parseInt(totals.critical ?? "0"),
        offline:  parseInt(totals.offline ?? "0"),
      },
      total:   parseInt(totals.total ?? "0"),
      avgCpu:  parseFloat(totals.avg_cpu ?? "0"),
      avgRam:  parseFloat(totals.avg_ram ?? "0"),
      avgDisk: parseFloat(totals.avg_disk ?? "0"),
      avgGpu:  parseFloat(totals.avg_gpu ?? "0"),
      netIn:   parseFloat(totals.net_in ?? "0"),
      netOut:  parseFloat(totals.net_out ?? "0"),
    };
  });

  // GET /api/workstations/:id  — full detail
  app.get<{ Params: { id: string } }>(
    "/api/workstations/:id",
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const ws = await queryOne(
        "SELECT * FROM workstations WHERE id = $1 AND enrolled_at IS NOT NULL",
        [req.params.id]
      );
      if (!ws) return reply.code(404).send({ error: "Not found" });
      return ws;
    }
  );

  // PATCH /api/workstations/:id  — update dept/owner (admin)
  app.patch<{ Params: { id: string }; Body: { dept?: string; owner_name?: string; hostname?: string } }>(
    "/api/workstations/:id",
    { preHandler: [requireAdmin] },
    async (req, reply) => {
      const me = req.user as JwtPayload;
      const { dept, owner_name, hostname } = req.body;
      const ws = await queryOne<{ id: string }>(
        "SELECT id FROM workstations WHERE id = $1", [req.params.id]
      );
      if (!ws) return reply.code(404).send({ error: "Not found" });

      await query(
        `UPDATE workstations SET
           dept = COALESCE($2, dept),
           owner_name = COALESCE($3, owner_name),
           hostname = COALESCE($4, hostname)
         WHERE id = $1`,
        [req.params.id, dept ?? null, owner_name ?? null, hostname ?? null]
      );
      await query(
        "INSERT INTO audit_log (user_id, action, entity_type, entity_id, metadata) VALUES ($1, 'update_workstation', 'workstation', $2, $3)",
        [me.sub, req.params.id, JSON.stringify({ dept, owner_name, hostname })]
      );
      return { ok: true };
    }
  );
}
