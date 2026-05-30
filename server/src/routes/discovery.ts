import type { FastifyInstance } from "fastify";
import { query } from "../db";
import { requireAdmin, requireAuth } from "../auth/middleware";
import type { JwtPayload } from "../auth/middleware";
import { runScan } from "../services/discovery";

export async function discoveryRoutes(app: FastifyInstance) {
  // POST /api/discover  — start a network scan (admin)
  app.post<{ Body: { cidrs?: string[] } }>(
    "/api/discover",
    { preHandler: [requireAdmin] },
    async (req, reply) => {
      const me = req.user as JwtPayload;
      const cidrs = req.body.cidrs ?? undefined; // undefined → use config CIDRs

      const [session] = await query<{ id: string }>(
        "INSERT INTO scan_sessions (cidr, started_by) VALUES ($1, $2) RETURNING id",
        [(cidrs ?? []).join(",") || "auto", me.sub]
      );

      // Run in background, don't await
      runScan(session.id, cidrs).catch((err) =>
        app.log.error({ err }, "scan error")
      );

      await query(
        "INSERT INTO audit_log (user_id, action, metadata) VALUES ($1, 'discovery_scan', $2)",
        [me.sub, JSON.stringify({ cidrs })]
      );

      return { session_id: session.id, status: "running" };
    }
  );

  // GET /api/discover/sessions  — list recent scan sessions
  app.get("/api/discover/sessions", { preHandler: [requireAuth] }, async () =>
    query(
      `SELECT s.id, s.cidr, s.started_at, s.completed_at, s.host_count, s.status,
              u.email as started_by_email
       FROM scan_sessions s LEFT JOIN users u ON u.id = s.started_by
       ORDER BY s.started_at DESC LIMIT 20`
    )
  );

  // GET /api/discover/hosts  — list discovered hosts with enrollment state
  app.get<{ Querystring: { session_id?: string } }>(
    "/api/discover/hosts",
    { preHandler: [requireAuth] },
    async (req) => {
      const { session_id } = req.query;
      // Return all discovered hosts (joined with enrolled workstation if applicable)
      return query(
        `SELECT
           dh.id, host(dh.ip) AS ip, dh.mac, dh.hostname, dh.vendor, dh.open_ports,
           dh.last_scanned,
           CASE WHEN dh.workstation_id IS NOT NULL THEN true ELSE false END AS is_enrolled,
           dh.workstation_id,
           w.status, w.hostname as ws_hostname, w.dept
         FROM discovered_hosts dh
         LEFT JOIN workstations w ON w.id = dh.workstation_id
         ORDER BY dh.ip`
      );
    }
  );

  // GET /api/discover/sessions/:id  — poll a scan session
  app.get<{ Params: { id: string } }>(
    "/api/discover/sessions/:id",
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const [s] = await query(
        "SELECT * FROM scan_sessions WHERE id = $1",
        [req.params.id]
      );
      if (!s) return reply.code(404).send({ error: "Not found" });
      return s;
    }
  );
}
