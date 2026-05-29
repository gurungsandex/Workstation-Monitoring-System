import type { FastifyInstance } from "fastify";
import { ingestMetric } from "../routes/metrics";
import type { MetricPayload } from "../routes/metrics";

export async function agentWsRoutes(app: FastifyInstance) {
  // ws://server:4000/ws/agent  — persistent agent connection
  app.get(
    "/ws/agent",
    { websocket: true },
    async (connection, req) => {
      // Verify agent JWT from query param or Authorization header
      const token = (req.query as Record<string, string>).token ??
                    req.headers.authorization?.slice(7);
      if (!token) {
        connection.socket.close(4001, "Unauthorized");
        return;
      }

      let agentPayload: { sub: string; type: string };
      try {
        agentPayload = app.jwt.verify(token) as { sub: string; type: string };
      } catch {
        connection.socket.close(4001, "Invalid token");
        return;
      }
      if (agentPayload.type !== "agent") {
        connection.socket.close(4003, "Not an agent token");
        return;
      }

      const workstationId = agentPayload.sub;
      app.log.info({ workstationId }, "Agent connected");

      connection.socket.on("message", async (raw: Buffer) => {
        try {
          const payload = JSON.parse(raw.toString()) as MetricPayload;
          payload.workstation_id = workstationId; // enforce from token, not message
          await ingestMetric(workstationId, payload);
        } catch (err) {
          app.log.error({ err }, "Agent WS message error");
        }
      });

      connection.socket.on("close", () => {
        app.log.info({ workstationId }, "Agent disconnected");
      });

      // Send ack
      connection.socket.send(JSON.stringify({ type: "connected", workstation_id: workstationId }));
    }
  );
}
