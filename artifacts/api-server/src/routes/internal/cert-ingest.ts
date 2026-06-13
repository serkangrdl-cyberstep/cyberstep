import { Router } from "express";
import type { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { db } from "@workspace/db";
import { leadCandidatesTable, discoveryRunsTable } from "@workspace/db";
import { logger } from "../../lib/logger";

const router = Router();

const ingestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Rate limit exceeded" },
});

// ─── POST /api/internal/cert-ingest ──────────────────────────────────────────
// GitHub Actions Certstream bridge gelen domain listesini alır, lead_candidates'e ekler.
// BRIDGE_SECRET ile korunur — admin auth gerektirmez.
router.post("/internal/cert-ingest", ingestLimiter, async (req: Request, res: Response) => {
  const { domains, secret, source } = req.body as {
    domains?: unknown;
    secret?: unknown;
    source?: unknown;
  };

  const bridgeSecret = process.env["BRIDGE_SECRET"];
  if (!bridgeSecret || secret !== bridgeSecret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!Array.isArray(domains) || typeof source !== "string" || source.length === 0) {
    res.status(400).json({ error: "domains (array) and source (string) are required" });
    return;
  }

  const domainList = (domains as unknown[])
    .filter((d): d is string => typeof d === "string" && d.length > 4 && d.length < 256)
    .map((d) => d.toLowerCase().trim())
    .filter((d) => d.includes("."))
    .slice(0, 1000);

  if (domainList.length === 0) {
    res.json({ accepted: 0, skipped: 0 });
    return;
  }

  const src = source.slice(0, 50);
  let accepted = 0;

  const CHUNK = 100;
  for (let i = 0; i < domainList.length; i += CHUNK) {
    const chunk = domainList.slice(i, i + CHUNK);
    const inserted = await db.insert(leadCandidatesTable)
      .values(chunk.map((domain) => ({
        domain,
        source: src,
        scanStatus: "pending" as const,
        tier: "tier3" as const,
      })))
      .onConflictDoNothing()
      .returning({ id: leadCandidatesTable.id })
      .catch(() => [] as { id: number }[]);
    accepted += inserted.length;
  }

  const skipped = domainList.length - accepted;

  await db.insert(discoveryRunsTable).values({
    source: src,
    runParams: { domainsReceived: domainList.length },
    status: "completed",
    totalFound: domainList.length,
    totalAdded: accepted,
    completedAt: new Date(),
  }).catch((e) => logger.warn({ e }, "cert-ingest: discovery_runs insert failed"));

  logger.info({ source: src, total: domainList.length, accepted, skipped }, "cert-ingest: batch processed");
  res.json({ accepted, skipped });
});

export default router;
