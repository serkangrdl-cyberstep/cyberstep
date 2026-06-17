import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import {
  leadCandidatesTable,
  discoveryRunsTable,
  customerTechStackTable,
  ispPartnersTable,
  domainScansTable,
  isrCustomersTable,
  isrDealsTable,
} from "@workspace/db";
import {
  eq, desc, sql, and, count, isNull, isNotNull, asc, ilike, or, inArray,
} from "drizzle-orm";
import { requireAdmin } from "./middleware";
import { scanCRTSH } from "../../services/crtshScanner";
import { scanShodanFree, SHODAN_FREE_QUERIES } from "../../services/shodanDiscovery";
import { runFullDiscoveryAndQualify, qualifyPendingCandidates, preScreenPendingCandidates } from "../../services/discoveryPipeline";
import { generateLeadTeaserEmail } from "../../services/leadTeaserEmail";
import { whoisLookup } from "../../services/whoisService";
import { scrapeContactEmail } from "../../services/webContactScraper";
import { logger } from "../../lib/logger";
import { enrichLeadFromTrSources } from "../../services/leadDiscovery/trSourcesEnrichment";
import { enrichLeadFromWeb } from "../../services/leadDiscovery/webContentEnrichment";
import { sendMail } from "../../services/email";
import { buildTeaserEmailHtml, buildDealNotificationHtml } from "../../lib/email-templates/isrEmails";
import { getIsrEmail, getIsrBaseUrl } from "../../lib/isr/teamConfig";

function requireTenantId(req: Request, res: Response): number | null {
  const tid = (req.session as unknown as Record<string, unknown>)["tenantId"] as number | undefined;
  if (!tid) { res.status(403).json({ error: "Workspace seçilmedi", code: "NO_TENANT" }); return null; }
  return tid;
}

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
  // "ct_discovery" artık crt.sh scanner'ı tarafından kullanılıyor (certstream-bridge.yml → "certstream-bridge" kaynağına geçildi)
  // Bu listeye dahil edilmez; yalnızca gerçek certstream bridge ve BGP bridge kaynakları sayılır.
  const BRIDGE_SOURCES = ["certstream-bridge", "certstream", "bgptools-bridge", "bgp_tools", "bgptools"];

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

  const replitDomains = (process.env["REPLIT_DOMAINS"] ?? "").split(",").map(d => d.trim()).filter(Boolean);
  const primaryDomain = replitDomains[0] ?? "cyberstep.io";
  const ingestUrl = `https://${primaryDomain}/api/internal/cert-ingest`;

  const { dispatchWorkflow, watchRunInBackground } = await import("../../services/githubActionsHelper");
  const repo = "serkangrdl-cyberstep/CyberStep";
  const workflowId = "certstream-bridge.yml";
  const dispatchedAt = new Date();

  const result = await dispatchWorkflow({
    pat,
    repo,
    workflowId,
    inputs: { ingest_url: ingestUrl },
  });

  if (!result.dispatched) {
    logger.warn({ status: result.httpStatus }, "Certstream dispatch başarısız");
    res.status(502).json({ ok: false, error: `GitHub API ${result.httpStatus} döndürdü` });
    return;
  }

  logger.info({ trigger: "manual" }, "Certstream dispatch manual tetiklendi — run izleniyor");
  watchRunInBackground({ pat, repo, workflowId, dispatchedAt, logContext: { trigger: "manual" } });

  res.json({ ok: true, message: "GitHub Actions dispatch tetiklendi — run sonucu sunucu loglarına yazılacak" });
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

// ─── POST /api/admin-panel/lead-discovery/prescreen ─────────────────────────
router.post("/admin-panel/lead-discovery/prescreen", requireAdmin, async (req: Request, res: Response) => {
  const { limit = 500 } = (req.body ?? {}) as { limit?: number };
  res.json({ message: `${limit} aday ön-eleme başlatıldı.` });
  setImmediate(async () => {
    try {
      const result = await preScreenPendingCandidates(limit);
      logger.info({ result }, "Manuel ön-eleme tamamlandı");
    } catch (e) {
      logger.error({ err: String(e) }, "Ön-eleme başarısız");
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

// ─── POST /api/admin-panel/lead-discovery/reset-stale-qualified ───────────────
// 48 saatten önce qualify edilmiş leadleri (WAF/CDN kontrolü öncesi false pozitifler)
// pending+tier2+is_qualified=false olarak sıfırla; bir sonraki qualify batch'i onları tekrar değerlendirir.
router.post("/admin-panel/lead-discovery/reset-stale-qualified", requireAdmin, async (req: Request, res: Response) => {
  const { hoursAgo = 48 } = (req.body ?? {}) as { hoursAgo?: number };
  const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

  const result = await db.execute(sql`
    UPDATE lead_candidates
    SET
      scan_status   = 'pending',
      tier          = 'tier2',
      is_qualified  = false,
      scan_id       = NULL,
      risk_score    = NULL,
      critical_findings = 0,
      finding_highlights = NULL,
      last_scanned_at = NULL,
      updated_at    = NOW()
    WHERE
      is_qualified = true
      AND scan_status = 'scanned'
      AND (last_scanned_at < ${cutoff} OR last_scanned_at IS NULL)
  `);

  const resetCount = result.rowCount ?? 0;
  req.log.info({ resetCount, hoursAgo }, "Eski qualified leadler yeniden kalifikasyona sokuldu");
  res.json({ reset: resetCount, message: `${resetCount} lead sıfırlandı — şimdi Kalifikasyonu Çalıştır butonuyla batch batch işleyin.` });
});

// ─── GET /api/admin-panel/lead-discovery/qualified ───────────────────────────
router.get("/admin-panel/lead-discovery/qualified", requireAdmin, async (req: Request, res: Response) => {
  const minScore    = parseInt(req.query["minScore"] as string ?? "0");
  const hasContact  = req.query["hasContact"]  === "true";
  const noContact   = req.query["noContact"]   === "true";
  const notSent     = req.query["notSent"]     === "true";
  const hasTeaser   = req.query["hasTeaser"]   === "true";
  const teaserSent  = req.query["teaserSent"]  === "true";
  const criticalPort = req.query["criticalPort"] === "true";
  const tier        = req.query["tier"] as string | undefined;
  const source      = req.query["source"] as string | undefined;
  const search      = (req.query["search"] as string ?? "").trim().toLowerCase();
  const sortBy      = (req.query["sortBy"] as string) || "risk_desc";
  const municipality = req.query["municipality"] as string | undefined; // "only" | "exclude" | undefined
  const page        = Math.max(1, parseInt(req.query["page"] as string ?? "1"));
  const pageSize    = Math.min(100, Math.max(10, parseInt(req.query["pageSize"] as string ?? "50")));

  const conditions: ReturnType<typeof sql | typeof eq | typeof isNotNull | typeof isNull>[] = [
    eq(leadCandidatesTable.isQualified, true),
  ];
  if (minScore > 0)   conditions.push(sql`${leadCandidatesTable.riskScore} >= ${minScore}`);
  if (hasContact)     conditions.push(isNotNull(leadCandidatesTable.contactEmail));
  if (noContact)      conditions.push(isNull(leadCandidatesTable.contactEmail));
  if (notSent)        conditions.push(isNull(leadCandidatesTable.teaserSentAt));
  if (teaserSent)     conditions.push(isNotNull(leadCandidatesTable.teaserSentAt));
  if (hasTeaser)      conditions.push(isNotNull(leadCandidatesTable.teaserSubject));
  if (tier)           conditions.push(eq(leadCandidatesTable.tier, tier));
  if (source)         conditions.push(eq(leadCandidatesTable.source, source));
  if (search)         conditions.push(sql`${leadCandidatesTable.domain} ILIKE ${"%" + search + "%"}`);
  if (criticalPort)   conditions.push(sql`${leadCandidatesTable.domain} IN (
    SELECT domain FROM customer_tech_stack
    WHERE category = 'open_port' AND security_risk = 'critical' AND is_active = true
  )`);
  if (municipality === "only")    conditions.push(sql`(${leadCandidatesTable.isMunicipality} = true OR ${leadCandidatesTable.domain} LIKE '%.bel.tr')`);
  if (municipality === "exclude") conditions.push(sql`(${leadCandidatesTable.isMunicipality} = false AND ${leadCandidatesTable.domain} NOT LIKE '%.bel.tr')`);

  const orderClause =
    sortBy === "risk_asc"   ? leadCandidatesTable.riskScore :
    sortBy === "domain_asc" ? leadCandidatesTable.domain :
    sortBy === "added_desc" ? desc(leadCandidatesTable.createdAt) :
    sortBy === "added_asc"  ? leadCandidatesTable.createdAt :
    /* risk_desc default */   desc(leadCandidatesTable.riskScore);

  const [rows, [{ total }]] = await Promise.all([
    db.select().from(leadCandidatesTable)
      .where(and(...conditions))
      .orderBy(orderClause)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(leadCandidatesTable)
      .where(and(...conditions)),
  ]);

  res.json({ rows, total, page, pageSize });
});

// ─── GET /api/admin-panel/lead-discovery/candidates ──────────────────────────
router.get("/admin-panel/lead-discovery/candidates", requireAdmin, async (req: Request, res: Response) => {
  const status = req.query["status"] as string | undefined;
  const tier = req.query["tier"] as string | undefined;
  const page = parseInt(req.query["page"] as string ?? "1");
  const pageSize = parseInt(req.query["pageSize"] as string ?? "50");

  const conditions: ReturnType<typeof eq>[] = [];
  if (status) conditions.push(eq(leadCandidatesTable.scanStatus, status));
  if (tier) conditions.push(eq(leadCandidatesTable.tier, tier));

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

// ─── POST /api/admin-panel/lead-discovery/candidates/:id/promote-to-isr ──────
router.post("/admin-panel/lead-discovery/candidates/:id/promote-to-isr", requireAdmin, async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res); if (!tenantId) return;
  const id = parseInt(String(req.params["id"] ?? "0"));
  const [candidate] = await db.select().from(leadCandidatesTable).where(eq(leadCandidatesTable.id, id));
  if (!candidate) { res.status(404).json({ error: "Aday bulunamadı" }); return; }
  if (candidate.isrPromotedAt) {
    res.json({ ok: true, isrCustomerId: candidate.isrCustomerId, alreadyPromoted: true });
    return;
  }

  const companyName = candidate.scrapedCompanyName ?? candidate.companyName ?? candidate.domain;
  const [isrCustomer] = await db.insert(isrCustomersTable).values({
    tenantId,
    companyName,
    contactName: candidate.contactName ?? candidate.officerName ?? null,
    email: candidate.contactEmail ?? null,
    phone: candidate.scrapedPhone ?? null,
    sector: candidate.sector ?? null,
    notes: [
      candidate.isrNotes,
      candidate.riskScore != null ? `Risk skoru: ${candidate.riskScore}` : null,
      candidate.criticalFindings > 0 ? `Kritik bulgu: ${candidate.criticalFindings}` : null,
      candidate.findingHighlights?.length ? `Bulgular: ${candidate.findingHighlights.slice(0, 3).join("; ")}` : null,
    ].filter(Boolean).join("\n") || null,
  }).returning({ id: isrCustomersTable.id });

  await db.update(leadCandidatesTable).set({
    isrPromotedAt: new Date(),
    isrCustomerId: isrCustomer?.id ?? null,
    updatedAt: new Date(),
  }).where(eq(leadCandidatesTable.id, id));

  // Otomatik deal oluştur + ISR ekibine bildirim (fire-and-forget)
  setImmediate(async () => {
    try {
      const baseUrl = getIsrBaseUrl();
      const [newDeal] = await db.insert(isrDealsTable).values({
        tenantId,
        customerId: isrCustomer?.id ?? null,
        customerName: companyName,
        customerEmail: candidate.contactEmail ?? "",
        customerCompany: companyName,
        customerPhone: candidate.scrapedPhone ?? null,
        status: "new",
        intakeChannel: "lead_discovery",
        priority: (candidate.riskScore ?? 0) >= 70 ? "high" : "normal",
        notes: [
          `Lead skoru: ${candidate.riskScore ?? "N/A"}`,
          candidate.criticalFindings > 0 ? `Kritik bulgu: ${candidate.criticalFindings}` : null,
          "Otomatik oluşturuldu — Lead Discovery",
        ].filter(Boolean).join("\n"),
      }).returning({ id: isrDealsTable.id });

      const dealUrl = `${baseUrl}/panel/isr/deal/${newDeal?.id}`;
      const isrEmail = getIsrEmail("isr-team");
      await sendMail({
        to: isrEmail,
        subject: `Yeni Deal: ${companyName}`,
        html: buildDealNotificationHtml({
          companyName,
          domain: candidate.domain,
          contactName: candidate.contactName ?? null,
          contactEmail: candidate.contactEmail ?? null,
          riskScore: candidate.riskScore ?? null,
          criticalFindings: candidate.criticalFindings ?? 0,
          dealId: newDeal?.id ?? 0,
          dealUrl,
        }),
      });
      logger.info({ id, domain: candidate.domain, dealId: newDeal?.id }, "ISR deal oluşturuldu ve bildirim gönderildi");
    } catch (err) {
      logger.error({ err, id }, "ISR deal oluşturma/bildirim hatası");
    }
  });

  logger.info({ id, domain: candidate.domain, isrCustomerId: isrCustomer?.id }, "Lead ISR müşteri listesine eklendi");
  res.json({ ok: true, isrCustomerId: isrCustomer?.id });
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

  const html = buildTeaserEmailHtml({
    companyName: candidate.scrapedCompanyName ?? candidate.companyName ?? candidate.domain,
    contactName: candidate.contactName ?? null,
    domain: candidate.domain,
    teaserBody: candidate.teaserBody,
    riskScore: candidate.riskScore ?? null,
    criticalFindings: candidate.criticalFindings ?? 0,
  });

  setImmediate(async () => {
    try {
      await sendMail({ to: candidate.contactEmail!, subject: candidate.teaserSubject!, html });
      logger.info({ id, to: candidate.contactEmail }, "Teaser e-posta gönderildi");
    } catch (err) {
      logger.error({ err, id }, "Teaser e-posta gönderimi başarısız");
    }
  });

  await db.update(leadCandidatesTable).set({ teaserSentAt: new Date(), updatedAt: new Date() })
    .where(eq(leadCandidatesTable.id, id));

  res.json({ message: `Teaser ${candidate.contactEmail} adresine gönderiliyor.`, sentTo: candidate.contactEmail });
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
  // Fingerprintler domain bazlı kaydediliyor (leadCandidateId=null olabilir)
  // Önce candidate'in domain'ini bul, sonra domain'e göre sorgula
  const [candidate] = await db
    .select({ domain: leadCandidatesTable.domain })
    .from(leadCandidatesTable)
    .where(eq(leadCandidatesTable.id, id))
    .limit(1);
  if (!candidate) { res.json([]); return; }

  const stack = await db
    .select({
      vendor: customerTechStackTable.vendor,
      product: customerTechStackTable.product,
      category: customerTechStackTable.category,
      salesSignal: customerTechStackTable.salesSignal,
      securityRisk: customerTechStackTable.securityRisk,
      securityNote: customerTechStackTable.securityNote,
      evidence: customerTechStackTable.evidence,
    })
    .from(customerTechStackTable)
    .where(and(
      eq(customerTechStackTable.domain, candidate.domain),
      eq(customerTechStackTable.isActive, true),
    ))
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
