import type { FastifyInstance } from "fastify";
import bcrypt from "bcrypt";
import { query, queryOne } from "../db";
import { requireAuth } from "../auth/middleware";
import type { JwtPayload } from "../auth/middleware";

export async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/login
  app.post<{ Body: { email: string; password: string } }>(
    "/api/auth/login",
    async (req, reply) => {
      const { email, password } = req.body;
      if (!email || !password) return reply.code(400).send({ error: "email and password required" });

      const user = await queryOne<{ id: string; password_hash: string; role: string; email: string }>(
        "SELECT id, email, password_hash, role FROM users WHERE email = $1",
        [email.toLowerCase()]
      );
      if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        return reply.code(401).send({ error: "Invalid credentials" });
      }

      await query("UPDATE users SET last_login_at = NOW() WHERE id = $1", [user.id]);

      const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role as "admin" | "viewer" };
      const token = app.jwt.sign(payload, { expiresIn: "7d" });

      // Audit
      await query(
        "INSERT INTO audit_log (user_id, action, ip_addr) VALUES ($1, 'login', $2)",
        [user.id, req.ip]
      );

      reply.setCookie("wms_token", token, {
        httpOnly: true, sameSite: "strict", path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 7,
      });
      return { ok: true, role: user.role, email: user.email };
    }
  );

  // POST /api/auth/logout
  app.post("/api/auth/logout", async (_req, reply) => {
    reply.clearCookie("wms_token", { path: "/" });
    return { ok: true };
  });

  // GET /api/auth/me
  app.get("/api/auth/me", { preHandler: [requireAuth] }, async (req) => {
    const user = req.user as JwtPayload;
    return { id: user.sub, email: user.email, role: user.role };
  });

  // POST /api/auth/users — admin creates another user
  app.post<{ Body: { email: string; password: string; role: string } }>(
    "/api/auth/users",
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const me = req.user as JwtPayload;
      if (me.role !== "admin") return reply.code(403).send({ error: "Admin only" });
      const { email, password, role = "viewer" } = req.body;
      if (!email || !password) return reply.code(400).send({ error: "email and password required" });
      const hash = await bcrypt.hash(password, 12);
      const [created] = await query<{ id: string; email: string; role: string }>(
        "INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role",
        [email.toLowerCase(), hash, role]
      );
      await query(
        "INSERT INTO audit_log (user_id, action, entity_type, entity_id, metadata) VALUES ($1, 'create_user', 'user', $2, $3)",
        [me.sub, created.id, JSON.stringify({ email, role })]
      );
      return created;
    }
  );

  // GET /api/auth/users — admin lists all users
  app.get(
    "/api/auth/users",
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const me = req.user as JwtPayload;
      if (me.role !== "admin") return reply.code(403).send({ error: "Admin only" });
      return query<{ id: string; email: string; role: string; created_at: string; last_login_at: string | null }>(
        "SELECT id, email, role, created_at, last_login_at FROM users ORDER BY created_at ASC",
        []
      );
    }
  );

  // DELETE /api/auth/users/:id — admin deletes a user (cannot delete self)
  app.delete<{ Params: { id: string } }>(
    "/api/auth/users/:id",
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const me = req.user as JwtPayload;
      if (me.role !== "admin") return reply.code(403).send({ error: "Admin only" });
      if (req.params.id === me.sub) return reply.code(400).send({ error: "Cannot delete your own account" });
      await query("DELETE FROM users WHERE id = $1", [req.params.id]);
      await query(
        "INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES ($1, 'delete_user', 'user', $2)",
        [me.sub, req.params.id]
      );
      return { ok: true };
    }
  );

  // POST /api/auth/change-password — any authenticated user changes own password
  app.post<{ Body: { currentPassword: string; newPassword: string } }>(
    "/api/auth/change-password",
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const me = req.user as JwtPayload;
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) return reply.code(400).send({ error: "Both passwords required" });
      if (newPassword.length < 8) return reply.code(400).send({ error: "Password must be at least 8 characters" });

      const user = await queryOne<{ id: string; password_hash: string }>(
        "SELECT id, password_hash FROM users WHERE id = $1",
        [me.sub]
      );
      if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
        return reply.code(401).send({ error: "Current password is incorrect" });
      }
      const hash = await bcrypt.hash(newPassword, 12);
      await query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, me.sub]);
      await query(
        "INSERT INTO audit_log (user_id, action) VALUES ($1, 'change_password')",
        [me.sub]
      );
      return { ok: true };
    }
  );

  // GET /api/audit — admin reads audit log
  app.get<{ Querystring: { page?: string; limit?: string } }>(
    "/api/audit",
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const me = req.user as JwtPayload;
      if (me.role !== "admin") return reply.code(403).send({ error: "Admin only" });
      const page = parseInt(req.query.page ?? "1");
      const limit = Math.min(parseInt(req.query.limit ?? "50"), 200);
      const offset = (page - 1) * limit;
      const [{ count }] = await query<{ count: string }>("SELECT COUNT(*) as count FROM audit_log", []);
      const rows = await query(
        `SELECT a.id, u.email, a.action, a.entity_type, a.entity_id,
                a.metadata, a.ip_addr, a.created_at
         FROM audit_log a
         LEFT JOIN users u ON u.id = a.user_id
         ORDER BY a.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      return { total: parseInt(count), rows };
    }
  );
}
