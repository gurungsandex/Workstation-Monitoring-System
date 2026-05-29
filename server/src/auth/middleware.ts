import type { FastifyRequest, FastifyReply } from "fastify";

export interface JwtPayload {
  sub: string;   // user id
  email: string;
  role: "admin" | "viewer";
}

export interface AgentJwtPayload {
  sub: string;   // workstation id
  type: "agent";
}

// Require a valid user JWT (cookie or Authorization header)
export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify();
  } catch {
    reply.code(401).send({ error: "Unauthorized" });
  }
}

// Require admin role
export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify();
    const user = req.user as JwtPayload;
    if (user.role !== "admin") {
      reply.code(403).send({ error: "Forbidden — admin only" });
    }
  } catch {
    reply.code(401).send({ error: "Unauthorized" });
  }
}

// Require agent JWT (different secret, verified in agent routes)
export async function requireAgent(req: FastifyRequest, reply: FastifyReply) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    reply.code(401).send({ error: "Missing agent token" });
    return;
  }
  try {
    // Agent routes verify with agentJwt plugin instance
    await (req as FastifyRequest & { agentJwtVerify: () => Promise<void> }).agentJwtVerify();
  } catch {
    reply.code(401).send({ error: "Invalid agent token" });
  }
}
