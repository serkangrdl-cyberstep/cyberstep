import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import {
  leadCandidatesTable,
  discoveryRunsTable,
  customerTechStackTable,
} from "@workspace/db";
import {
  eq, desc, sql, and, count, isNull, isNotNull, asc,
} from "drizzle-orm";
import { requireAdmin } from "./middleware";
import { scanCRTSH } from "../../services/crtshScanner";
import { scanShodanFree, SHODAN_FREE_QUERIES } from "../../services/shodanDiscovery";
import { runFullDiscoveryAndQualify, qualifyPendingCandidates } from "../../services/discoveryPipeline";
import { generateLeadTeaserEmail } from "../../services/leadTeaserEmail";
import { whoisLookup } from "../../services/whoisService";
import { scrapeContactEmail } from "../../services/webContactScraper";
import { logger } from "../../lib/logger";
import { enrichLeadFromTrSources } from "../../services/leadDiscovery/trSourcesEnrichment";
import { enrichLeadFromWeb } from "../../services/leadDiscovery/webContentEnrichment";

const router = Router();

// ─── GET /api/admin-panel/lead-discovery/stats ───────────────────────────────
router.get("/admin-panel/lead-discovery/stats", requireAdmin, async (_req: Request, res: Response) => {
  const [total] = await db.select({ count: count() }).from(leadCandidatesTable);
  const [scanned] = await db.select({ count: count() }).from(leadCandidatesTable)
    .where(eq(leadCandidatesTable.scanStatus, "scanned"));
  const [qualified] = await db.select({ count: count() }).from(leadCandidatesTable)
    .where(eq(leadCandidatesTable.isQualified, true));
  const [withContact] = await db.select({ count: count() }).from(leadCandidatesTable)
    .where(and(eq(leadCandidatesTable.isQualified, true), isNotNull(leadCandidatesTable.contactEmail)));
  const [teaserReady] = await db.select({ count: count() }).from(leadCandidatesTable)
    .where(and(isNotNull(leadCandidatesTable.teaserSubject), isNull(leadCandidatesTable.teaserSentAt)));
  const [teaserSent] = await db.select({ count: count() }).from(leadCandidatesTable)
    .where(isNotNull(leadCandidatesTable.teaserSentAt));
  const [pending] = await db.select({ count: count() }).from(leadCandidatesTable)
    .where(eq(leadCandidatesTable.scanStatus, "pending"));
  const [scanning] = await db.select({ count: count() }).from(leadCandidatesTable)
    .where(eq(leadCandidatesTable.scanStatus, "scanning"));

  // Source breakdown
  const bySource = await db.select({
    source: leadCandidatesTable.source,
    count: count(),
  }).from(leadCandidatesTable).groupBy(leadCandidatesTable.source);

  res.json({
    total: total?.count ?? 0,
    pending: pending?.count ?? 0,
    scanning: scanning?.count ?? 0,
    scanned: scanned?.count ?? 0,
    qualified: qualified?.count ?? 0,
    withContact: withContact?.count ?? 0,
    teaserReady: teaserReady?.count ?? 0,
    teaserSent: teaserSent?.count ?? 0,
    bySource,
  });
});

// ─── GET /api/admin-panel/lead-discovery/runs ────────────────────────────────
router.get("/admin-panel/lead-discovery/runs", requireAdmin, async (req: Request, res: Response) => {
  const limit = parseInt(req.query["limit"] as string ?? "20");
  const runs = await db.select().from(discoveryRunsTable)
    .orderBy(desc(discoveryRunsTable.startedAt))
    .limit(limit);
  res.json(runs);
});

// ─── POST /api/admin-panel/lead-discovery/crtsh ──────────────────────────────
router.post("/admin-panel/lead-discovery/crtsh", requireAdmin, async (req: Request, res: Response) => {
  const { query = "%.com.tr", daysBack = 30, minCorporateScore = 10, limit = 300 } =
    req.body as { query?: string; daysBack?: number; minCorporateScore?: number; limit?: number };

  res.json({ message: "crt.sh taraması başlatıldı", query });

  setImmediate(async () => {
    try {
      const result = await scanCRTSH(query, { daysBack, minCorporateScore, limit });
      logger.info(result, "crt.sh taraması tamamlandı");
    } catch (e) {
      logger.error({ err: String(e) }, "crt.sh taraması başarısız");
    }
  });
});

// ─── GET /api/admin-panel/lead-discovery/shodan/queries ──────────────────────
router.get("/admin-panel/lead-discovery/shodan/queries", requireAdmin, (_req: Request, res: Response) => {
  res.json(SHODAN_FREE_QUERIES.map((q, i) => ({ index: i, ...q })));
});

// ─── POST /api/admin-panel/lead-discovery/shodan ─────────────────────────────
router.post("/admin-panel/lead-discovery/shodan", requireAdmin, async (req: Request, res: Response) => {
  const { queryIndex = 0, maxResults = 100 } =
    req.body as { queryIndex?: number; maxResults?: number };

  if (!process.env["SHODAN_API_KEY"]) {
    res.status(400).json({ error: "SHODAN_API_KEY bulunamadı. Replit Secrets'e ekleyin." });
    return;
  }

  const q = SHODAN_FREE_QUERIES[queryIndex];
  res.json({ message: "Shodan taraması başlatıldı", label: q?.label });

  setImmediate(async () => {
    try {
      const result = await scanShodanFree(queryIndex, maxResults);
      logger.info(result, "Shodan taraması tamamlandı");
    } catch (e) {
      logger.error({ err: String(e) }, "Shodan taraması başarısız");
    }
  });
});

// ─── POST /api/admin-panel/lead-discovery/ripe-dns ───────────────────────────
router.post("/admin-panel/lead-discovery/ripe-dns", requireAdmin, async (req: Request, res: Response) => {
  const { maxPrefixes = 60 } = req.body as { maxPrefixes?: number };
  res.json({ message: "RIPE DNS keşfi başlatıldı", maxPrefixes });
  setImmediate(async () => {
    try {
      const { runRipeDiscovery } = await import("../../services/ripeDiscovery");
      const result = await runRipeDiscovery({ maxPrefixes });
      logger.info(result, "RIPE DNS keşfi tamamlandı");
    } catch (e) {
      logger.error({ err: String(e) }, "RIPE DNS keşfi başarısız");
    }
  });
});

// ─── POST /api/admin-panel/lead-discovery/full ───────────────────────────────
router.post("/admin-panel/lead-discovery/full", requireAdmin, async (req: Request, res: Response) => {
  const {
    useCrtsh = true,
    useShodan = true,
    autoQualify = true,
    maxDomains = 200,
    qualifyLimit = 20,
    crtshQueries,
    shodanQueryIndexes,
  } = req.body as {
    useCrtsh?: boolean;
    useShodan?: boolean;
    autoQualify?: boolean;
    maxDomains?: number;
    qualifyLimit?: number;
    crtshQueries?: string[];
    shodanQueryIndexes?: number[];
  };

  res.json({ message: "Tam pipeline başlatıldı. Bu işlem 2-3 saat sürebilir." });

  setImmediate(async () => {
    try {
      await runFullDiscoveryAndQualify({
        useCrtsh, useShodan, autoQualify, maxDomains, qualifyLimit,
        crtshQueries, shodanQueryIndexes,
      });
    } catch (e) {
      logger.error({ err: String(e) }, "Pipeline başarısız");
    }
  });
});

// ─── POST /api/admin-panel/lead-discovery/qualify ────────────────────────────
router.post("/admin-panel/lead-discovery/qualify", requireAdmin, async (req: Request, res: Response) => {
  const { limit = 20 } = req.body as { limit?: number };
  res.json({ message: `${limit} aday kalifikasyonu başlatıldı.` });
  setImmediate(async () => {
    try {
      await qualifyPendingCandidates(limit);
    } catch (e) {
      logger.error({ err: String(e) }, "Kalifikasyon başarısız");
    }
  });
});

// ─── GET /api/admin-panel/lead-discovery/qualified ───────────────────────────
router.get("/admin-panel/lead-discovery/qualified", requireAdmin, async (req: Request, res: Response) => {
  const minScore = parseInt(req.query["minScore"] as string ?? "0");
  const hasContact = req.query["hasContact"] === "true";
  const notSent = req.query["notSent"] === "true";
  const page = parseInt(req.query["page"] as string ?? "1");
  const pageSize = parseInt(req.query["pageSize"] as string ?? "20");

  const conditions = [eq(leadCandidatesTable.isQualified, true)];
  if (minScore > 0) conditions.push(sql`${leadCandidatesTable.riskScore} >= ${minScore}`);
  if (hasContact) conditions.push(isNotNull(leadCandidatesTable.contactEmail));
  if (notSent) conditions.push(isNull(leadCandidatesTable.teaserSentAt));

  const rows = await db.select().from(leadCandidatesTable)
    .where(and(...conditions))
    .orderBy(desc(leadCandidatesTable.riskScore))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [{ total }] = await db.select({ total: count() }).from(leadCandidatesTable)
    .where(and(...conditions));

  res.json({ rows, total, page, pageSize });
});

// ─── GET /api/admin-panel/lead-discovery/candidates ──────────────────────────
router.get("/admin-panel/lead-discovery/candidates", requireAdmin, async (req: Request, res: Response) => {
  const status = req.query["status"] as string | undefined;
  const page = parseInt(req.query["page"] as string ?? "1");
  const pageSize = parseInt(req.query["pageSize"] as string ?? "50");

  const conditions = status ? [eq(leadCandidatesTable.scanStatus, status)] : [];

  const rows = await db.select().from(leadCandidatesTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(leadCandidatesTable.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [{ total }] = await db.select({ total: count() }).from(leadCandidatesTable)
    .where(conditions.length ? and(...conditions) : undefined);

  res.json({ rows, total, page, pageSize });
});

// ─── PATCH /api/admin-panel/lead-discovery/candidates/:id/contact ────────────
router.patch("/admin-panel/lead-discovery/candidates/:id/contact", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const { contactEmail, contactName, contactTitle } = req.body as {
    contactEmail?: string; contactName?: string; contactTitle?: string;
  };
  if (!contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    res.status(400).json({ error: "Geçerli bir e-posta adresi gerekli." }); return;
  }
  const [candidate] = await db.select().from(leadCandidatesTable).where(eq(leadCandidatesTable.id, id));
  if (!candidate) { res.status(404).json({ error: "Aday bulunamadı" }); return; }

  await db.update(leadCandidatesTable).set({
    contactEmail: contactEmail.trim(),
    contactName: contactName?.trim() || null,
    contactTitle: contactTitle?.trim() || null,
    contactSource: "manual",
    updatedAt: new Date(),
  }).where(eq(leadCandidatesTable.id, id));

  res.json({ message: "Kontak bilgisi güncellendi." });
});

// ─── PATCH /api/admin-panel/lead-discovery/candidates/:id/isr-notes ──────────
router.patch("/admin-panel/lead-discovery/candidates/:id/isr-notes", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const { isrNotes } = req.body as { isrNotes?: string };
  const [candidate] = await db.select().from(leadCandidatesTable).where(eq(leadCandidatesTable.id, id));
  if (!candidate) { res.status(404).json({ error: "Aday bulunamadı" }); return; }
  await db.update(leadCandidatesTable).set({
    isrNotes: typeof isrNotes === "string" ? isrNotes.trim() || null : null,
    updatedAt: new Date(),
  }).where(eq(leadCandidatesTable.id, id));
  res.json({ message: "ISR notları güncellendi." });
});

// ─── POST /api/admin-panel/lead-discovery/web-enrich (batch) ─────────────────
router.post("/admin-panel/lead-discovery/web-enrich", requireAdmin, async (req: Request, res: Response) => {
  const { limit = 30 } = req.body as { limit?: number };
  const leads = await db.select({ id: leadCandidatesTable.id, domain: leadCandidatesTable.domain })
    .from(leadCandidatesTable)
    .where(eq(leadCandidatesTable.isQualified, true))
    .limit(limit);

  res.json({ message: `${leads.length} lead için web enrichment başlatıldı.`, count: leads.length });

  setImmediate(async () => {
    for (const lead of leads) {
      try {
        await enrichLeadFromWeb(lead.id, lead.domain);
        await new Promise((r) => setTimeout(r, 1500));
      } catch (e) {
        logger.warn({ id: lead.id, domain: lead.domain, err: String(e) }, "Batch web enrich hata");
      }
    }
    logger.info({ count: leads.length }, "Batch web enrich tamamlandı");
  });
});

// ─── POST /api/admin-panel/lead-discovery/candidates/:id/web-enrich ──────────
router.post("/admin-panel/lead-discovery/candidates/:id/web-enrich", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const [candidate] = await db.select().from(leadCandidatesTable).where(eq(leadCandidatesTable.id, id));
  if (!candidate) { res.status(404).json({ error: "Aday bulunamadı" }); return; }

  res.json({ message: "Web enrichment başlatıldı." });

  setImmediate(async () => {
    try {
      await enrichLeadFromWeb(id, candidate.domain);
      logger.info({ id, domain: candidate.domain }, "Tek lead web enrich tamamlandı");
    } catch (e) {
      logger.error({ id, err: String(e) }, "Tek lead web enrich başarısız");
    }
  });
});

// ─── POST /api/admin-panel/lead-discovery/candidates/:id/re-enrich ────────────
router.post("/admin-panel/lead-discovery/candidates/:id/re-enrich", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const [candidate] = await db.select().from(leadCandidatesTable).where(eq(leadCandidatesTable.id, id));
  if (!candidate) { res.status(404).json({ error: "Aday bulunamadı" }); return; }

  res.json({ message: "Kontak arama başlatıldı (WHOIS + Web scraping)." });

  setImmediate(async () => {
    try {
      let contactEmail: string | null = null;
      let contactSource = "";

      // WHOIS
      const whoisEmail = await whoisLookup(candidate.domain);
      if (whoisEmail) { contactEmail = whoisEmail; contactSource = "whois"; }

      // Web scraping fallback
      if (!contactEmail) {
        const webContact = await scrapeContactEmail(candidate.domain);
        if (webContact) { contactEmail = webContact.email; contactSource = `web${webContact.sourcePath}`; }
      }

      if (contactEmail) {
        await db.update(leadCandidatesTable).set({
          contactEmail,
          contactSource,
          updatedAt: new Date(),
        }).where(eq(leadCandidatesTable.id, id));
        logger.info({ id, domain: candidate.domain, source: contactSource, email: contactEmail }, "Re-enrich kontak bulundu");
      } else {
        logger.info({ id, domain: candidate.domain }, "Re-enrich: kontak bulunamadı");
      }

      // MERSIS/KAP TR kaynaklarından yetkili adı/unvanını bul (her durumda çalışır)
      try {
        await enrichLeadFromTrSources(id, candidate.domain);
      } catch (trErr) {
        logger.debug({ id, err: String(trErr) }, "TR enrich non-fatal hata");
      }
    } catch (e) {
      logger.error({ id, err: String(e) }, "Re-enrich başarısız");
    }
  });
});

// ─── POST /api/admin-panel/lead-discovery/candidates/:id/teaser ──────────────
router.post("/admin-panel/lead-discovery/candidates/:id/teaser", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const [candidate] = await db.select().from(leadCandidatesTable).where(eq(leadCandidatesTable.id, id));
  if (!candidate) { res.status(404).json({ error: "Aday bulunamadı" }); return; }

  res.json({ message: "Teaser üretimi başlatıldı." });
  setImmediate(async () => {
    try {
      await generateLeadTeaserEmail(id, {
        overallScore: candidate.riskScore ?? 0,
        findings: (candidate.findingHighlights ?? []).map((t, i) => ({ severity: (i < 3 ? "critical" : "high") as "critical" | "high", title: t })),
      });
    } catch (e) {
      logger.error({ id, err: String(e) }, "Manuel teaser üretimi başarısız");
    }
  });
});

// ─── POST /api/admin-panel/lead-discovery/candidates/:id/send-teaser ─────────
router.post("/admin-panel/lead-discovery/candidates/:id/send-teaser", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const [candidate] = await db.select().from(leadCandidatesTable).where(eq(leadCandidatesTable.id, id));
  if (!candidate) { res.status(404).json({ error: "Aday bulunamadı" }); return; }
  if (!candidate.teaserSubject || !candidate.teaserBody) {
    res.status(400).json({ error: "Önce teaser üretilmeli." }); return;
  }
  if (!candidate.contactEmail) {
    res.status(400).json({ error: "İletişim e-postası bulunamadı." }); return;
  }

  await db.update(leadCandidatesTable).set({ teaserSentAt: new Date(), updatedAt: new Date() })
    .where(eq(leadCandidatesTable.id, id));

  res.json({ message: `Teaser ${candidate.contactEmail} adresine gönderildi olarak işaretlendi.` });
});

// ─── DELETE /api/admin-panel/lead-discovery/candidates/:id ───────────────────
router.delete("/admin-panel/lead-discovery/candidates/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  await db.delete(leadCandidatesTable).where(eq(leadCandidatesTable.id, id));
  res.json({ message: "Aday silindi." });
});

// ─── GET /api/admin-panel/lead-discovery/candidates/:id/tech-stack ───────────
router.get("/admin-panel/lead-discovery/candidates/:id/tech-stack", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const stack = await db
    .select({
      vendor: customerTechStackTable.vendor,
      category: customerTechStackTable.category,
      salesSignal: customerTechStackTable.salesSignal,
      securityRisk: customerTechStackTable.securityRisk,
    })
    .from(customerTechStackTable)
    .where(eq(customerTechStackTable.leadCandidateId, id))
    .orderBy(asc(customerTechStackTable.category));
  res.json(stack);
});

export default router;
