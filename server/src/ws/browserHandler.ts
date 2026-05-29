import type { FastifyInstance } from "fastify";
import { registerClient } from "./hub";

export async function browserWsRoutes(app: FastifyInstance) {
  // ws://server:4000/ws/live  — browser dashboard connection
  app.get(
    "/ws/live",
    { websocket: true },
    async (connection, req) => {
      // Optional: verify user JWT (cookie or query param)
      // For now allow unauthenticated reads (dashboard is read-only)
      registerClient(connection.socket);
      app.log.info({ ip: req.ip }, "Browser WS client connected");
    }
  );
}
