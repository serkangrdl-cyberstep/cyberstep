/**
 * Uptime Monitoring Webhook
 * POST /api/monitoring/uptime-alert  — UptimeRobot / BetterStack
 * GET  /api/monitoring/status        — Public status sayfası için
 */

import { Router, type Request, type Response } from "express";
import { handleUptimeAlert, getPlatformStatus } from "../../services/platformMonitor";
import { logger } from "../../lib/logger";

const router = Router();

// ─── Webhook (UptimeRobot / BetterStack) ─────────────────────────────────────

router.post("/monitoring/uptime-alert", async (req: Request, res: Response) => {
  // Opsiyonel webhook secret doğrulama
  const secret = process.env["UPTIME_WEBHOOK_SECRET"];
  if (secret) {
    const provided = req.headers["x-webhook-secret"] ?? req.body?.secret;
    if (provided !== secret) {
      res.status(401).json({ error: "Yetkisiz" });
      return;
    }
  }

  const { monitor, status, reason } = req.body as {
    monitor?: string;
    status?: string;
    reason?: string;
  };

  if (!monitor || !status) {
    res.status(400).json({ error: "monitor ve status gerekli" });
    return;
  }

  if (status !== "down" && status !== "up") {
    res.status(400).json({ error: "status 'down' veya 'up' olmalı" });
    return;
  }

  logger.info({ monitor, status, reason }, "Uptime alert received");

  setImmediate(async () => {
    try {
      await handleUptimeAlert({ monitor, status, reason });
    } catch (err) {
      logger.error({ err, monitor, status }, "Uptime alert handler failed");
    }
  });

  res.json({ ok: true });
});

// ─── Genel durum (status sayfası) ────────────────────────────────────────────

router.get("/monitoring/status", async (_req: Request, res: Response) => {
  const status = await getPlatformStatus();
  res.json(status);
});

export default router;
