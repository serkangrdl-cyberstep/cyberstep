import { Router, type Request, type Response } from "express";
import { z } from "zod/v4";
import { logger } from "../../lib/logger";
import { requireApiKey, trackUsage } from "./middleware";
import https from "https";

const router = Router();

const triggerSchema = z.object({
  domain: z.string().min(3).max(253),
  webhookUrl: z.url().optional(),
  priority: z.enum(["normal", "high"]).optional().default("normal"),
});

// ─── POST /api/v1/scan/trigger ────────────────────────────────────────────────
// Trigger an async domain scan; result delivered to webhookUrl when ready
router.post("/v1/scan/trigger", requireApiKey, async (req: Request, res: Response) => {
  const start = req.v1StartedAt ?? Date.now();

  const parsed = triggerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Geçersiz istek.", details: parsed.error.issues });
    return;
  }

  const { domain, webhookUrl: bodyWebhook } = parsed.data;
  const effectiveWebhook = bodyWebhook ?? req.apiKey!.webhookUrl;

  if (!effectiveWebhook) {
    res.status(400).json({
      error: "Webhook URL gerekli. İsteğe webhookUrl ekleyin veya API key ayarlarından varsayılan webhook URL tanımlayın.",
    });
    return;
  }

  const scanId = `scan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Fire-and-forget: trigger the internal domain scan endpoint, then POST result to webhook
  const apiKeyId = req.apiKey!.id;
  const apiKeyEmail = req.apiKey!.email;

  setImmediate(async () => {
    try {
      logger.info({ scanId, domain, webhookUrl: effectiveWebhook }, "Async scan triggered via API v1");

      // Call the existing domain scan endpoint internally
      const internalBaseUrl = `http://localhost:${process.env.PORT ?? 5000}`;
      let scanOk = false;
      let scanJson: Record<string, unknown> = {};
      try {
        const scanRes = await fetch(`${internalBaseUrl}/api/scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain, email: apiKeyEmail, referralSource: "api-v1" }),
          signal: AbortSignal.timeout(120_000),
        });
        scanOk = scanRes.ok;
        scanJson = await scanRes.json().catch(() => ({})) as Record<string, unknown>;
      } catch (fetchErr) {
        scanJson = { error: String(fetchErr) };
      }

      // Deliver result to webhook
      const payload = JSON.stringify({
        event: "scan.complete",
        scanId,
        domain,
        timestamp: new Date().toISOString(),
        result: scanOk ? scanJson : null,
        error: !scanOk ? (scanJson.error ?? "Tarama başarısız") : null,
      });

      const webhookUrlObj = new URL(effectiveWebhook);
      const options = {
        hostname: webhookUrlObj.hostname,
        port: webhookUrlObj.port || (webhookUrlObj.protocol === "https:" ? 443 : 80),
        path: webhookUrlObj.pathname + webhookUrlObj.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
          "User-Agent": "CyberStep-API/v1",
          "X-CyberStep-Scan-Id": scanId,
          "X-CyberStep-Event": "scan.complete",
        },
      };

      await new Promise<void>((resolve) => {
        const req2 = (webhookUrlObj.protocol === "https:" ? https : { request: (o: object, cb: (r: unknown) => void) => { const h = require("http"); return h.request(o, cb); } }).request(options, () => resolve());
        req2.on("error", (e: Error) => { logger.warn({ err: e, scanId, webhookUrl: effectiveWebhook }, "Webhook delivery failed"); resolve(); });
        req2.setTimeout(15000, () => { req2.destroy(); resolve(); });
        req2.write(payload);
        req2.end();
      });

      logger.info({ scanId, domain, webhookUrl: effectiveWebhook }, "Webhook delivered");
      await trackUsage(apiKeyId, "/v1/scan/trigger", domain, null, 200, Date.now() - start);
    } catch (err) {
      logger.error({ err, scanId, domain }, "Async scan failed");
      await trackUsage(apiKeyId, "/v1/scan/trigger", domain, null, 500, Date.now() - start);
    }
  });

  res.status(202).json({
    accepted: true,
    scanId,
    domain,
    message: "Tarama kuyruğa alındı. Sonuç webhook'a iletilecek.",
    webhookUrl: effectiveWebhook,
    estimatedCompletionMs: 30000,
  });
});

export default router;
