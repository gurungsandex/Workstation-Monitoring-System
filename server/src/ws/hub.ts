import type { WebSocket } from "@fastify/websocket";

// In-memory set of connected browser WebSocket clients
const clients = new Set<WebSocket>();

export function registerClient(ws: WebSocket): void {
  clients.add(ws);
  ws.on("close", () => clients.delete(ws));
}

export function broadcast(payload: unknown): void {
  const msg = JSON.stringify(payload);
  for (const ws of clients) {
    try {
      if (ws.readyState === 1 /* OPEN */) ws.send(msg);
    } catch { /* skip closed */ }
  }
}
