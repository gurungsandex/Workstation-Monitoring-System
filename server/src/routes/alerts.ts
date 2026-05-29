import type { FastifyInstance } from "fastify";
import { query } from "../db";
import { requireAuth, requireAdmin } from "../auth/middleware";
import type { JwtPayload } from "../auth/middleware";

export async function alertRoutes(app: FastifyInstance) {
  // GET /api/alerts — list with filters
  app.get<{
    Querystring: {
      resolved?: string;  // "true"|"false"
      severity?: string;  // "critical"|"warning"|"all"
      workstation_id?: string;
      page?: string;
      limit?: string;
    };
  }>("/api/alerts", { preHandler: [requireAuth] }, async (req) => {
    const { resolved = "false", severity = "all", workstation_id,
            page = "1", limit = "50" } = req.query;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let pi = 1;

    if (resolved !== "all") {
      conditions.push(`a.is_resolved = $${pi++}`);
      params.push(resolved === "true");
    }
    if (severity !== "all") {
      conditions.push(`a.severity = $${pi++}`);
      params.push(severity);
    }
    if (workstation_id) {
      conditions.push(`a.workstation_id = $${pi++}`);
      params.push(workstation_id);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [{ count }] = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM alerts a ${where}`, params
    );

    const rows = await query(
      `SELECT a.id, a.workstation_id, w.hostname, w.dept,
              a.metric, a.value, a.threshold, a.severity, a.action,
              a.is_resolved, a.is_ack, a.ack_by, a.ack_at,
              a.started_at, a.resolved_at, a.duration_min
       FROM alerts a
       JOIN workstations w ON w.id = a.workstation_id
       ${where}
       ORDER BY a.started_at DESC
       LIMIT $${pi} OFFSET $${pi + 1}`,
      [...params, parseInt(limit), offset]
    );

    return { total: parseInt(count), rows };
  });

  // POST /api/alerts/ack  — acknowledge one or many
  app.post<{ Body: { ids: string[] } }>(
    "/api/alerts/ack",
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const me = req.user as JwtPayload;
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0)
        return reply.code(400).send({ error: "ids required" });

      await query(
        `UPDATE alerts SET is_ack = TRUE, ack_by = $1, ack_at = NOW()
         WHERE id = ANY($2::uuid[]) AND is_resolved = FALSE`,
        [me.email, ids]
      );
      await query(
        "INSERT INTO audit_log (user_id, action, entity_type, metadata) VALUES ($1, 'ack_alerts', 'alert', $2)",
        [me.sub, JSON.stringify({ ids })]
      );
      return { ok: true, count: ids.length };
    }
  );

  // GET /api/alerts/summary — counts for the summary strip
  app.get("/api/alerts/summary", { preHandler: [requireAuth] }, async () => {
    const [row] = await query<Record<string, string>>(
      `SELECT
         COUNT(*) FILTER (WHERE NOT is_resolved AND severity = 'critical') AS active_critical,
         COUNT(*) FILTER (WHERE NOT is_resolved AND severity = 'warning')  AS active_warning,
         COUNT(*) FILTER (WHERE NOT is_resolved AND is_ack)               AS acknowledged,
         COUNT(*) FILTER (WHERE is_resolved AND resolved_at > NOW() - INTERVAL '24h') AS resolved_24h
       FROM alerts`
    );
    return {
      activeCritical: parseInt(row.active_critical ?? "0"),
      activeWarning:  parseInt(row.active_warning  ?? "0"),
      acknowledged:   parseInt(row.acknowledged    ?? "0"),
      resolved24h:    parseInt(row.resolved_24h    ?? "0"),
    };
  });
}
