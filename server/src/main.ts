import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import fastifyWebsocket from "@fastify/websocket";
import fastifyRateLimit from "@fastify/rate-limit";
import { config } from "./config";
import { authRoutes } from "./routes/auth";
import { enrollmentRoutes } from "./routes/enrollment";
import { metricsRoutes } from "./routes/metrics";
import { workstationRoutes } from "./routes/workstations";
import { alertRoutes } from "./routes/alerts";
import { discoveryRoutes } from "./routes/discovery";
import { agentWsRoutes } from "./ws/agentHandler";
import { browserWsRoutes } from "./ws/browserHandler";
import { raiseHeartbeatAlert } from "./services/alertEngine";
import { query } from "./db";

const app = Fastify({ logger: { level: "info" } });

async function main() {
  // Plugins
  await app.register(fastifyCors, {
    origin: config.cors.origin,
    credentials: true,
  });

  await app.register(fastifyRateLimit, {
    max: parseInt(process.env.RATE_LIMIT_MAX ?? "600"),
    timeWindow: "1 minute",
  });

  await app.register(fastifyCookie);

  await app.register(fastifyJwt, {
    secret: config.jwt.secret,
    cookie: { cookieName: "wms_token", signed: false },
  });

  await app.register(fastifyWebsocket);

  // Routes (each route file declares full /api/... paths)
  await app.register(authRoutes);
  await app.register(enrollmentRoutes);
  await app.register(metricsRoutes);
  await app.register(workstationRoutes);
  await app.register(alertRoutes);
  await app.register(discoveryRoutes);

  // WebSocket routes
  await app.register(agentWsRoutes);
  await app.register(browserWsRoutes);

  // Health check
  app.get("/health", async () => ({ ok: true }));

  // Start heartbeat watchdog
  startHeartbeatWatchdog();

  await app.listen({ port: config.port, host: "0.0.0.0" });
  app.log.info(`Server listening on port ${config.port}`);
}

// Detect agents that haven't sent a metric in >5 minutes
function startHeartbeatWatchdog() {
  setInterval(async () => {
    try {
      const stale = await query<{ id: string }>(
        `SELECT id FROM workstations
         WHERE status != 'offline'
           AND last_seen_at < NOW() - INTERVAL '5 minutes'`
      );
      for (const ws of stale) {
        await raiseHeartbeatAlert(ws.id);
      }
    } catch (err) {
      app.log.error({ err }, "Heartbeat watchdog error");
    }
  }, config.alerts.intervalMs);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
