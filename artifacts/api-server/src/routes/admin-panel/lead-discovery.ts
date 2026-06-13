import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import {
  leadCandidatesTable,
  discoveryRunsTable,
  customerTechStackTable,
  ispPartnersTable,
  domainScansTable,
} from "@workspace/db";
import {
  eq, desc, sql, and, count, isNull, isNotNull, asc, ilike, or, inArray,
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

// ─── ISP tabloları oluştur / migrate et (startup'ta çağrılır) ────────────────
export async function ensureIspTables() {
  await db.execute(sql`ALTER TABLE lead_candidates ADD COLUMN IF NOT EXISTS isp_organization TEXT`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_lead_candidates_isp ON lead_candidates(isp_organization)`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS isp_partners (
      id SERIAL PRIMARY KEY,
      organization_name_pattern TEXT NOT NULL,
      partner_name VARCHAR(255) NOT NULL,
      partner_contact VARCHAR(255),
      is_active_partnership BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_isp_partners_pattern ON isp_partners(organization_name_pattern)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_isp_partners_name ON isp_partners(partner_name)`);

  // Seed yalnızca tablo boşsa
  const { rows } = await db.execute<{ c: string }>(sql`SELECT COUNT(*) AS c FROM isp_partners`);
  if (parseInt(rows[0]?.c ?? "0") === 0) {
    const seeds: [string, string][] = [
      ["%Turk Telekomunikasyon%", "Türk Telekom"],
      ["%TTNet%", "Türk Telekom"],
      ["%TT Teknoloji%", "Türk Telekom"],
      ["%Turk Telecom%", "Türk Telekom"],
      ["%Superonline Iletisim%", "Turkcell Superonline"],
      ["%Superonline%", "Turkcell Superonline"],
      ["%Turkcell Superonline%", "Turkcell Superonline"],
      ["%Vodafone Net%", "Vodafone"],
      ["%Vodafone Telekomunikasyon%", "Vodafone"],
      ["%Vodafone TR%", "Vodafone"],
      ["%TURKNET%", "TurkNet"],
      ["%Turknet Iletisim%", "TurkNet"],
      ["%Turk Net%", "TurkNet"],
      ["%Fibernet%", "Fibernet"],
      ["%Millenicom%", "Millenicom"],
      ["%Radore%", "Radore Hosting"],
      ["%Natro%", "Natro"],
      ["%Doruk%", "Doruk Net"],
      ["%Fatihnet%", "Fatihnet"],
      ["%Bursanet%", "Bursanet"],
      ["%Metronet%", "Metronet"],
      ["%Hetzner%", "Hetzner Online"],
      ["%OVH%", "OVH"],
      ["%DigitalOcean%", "DigitalOcean"],
      ["%Amazon%", "AWS"],
      ["%AMAZON%", "AWS"],
      ["%Microsoft Corporation%", "Azure"],
      ["%Google LLC%", "Google Cloud"],
      ["%Cloudflare%", "Cloudflare"],
      ["%Akamai%", "Akamai"],
    ];
    for (const [pattern, name] of seeds) {
      await db.execute(sql`INSERT INTO isp_partners(organization_name_pattern, partner_name) VALUES(${pattern}, ${name}) ON CONFLICT DO NOTHING`);
    }
  }

  // Backfill mevcut lead'ler
  await db.execute(sql`
    UPDATE lead_candidates
    SET isp_organization = source_data->>'org'
    WHERE isp_organization IS NULL AND source_data->>'org' IS NOT NULL AND source_data->>'org' <> ''
  `);
}

// ─── GET /api/admin-panel/lead-discovery/stats ───────────────────────────────
router.get("/admin-panel/lead-discovery/stats", requireAdmin, async (_req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
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
  // pending = tier2 (nitelendirme bekleyen, stabil sayı) + tier3 (ön-eleme bekleyen)
  const [pendingTier2] = await db.select({ count: count() }).from(leadCandidatesTable)
    .where(and(eq(leadCandidatesTable.scanStatus, "pending"), eq(leadCandidatesTable.tier, "tier2")));
  const [pendingTier3] = await db.select({ count: count() }).from(leadCandidatesTable)
    .where(and(eq(leadCandidatesTable.scanStatus, "pending"), eq(leadCandidatesTable.tier, "tier3")));
  const [prescreening] = await db.select({ count: count() }).from(leadCandidatesTable)
    .where(eq(leadCandidatesTable.scanStatus, "prescreening"));
  const [scanning] = await db.select({ count: count() }).from(leadCandidatesTable)
    .where(eq(leadCandidatesTable.scanStatus, "scanning"));

  // Source breakdown
  const bySource = await db.select({
    source: leadCandidatesTable.source,
    count: count(),
  }).from(leadCandidatesTable).groupBy(leadCandidatesTable.source);

  res.json({
    total: total?.count ?? 0,
    pending: (pendingTier2?.count ?? 0) + (pendingTier3?.count ?? 0),
    pendingTier2: pendingTier2?.count ?? 0,
    pendingTier3: pendingTier3?.count ?? 0,
    prescreening: prescreening?.count ?? 0,
    scanning: scanning?.count ?? 0,
    scanned: scanned?.count ?? 0,
    qualified: qualified?.count ?? 0,
    withContact: withContact?.count ?? 0,
    teaserReady: teaserReady?.count ?? 0,
    teaserSent: teaserSent?.count ?? 0,
    bySource,
  });
});

// ─── GET /api/admin-panel/lead-discovery/certstream/status ──────────────────
// GitHub Actions Certstream bridge istatistikleri — discovery_runs tablosundan
router.get("/admin-panel/lead-discovery/certstream/status", requireAdmin, async (_req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  const BRIDGE_SOURCES = ["ct_discovery", "certstream", "bgptools", "bgp_tools", "bgptools-bridge", "certstream-bridge"];

  const recentRuns = await db.select({
    id: discoveryRunsTable.id,
    source: discoveryRunsTable.source,
    status: discoveryRunsTable.status,
    totalFound: discoveryRunsTable.totalFound,
    totalAdded: discoveryRunsTable.totalAdded,
    startedAt: discoveryRunsTable.startedAt,
    completedAt: discoveryRunsTable.completedAt,
  }).from(discoveryRunsTable)
    .where(inArray(discoveryRunsTable.source, BRIDGE_SOURCES))
    .orderBy(desc(discoveryRunsTable.startedAt))
    .limit(20);

  const [ctTotal] = await db.select({ count: count() }).from(leadCandidatesTable)
    .where(inArray(leadCandidatesTable.source, BRIDGE_SOURCES));

  const lastRun = recentRuns[0] ?? null;
  const last24h = recentRuns.filter(r => r.startedAt && (Date.now() - new Date(r.startedAt).getTime()) < 86_400_000);
  const totalAdded24h = last24h.reduce((s, r) => s + r.totalAdded, 0);
  const totalFound24h = last24h.reduce((s, r) => s + r.totalFound, 0);
  const totalAddedAll = recentRuns.reduce((s, r) => s + r.totalAdded, 0);

  res.json({
    bridgeActive: lastRun != null && lastRun.startedAt != null &&
      (Date.now() - new Date(lastRun.startedAt).getTime()) < 2 * 60 * 60 * 1000,
    lastRunAt: lastRun?.startedAt ?? null,
    lastRunSource: lastRun?.source ?? null,
    lastRunAdded: lastRun?.totalAdded ?? 0,
    lastRunFound: lastRun?.totalFound ?? 0,
    totalLeads: ctTotal?.count ?? 0,
    totalAdded24h,
    totalFound24h,
    runs24h: last24h.length,
    recentRuns: recentRuns.slice(0, 10),
  });
});

// ─── POST /api/admin-panel/lead-discovery/certstream/dispatch ────────────────
router.post("/admin-panel/lead-discovery/certstream/dispatch", requireAdmin, async (_req: Request, res: Response) => {
  const pat = process.env["GITHUB_PAT"];
  if (!pat) { res.status(503).json({ error: "GITHUB_PAT eksik — dispatch yapılamıyor" }); return; }

  const { default: https } = await import("https");
  await new Promise<void>((resolve) => {
    const body = JSON.stringify({ ref: "main" });
    const req2 = https.request({
      hostname: "api.github.com",
      path: "/repos/serkangrdl-cyberstep/cyberstep/actions/workflows/certstream-bridge.yml/dispatches",
      method: "POST",
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "CyberStep-Server",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    }, (r) => {
      r.resume();
      if (r.statusCode === 204) {
        logger.info("Certstream dispatch manual tetiklendi");
      } else {
        logger.warn({ status: r.statusCode }, "Certstream dispatch başarısız");
      }
      resolve();
    });
    req2.on("error", (e) => { logger.warn({ err: String(e) }, "Certstream dispatch hata"); resolve(); });
    req2.write(body);
    req2.end();
  });
  res.json({ ok: true, message: "GitHub Actions dispatch tetiklendi" });
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
  const { maxPrefixes = 60 } = (req.body ?? {}) as { maxPrefixes?: number };
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
  const { limit = 20 } = (req.body ?? {}) as { limit?: number };
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

  // WAF rozeti için domain_scans'tan wafDetected + confidenceScore batch yükle
  const scanIds = rows.map((r) => r.scanId).filter((id): id is number => id !== null);
  const wafMap = new Map<number, { wafDetected: boolean | null; confidenceScore: number | null }>();
  if (scanIds.length > 0) {
    const wafRows = await db.select({
      id: domainScansTable.id,
      wafDetected: domainScansTable.wafDetected,
      confidenceScore: domainScansTable.confidenceScore,
    }).from(domainScansTable).where(inArray(domainScansTable.id, scanIds));
    for (const r of wafRows) wafMap.set(r.id, { wafDetected: r.wafDetected, confidenceScore: r.confidenceScore });
  }
  const enrichedRows = rows.map((r) => ({
    ...r,
    wafDetected: r.scanId ? (wafMap.get(r.scanId)?.wafDetected ?? null) : null,
    confidenceScore: r.scanId ? (wafMap.get(r.scanId)?.confidenceScore ?? null) : null,
  }));

  res.json({ rows: enrichedRows, total, page, pageSize });
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
  const { limit = 30 } = (req.body ?? {}) as { limit?: number };
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

// ─── GET /api/admin-panel/lead-discovery/isp-groups ──────────────────────────
// Kalifikasyonu geçmiş lead'leri normalize edilmiş ISP adına göre gruplar
router.get("/admin-panel/lead-discovery/isp-groups", requireAdmin, async (_req: Request, res: Response) => {
  // Tüm isp_partners pattern'lerini çek
  const partners = await db.select().from(ispPartnersTable).orderBy(asc(ispPartnersTable.partnerName));

  // Qualify'lı lead'leri isp_organization ile çek
  const leads = await db.select({
    id: leadCandidatesTable.id,
    domain: leadCandidatesTable.domain,
    companyName: leadCandidatesTable.companyName,
    riskScore: leadCandidatesTable.riskScore,
    criticalFindings: leadCandidatesTable.criticalFindings,
    ispOrganization: leadCandidatesTable.ispOrganization,
    contactEmail: leadCandidatesTable.contactEmail,
    teaserSentAt: leadCandidatesTable.teaserSentAt,
    lastScannedAt: leadCandidatesTable.lastScannedAt,
    tier: leadCandidatesTable.tier,
  }).from(leadCandidatesTable)
    .where(and(
      eq(leadCandidatesTable.isQualified, true),
      isNotNull(leadCandidatesTable.ispOrganization),
    ))
    .orderBy(desc(leadCandidatesTable.riskScore));

  // Lead'i normalize edilmiş partner adına eşle
  function resolvePartnerName(rawOrg: string): { normalizedName: string; isActivePartnership: boolean; partnerContact: string | null } {
    for (const p of partners) {
      // ILIKE pattern: % wildcard → JS regex
      const regex = new RegExp(p.organizationNamePattern.replace(/%/g, ".*"), "i");
      if (regex.test(rawOrg)) {
        return { normalizedName: p.partnerName, isActivePartnership: p.isActivePartnership, partnerContact: p.partnerContact };
      }
    }
    return { normalizedName: rawOrg, isActivePartnership: false, partnerContact: null };
  }

  // Gruplama
  const groups: Record<string, {
    normalizedName: string;
    isActivePartnership: boolean;
    partnerContact: string | null;
    count: number;
    avgRiskScore: number;
    criticalFindingsTotal: number;
    lastScannedAt: Date | null;
    leads: typeof leads;
  }> = {};

  for (const lead of leads) {
    const raw = lead.ispOrganization ?? "Bilinmiyor";
    const { normalizedName, isActivePartnership, partnerContact } = resolvePartnerName(raw);
    if (!groups[normalizedName]) {
      groups[normalizedName] = {
        normalizedName,
        isActivePartnership,
        partnerContact,
        count: 0,
        avgRiskScore: 0,
        criticalFindingsTotal: 0,
        lastScannedAt: null,
        leads: [],
      };
    }
    const g = groups[normalizedName]!;
    g.count++;
    g.criticalFindingsTotal += lead.criticalFindings ?? 0;
    g.leads.push(lead);
    if (lead.lastScannedAt && (!g.lastScannedAt || lead.lastScannedAt > g.lastScannedAt)) {
      g.lastScannedAt = lead.lastScannedAt;
    }
  }

  // avgRiskScore hesapla
  for (const g of Object.values(groups)) {
    const scores = g.leads.map(l => l.riskScore ?? 0).filter(s => s > 0);
    g.avgRiskScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  }

  // Büyükten küçüğe lead sayısına göre sırala
  const sorted = Object.values(groups).sort((a, b) => b.count - a.count);
  res.json(sorted);
});

// ─── GET /api/admin-panel/lead-discovery/isp-partners ────────────────────────
router.get("/admin-panel/lead-discovery/isp-partners", requireAdmin, async (_req: Request, res: Response) => {
  const rows = await db.select().from(ispPartnersTable).orderBy(asc(ispPartnersTable.partnerName));
  res.json(rows);
});

// ─── POST /api/admin-panel/lead-discovery/isp-partners ───────────────────────
router.post("/admin-panel/lead-discovery/isp-partners", requireAdmin, async (req: Request, res: Response) => {
  const { organizationNamePattern, partnerName, partnerContact } = req.body as {
    organizationNamePattern: string;
    partnerName: string;
    partnerContact?: string;
  };
  if (!organizationNamePattern || !partnerName) {
    res.status(400).json({ error: "organizationNamePattern ve partnerName zorunlu." }); return;
  }
  const [row] = await db.insert(ispPartnersTable).values({
    organizationNamePattern,
    partnerName,
    partnerContact: partnerContact ?? null,
    isActivePartnership: false,
  }).returning();
  res.json(row);
});

// ─── PATCH /api/admin-panel/lead-discovery/isp-partners/:id ──────────────────
router.patch("/admin-panel/lead-discovery/isp-partners/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const { isActivePartnership, partnerContact, partnerName } = req.body as {
    isActivePartnership?: boolean;
    partnerContact?: string;
    partnerName?: string;
  };
  const updates: Partial<{ isActivePartnership: boolean; partnerContact: string; partnerName: string; updatedAt: Date }> = { updatedAt: new Date() };
  if (isActivePartnership !== undefined) updates.isActivePartnership = isActivePartnership;
  if (partnerContact !== undefined) updates.partnerContact = partnerContact;
  if (partnerName !== undefined) updates.partnerName = partnerName;
  const [row] = await db.update(ispPartnersTable).set(updates).where(eq(ispPartnersTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Bulunamadı" }); return; }
  res.json(row);
});

// ─── POST /api/admin-panel/lead-discovery/isp-backfill ───────────────────────
// Manuel tetikle: source_data->>'org' alanını isp_organization'a kopyala
router.post("/admin-panel/lead-discovery/isp-backfill", requireAdmin, async (_req: Request, res: Response) => {
  const result = await db.execute(
    sql`UPDATE lead_candidates SET isp_organization = source_data->>'org'
        WHERE isp_organization IS NULL AND source_data->>'org' IS NOT NULL AND source_data->>'org' <> ''`
  );
  res.json({ updated: result.rowCount });
});

export default router;
