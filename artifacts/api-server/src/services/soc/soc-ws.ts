/**
 * SOC real-time WebSocket layer.
 *
 *   /ws/soc          — operator console (admin session required)
 *   /ws/portal/soc   — customer portal (customer session required, tenant-scoped)
 *
 * Connections are authenticated by replaying the existing express-session
 * middleware over the HTTP upgrade request, so the same `cstep.sid` cookie that
 * authorizes REST calls authorizes the socket. Engine code broadcasts via the
 * `soc-events` indirection (registered here at init).
 */

import type { Server, IncomingMessage } from "http";
import type { Response } from "express";
import { WebSocketServer, WebSocket } from "ws";
import { logger } from "../../lib/logger";
import { sessionMiddleware } from "../../app";
import { registerSOCBroadcaster, type SOCEvent } from "./soc-events";

interface SocketMeta {
  scope: "admin" | "customer";
  customerId?: number;
}

const clients = new Map<WebSocket, SocketMeta>();

function runSession(req: IncomingMessage): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    const res = {} as Response;
    try {
      sessionMiddleware(req as never, res, () => {
        const sess = (req as { session?: Record<string, unknown> }).session;
        resolve(sess ?? null);
      });
    } catch {
      resolve(null);
    }
  });
}

function send(ws: WebSocket, event: SOCEvent): void {
  if (ws.readyState === WebSocket.OPEN) {
    try { ws.send(JSON.stringify(event)); } catch { /* ignore */ }
  }
}

export function broadcastToSOC(event: SOCEvent): void {
  for (const [ws, meta] of clients) {
    if (meta.scope === "admin") {
      send(ws, event); // operators see everything
    } else if (meta.scope === "customer" && meta.customerId === event.customerId) {
      send(ws, event); // customers only see their own tenant
    }
  }
}

export function initSOCWebSocket(server: Server): void {
  const adminWss = new WebSocketServer({ noServer: true });
  const portalWss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = req.url ?? "";
    const isAdmin = url.startsWith("/ws/soc");
    const isPortal = url.startsWith("/ws/portal/soc");
    if (!isAdmin && !isPortal) return; // let other upgrade handlers (e.g. Vite HMR) deal with it

    void (async () => {
      const sess = await runSession(req);
      if (isAdmin) {
        const adminId = sess?.["adminId"] as number | undefined;
        if (!adminId) { socket.destroy(); return; }
        adminWss.handleUpgrade(req, socket, head, (ws) => {
          clients.set(ws, { scope: "admin" });
          ws.on("close", () => clients.delete(ws));
          send(ws, { type: "case_updated", ts: new Date().toISOString(), data: { hello: "operator" } });
        });
      } else {
        const customerId = sess?.["customerId"] as number | undefined;
        if (!customerId) { socket.destroy(); return; }
        portalWss.handleUpgrade(req, socket, head, (ws) => {
          clients.set(ws, { scope: "customer", customerId });
          ws.on("close", () => clients.delete(ws));
          send(ws, { type: "case_updated", customerId, ts: new Date().toISOString(), data: { hello: "portal" } });
        });
      }
    })();
  });

  registerSOCBroadcaster(broadcastToSOC);
  logger.info("SOC WebSocket initialized (/ws/soc, /ws/portal/soc)");
}
