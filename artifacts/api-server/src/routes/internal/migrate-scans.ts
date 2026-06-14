import { Router } from "express";
import type { Request, Response } from "express";
import { db, domainScansTable } from "@workspace/db";
import { inArray } from "drizzle-orm";
import { logger } from "../../lib/logger";

const router = Router();

// ─── POST /api/internal/migrate-domain-scans ─────────────────────────────────
// Dev DB'deki domain tarama sonuçlarını prod DB'ye aktarır.
// Yalnızca prod'da henüz bulunmayan domain'leri ekler (çakışma yok).
// BRIDGE_SECRET ile korunur.
router.post("/internal/migrate-domain-scans", async (req: Request, res: Response) => {
  const { scans, secret } = req.body as { scans?: unknown[]; secret?: string };

  if (!secret || secret !== process.env["BRIDGE_SECRET"]) {
    res.status(403).json({ error: "Yetkisiz" });
    return;
  }

  if (!Array.isArray(scans) || scans.length === 0) {
    res.status(400).json({ error: "scans dizisi gerekli" });
    return;
  }

  // Gelen batch'teki domain listesi
  const incomingDomains = (scans as Array<Record<string, unknown>>)
    .map(s => String(s["domain"] ?? ""))
    .filter(Boolean);

  if (incomingDomains.length === 0) {
    res.json({ inserted: 0, skipped: 0 });
    return;
  }

  // Bu domain'lerden hangisi prod'da zaten var?
  const existing = await db
    .select({ domain: domainScansTable.domain })
    .from(domainScansTable)
    .where(inArray(domainScansTable.domain, incomingDomains));

  const existingSet = new Set(existing.map(r => r.domain));

  type FullInsert = typeof domainScansTable.$inferInsert;

  const toInsert: FullInsert[] = (scans as Array<Record<string, unknown>>)
    .filter(s => !existingSet.has(String(s["domain"] ?? "")))
    .map(s => {
      // id olmadan tüm alanları geç; created_at'ı orijinal değerle koru
      const { id: _id, ...rest } = s;
      return rest as unknown as FullInsert;
    });

  let inserted = 0;
  let skipped = scans.length - toInsert.length;

  if (toInsert.length > 0) {
    // 50'şer batch ile insert et
    const CHUNK = 50;
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const chunk = toInsert.slice(i, i + CHUNK);
      await db.insert(domainScansTable).values(chunk);
      inserted += chunk.length;
    }
  }

  logger.info({ inserted, skipped, total: scans.length }, "Domain scan migration batch complete");
  res.json({ inserted, skipped, total: scans.length });
});

export default router;
