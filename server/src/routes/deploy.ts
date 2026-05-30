import type { FastifyInstance } from "fastify";
import { Client as SshClient } from "ssh2";
import { randomBytes } from "crypto";
import { query } from "../db";
import { requireAdmin } from "../auth/middleware";
import type { JwtPayload } from "../auth/middleware";
import { config } from "../config";

interface DeployBody {
  host_id?:      string;   // discovered_hosts.id — if supplied, IP is looked up
  ip?:           string;   // direct IP (if no host_id)
  ssh_user:      string;
  ssh_password?: string;
  ssh_key?:      string;   // PEM private key text
  ssh_port?:     number;
  hostname?:     string;
  dept?:         string;
  owner?:        string;
}

function genToken(bytes = 24) {
  return randomBytes(bytes).toString("hex");
}

export async function deployRoutes(app: FastifyInstance) {
  // POST /api/deploy
  // SSHs into the target host, generates an enrollment token, and runs the
  // install script in-place.  Streams log lines as newline-delimited JSON
  // (SSE-style plain text) so the frontend can display live output.
  app.post<{ Body: DeployBody }>(
    "/api/deploy",
    { preHandler: [requireAdmin] },
    async (req, reply) => {
      const me = req.user as JwtPayload;
      const {
        host_id, ssh_user, ssh_password, ssh_key,
        ssh_port = 22, hostname = "remote-host", dept, owner,
      } = req.body;

      // Resolve target IP
      let targetIp: string | null = req.body.ip ?? null;
      if (!targetIp && host_id) {
        const [row] = await query<{ ip: string }>(
          "SELECT host(ip) AS ip FROM discovered_hosts WHERE id = $1",
          [host_id]
        );
        targetIp = row?.ip ?? null;
      }
      if (!targetIp) {
        return reply.code(400).send({ error: "ip or host_id required" });
      }
      if (!ssh_password && !ssh_key) {
        return reply.code(400).send({ error: "ssh_password or ssh_key required" });
      }

      // Generate enrollment token + workstation record
      const token = genToken();
      const [ws] = await query<{ id: string }>(
        `INSERT INTO workstations (hostname, ip, dept, owner_name, enrollment_token, status)
         VALUES ($1, $2, $3, $4, $5, 'offline') RETURNING id`,
        [hostname, targetIp, dept ?? null, owner ?? null, token]
      );

      // Build server URLs (reuse same logic as enrollment.ts)
      const host       = req.headers["host"] ?? `localhost:${config.port}`;
      const serverBase = `${req.protocol}://${host}`;
      const wsUrl      = serverBase.replace(/^http/, "ws") + "/ws/agent";

      await query(
        "INSERT INTO audit_log (user_id, action, entity_type, entity_id, metadata) VALUES ($1, 'deploy_agent', 'workstation', $2, $3)",
        [me.sub, ws.id, JSON.stringify({ targetIp, hostname, ssh_user })]
      );

      // Stream output as newline-delimited plain text
      reply.raw.writeHead(200, {
        "Content-Type":  "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-Accel-Buffering": "no",
      });

      const log = (line: string) => {
        reply.raw.write(line + "\n");
      };

      const cmd = [
        `export WMS_ENROLL_TOKEN="${token}"`,
        `export WMS_SERVER_URL="${wsUrl}"`,
        `curl -fsSL ${serverBase}/install/macos | sudo -E bash 2>&1`,
        `|| curl -fsSL ${serverBase}/install/linux  | sudo -E bash 2>&1`,
      ].join(" && ");

      log(`[wms] Connecting to ${targetIp}:${ssh_port} as ${ssh_user}…`);

      await new Promise<void>((resolve) => {
        const ssh = new SshClient();

        ssh.on("ready", () => {
          log(`[wms] SSH connected. Running install script…`);
          log(`[wms] Token: ${token.slice(0, 8)}****`);

          ssh.exec(cmd, { pty: false }, (err, stream) => {
            if (err) {
              log(`[error] exec failed: ${err.message}`);
              ssh.end();
              resolve();
              return;
            }

            stream.on("data", (d: Buffer) => {
              d.toString().split("\n").filter(Boolean).forEach((l) => log(l));
            });

            stream.stderr.on("data", (d: Buffer) => {
              d.toString().split("\n").filter(Boolean).forEach((l) => log(`[stderr] ${l}`));
            });

            stream.on("close", (code: number) => {
              if (code === 0) {
                log(`[wms] ✓ Agent installed successfully.`);
                log(`[wms] workstation_id=${ws.id}`);
              } else {
                log(`[wms] ✗ Install exited with code ${code}.`);
              }
              ssh.end();
              resolve();
            });
          });
        });

        ssh.on("error", (err) => {
          log(`[error] SSH error: ${err.message}`);
          resolve();
        });

        ssh.connect({
          host:       targetIp!,
          port:       ssh_port,
          username:   ssh_user,
          password:   ssh_password,
          privateKey: ssh_key,
          readyTimeout: 15_000,
        });
      });

      reply.raw.end();
    }
  );
}
