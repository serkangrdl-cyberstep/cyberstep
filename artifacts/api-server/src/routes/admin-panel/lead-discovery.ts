import { Router } from "express";
import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import {
  leadCandidatesTable,
  discoveryRunsTable,
  customerTechStackTable,
  ispPartnersTable,
  domainScansTable,
  isrCustomersTable,
  isrDealsTable,
  cveTrackerTable,
  cveDomainMatchesTable,
} from "@workspace/db";
import {
  eq, desc, sql, and, count, isNull, isNotNull, asc, ilike, or, inArray, gte,
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
  const correlationId = randomUUID();

  const result = await dispatchWorkflow({
    pat,
    repo,
    workflowId,
    inputs: { ingest_url: ingestUrl, correlation_id: correlationId },
  });

  if (!result.dispatched) {
    logger.warn({ status: result.httpStatus }, "Certstream dispatch başarısız");
    res.status(502).json({ ok: false, error: `GitHub API ${result.httpStatus} döndürdü` });
    return;
  }

  logger.info({ trigger: "manual", correlationId }, "Certstream dispatch manual tetiklendi — run izleniyor");
  watchRunInBackground({ pat, repo, workflowId, dispatchedAt, correlationId, logContext: { trigger: "manual" } });

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

// ─── POST /api/admin-panel/lead-discovery/requalify-all-scanned ──────────────
// Hem qualified hem de non-qualified tüm "scanned" leadleri pending+tier2'ye döndürür.
// Yeni kalifikasyon mantığı (WAF skoru, DKIM güncellemesi vb.) tüm mevcut adaylara uygulanır.
router.post("/admin-panel/lead-discovery/requalify-all-scanned", requireAdmin, async (req: Request, res: Response) => {
  const result = await db.execute(sql`
    UPDATE lead_candidates
    SET
      scan_status       = 'pending',
      tier              = 'tier2',
      is_qualified      = false,
      scan_id           = NULL,
      risk_score        = NULL,
      critical_findings = 0,
      finding_highlights = NULL,
      last_scanned_at   = NULL,
      updated_at        = NOW()
    WHERE scan_status = 'scanned'
  `);

  const resetCount = result.rowCount ?? 0;
  req.log.info({ resetCount }, "Tüm scanned leadler yeniden kalifikasyona sokuldu");
  res.json({
    reset: resetCount,
    message: `${resetCount} lead sıfırlandı — admin panelinden "Kalifikasyonu Çalıştır" (limit: 50-100) ile batch batch işleyin.`,
  });
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
  const status       = req.query["status"] as string | undefined;
  const tier         = req.query["tier"] as string | undefined;
  const hasContact   = req.query["hasContact"] === "true";
  const notSent      = req.query["notSent"]    === "true";
  const municipality = req.query["municipality"] as string | undefined; // "only" | "exclude" | undefined
  const search       = (req.query["search"] as string ?? "").trim();
  const page         = parseInt(req.query["page"] as string ?? "1");
  const pageSize     = parseInt(req.query["pageSize"] as string ?? "50");

  const conditions: ReturnType<typeof sql | typeof eq | typeof isNotNull | typeof isNull>[] = [];
  if (status) conditions.push(eq(leadCandidatesTable.scanStatus, status));
  if (tier) conditions.push(eq(leadCandidatesTable.tier, tier));
  if (hasContact) conditions.push(isNotNull(leadCandidatesTable.contactEmail));
  if (notSent)    conditions.push(isNull(leadCandidatesTable.teaserSentAt));
  if (search)     conditions.push(sql`${leadCandidatesTable.domain} ILIKE ${"%" + search + "%"}`);
  if (municipality === "only")    conditions.push(sql`(${leadCandidatesTable.isMunicipality} = true OR ${leadCandidatesTable.domain} LIKE '%.bel.tr')`);
  if (municipality === "exclude") conditions.push(sql`(${leadCandidatesTable.isMunicipality} = false AND ${leadCandidatesTable.domain} NOT LIKE '%.bel.tr')`);

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

// ─── GET /api/admin-panel/lead-discovery/export ───────────────────────────────
// Mevcut filtreleri dikkate alarak tüm lead_candidates listesini Excel olarak indir.
router.get("/admin-panel/lead-discovery/export", requireAdmin, async (req: Request, res: Response) => {
  try {
    const ExcelJS = (await import("exceljs")).default;

    const tier         = req.query["tier"] as string | undefined;
    const hasContact   = req.query["hasContact"] === "true";
    const notSent      = req.query["notSent"]    === "true";
    const municipality = req.query["municipality"] as string | undefined;
    const search       = (req.query["search"] as string ?? "").trim();

    const conditions: ReturnType<typeof sql | typeof eq | typeof isNotNull | typeof isNull>[] = [];
    if (tier)         conditions.push(eq(leadCandidatesTable.tier, tier));
    if (hasContact)   conditions.push(isNotNull(leadCandidatesTable.contactEmail));
    if (notSent)      conditions.push(isNull(leadCandidatesTable.teaserSentAt));
    if (search)       conditions.push(sql`${leadCandidatesTable.domain} ILIKE ${"%" + search + "%"}`);
    if (municipality === "only")    conditions.push(sql`(${leadCandidatesTable.isMunicipality} = true OR ${leadCandidatesTable.domain} LIKE '%.bel.tr')`);
    if (municipality === "exclude") conditions.push(sql`(${leadCandidatesTable.isMunicipality} = false AND ${leadCandidatesTable.domain} NOT LIKE '%.bel.tr')`);

    const where = conditions.length ? and(...conditions) : undefined;

    const [{ total }] = await db.select({ total: count() }).from(leadCandidatesTable).where(where);
    const totalNum = Number(total);

    if (totalNum === 0) {
      res.status(404).json({ error: "Export edilecek kayıt bulunamadı." });
      return;
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = "CyberStep.io";
    wb.created = new Date();
    const ws = wb.addWorksheet("Domains");

    ws.columns = [
      { header: "Domain",          key: "domain",      width: 32 },
      { header: "IP Adresi",       key: "ip",          width: 16 },
      { header: "Risk Skoru",      key: "riskScore",   width: 12 },
      { header: "Risk Seviyesi",   key: "riskLevel",   width: 14 },
      { header: "Durum",           key: "status",      width: 14 },
      { header: "Kayıt Tarihi",    key: "createdAt",   width: 20 },
      { header: "Son Tarama",      key: "lastScanned", width: 20 },
      { header: "Ülke",            key: "country",     width: 8  },
      { header: "Şehir",           key: "city",        width: 16 },
      { header: "Sektör",          key: "sector",      width: 18 },
      { header: "Şirket Adı",      key: "companyName", width: 26 },
      { header: "Açık Port Sayısı",key: "portCount",   width: 16 },
      { header: "CVE Sayısı",      key: "cveCount",    width: 12 },
      { header: "WAF Tespit",      key: "waf",         width: 12 },
      { header: "Kaynak",          key: "source",      width: 18 },
    ];

    // Header satırı stili
    const headerRow = ws.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0E1A2E" } };
      cell.font   = { bold: true, color: { argb: "FF00C8FF" } };
      cell.border = { bottom: { style: "thin", color: { argb: "FF00C8FF" } } };
    });
    headerRow.height = 20;
    ws.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];

    const RISK_COLORS: Record<string, string> = {
      critical: "FFFF4444",
      high:     "FFFF8C00",
      medium:   "FFF5A623",
      low:      "FF00C8FF",
    };

    function getRiskLevel(score: number | null): string {
      if (score === null || score === undefined) return "";
      if (score < 30) return "critical";
      if (score < 60) return "high";
      if (score < 80) return "medium";
      return "low";
    }

    function fmtDate(d: Date | string | null | undefined): string {
      if (!d) return "";
      const dt = d instanceof Date ? d : new Date(d as string);
      if (isNaN(dt.getTime())) return "";
      const dd   = String(dt.getDate()).padStart(2, "0");
      const mm   = String(dt.getMonth() + 1).padStart(2, "0");
      const yyyy = dt.getFullYear();
      const hh   = String(dt.getHours()).padStart(2, "0");
      const min  = String(dt.getMinutes()).padStart(2, "0");
      return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
    }

    const BATCH = 1000;
    const batches = Math.ceil(totalNum / BATCH);

    for (let b = 0; b < batches; b++) {
      const rows = await db.select({
        domain:        leadCandidatesTable.domain,
        companyName:   leadCandidatesTable.companyName,
        sector:        leadCandidatesTable.sector,
        city:          leadCandidatesTable.city,
        source:        leadCandidatesTable.source,
        scanStatus:    leadCandidatesTable.scanStatus,
        scanId:        leadCandidatesTable.scanId,
        riskScore:     leadCandidatesTable.riskScore,
        wafDetected:   leadCandidatesTable.wafDetected,
        createdAt:     leadCandidatesTable.createdAt,
        lastScannedAt: leadCandidatesTable.lastScannedAt,
      }).from(leadCandidatesTable)
        .where(where)
        .orderBy(asc(leadCandidatesTable.id))
        .limit(BATCH)
        .offset(b * BATCH);

      // Batch'teki scan_id'ler için domain_scans verisi
      const scanIds = rows.map(r => r.scanId).filter((id): id is number => id !== null);
      const scanMap = new Map<number, {
        originIp: string | null;
        openPortsCount: number | null;
        criticalCveCount: number | null;
        highCveCount: number | null;
        country: string | null;
      }>();
      if (scanIds.length > 0) {
        const scans = await db.select({
          id:              domainScansTable.id,
          originIp:        domainScansTable.originIp,
          openPortsCount:  domainScansTable.openPortsCount,
          criticalCveCount:domainScansTable.criticalCveCount,
          highCveCount:    domainScansTable.highCveCount,
          country:         domainScansTable.abuseIpdbCountry,
        }).from(domainScansTable).where(inArray(domainScansTable.id, scanIds));
        for (const s of scans) scanMap.set(s.id, s);
      }

      for (const row of rows) {
        const scan      = row.scanId ? (scanMap.get(row.scanId) ?? null) : null;
        const riskLevel = getRiskLevel(row.riskScore);
        const cveCount  = scan ? ((scan.criticalCveCount ?? 0) + (scan.highCveCount ?? 0)) : null;

        const excelRow = ws.addRow({
          domain:      row.domain,
          ip:          scan?.originIp ?? "",
          riskScore:   row.riskScore  ?? "",
          riskLevel:   riskLevel === "critical" ? "Kritik" : riskLevel === "high" ? "Yüksek" : riskLevel === "medium" ? "Orta" : riskLevel === "low" ? "Düşük" : "",
          status:      row.scanStatus ?? "",
          createdAt:   fmtDate(row.createdAt),
          lastScanned: fmtDate(row.lastScannedAt),
          country:     scan?.country ?? "",
          city:        row.city        ?? "",
          sector:      row.sector      ?? "",
          companyName: row.companyName ?? "",
          portCount:   scan?.openPortsCount ?? "",
          cveCount:    cveCount !== null ? cveCount : "",
          waf:         row.wafDetected === true ? "Evet" : row.wafDetected === false ? "Hayır" : "",
          source:      row.source ?? "",
        });
        excelRow.height = 18;

        // Risk seviyesi hücresini renklendir
        if (riskLevel && RISK_COLORS[riskLevel]) {
          const cell = excelRow.getCell("riskLevel");
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: RISK_COLORS[riskLevel]! } };
          cell.font = { bold: true, color: { argb: "FF0E1A2E" } };
        }
      }
    }

    const today  = new Date().toISOString().slice(0, 10);
    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="cyberstep_domains_${today}.xlsx"`);
    res.setHeader("X-Total-Count", String(totalNum));
    res.send(Buffer.from(buffer));
    logger.info({ totalNum, tier, search, municipality }, "Domain Excel export tamamlandı");
  } catch (err) {
    logger.error({ err }, "Domain Excel export hatası");
    res.status(500).json({ error: "Export sırasında hata oluştu." });
  }
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

// ─── POST /api/admin-panel/lead-discovery/bulk-import-pdf ────────────────────
// PDF listesinden toplu domain import — body: { domains: [...] }
// ON CONFLICT (domain) DO NOTHING — idempotent, tekrar çalıştırılabilir
router.post("/admin-panel/lead-discovery/bulk-import-pdf", requireAdmin, async (req: Request, res: Response) => {
  const { domains } = req.body as {
    domains: Array<{ domain: string; industry: string; revenueUsd: number; employeeRange: string }>;
  };
  if (!Array.isArray(domains) || domains.length === 0) {
    res.status(400).json({ error: "domains array gerekli" });
    return;
  }

  let inserted = 0;
  let skipped = 0;
  const CHUNK = 50;

  for (let i = 0; i < domains.length; i += CHUNK) {
    const chunk = domains.slice(i, i + CHUNK);
    const e = (s: string) => s.replace(/'/g, "''");
    const result = await db.execute(sql`
      INSERT INTO lead_candidates (domain, sector, source, scan_status, tier, is_municipality, source_data, has_kev_match, waf_enrichment_attempts)
      SELECT * FROM unnest(
        ${sql.raw(`ARRAY[${chunk.map(r => `'${e(r.domain)}'`).join(",")}]`)}::text[],
        ${sql.raw(`ARRAY[${chunk.map(r => `'${e(r.industry)}'`).join(",")}]`)}::text[],
        ${sql.raw(`ARRAY[${chunk.map(() => `'pdf_import'`).join(",")}]`)}::text[],
        ${sql.raw(`ARRAY[${chunk.map(() => `'pending'`).join(",")}]`)}::text[],
        ${sql.raw(`ARRAY[${chunk.map(() => `'tier2'`).join(",")}]`)}::text[],
        ${sql.raw(`ARRAY[${chunk.map(r => r.domain.endsWith(".bel.tr") ? "true" : "false").join(",")}]`)}::bool[],
        ${sql.raw(`ARRAY[${chunk.map(r => `'${e(JSON.stringify({ industry: r.industry, revenue_usd: r.revenueUsd, employee_range: r.employeeRange }))}'`).join(",")}]`)}::jsonb[],
        ${sql.raw(`ARRAY[${chunk.map(() => "false").join(",")}]`)}::bool[],
        ${sql.raw(`ARRAY[${chunk.map(() => "0").join(",")}]`)}::int[]
      ) AS t(domain, sector, source, scan_status, tier, is_municipality, source_data, has_kev_match, waf_enrichment_attempts)
      ON CONFLICT (domain) DO NOTHING
    `);
    inserted += result.rowCount ?? 0;
    skipped += chunk.length - (result.rowCount ?? 0);
  }

  logger.info({ inserted, skipped, total: domains.length }, "PDF bulk import tamamlandı");
  res.json({ inserted, skipped, total: domains.length });
});

// ─── POST /api/admin-panel/lead-discovery/domain-add ─────────────────────────
// Domain(lar) ekle veya zenginleştir.
// Yeni format: { rows: [{domain, companyName?, sector?, subSector?, sourceList?, listRank?, city?}], source? }
// Eski format (geriye dönük): { domains: string[], source?, sector?, label? }
// ON CONFLICT (domain) DO UPDATE SET ... COALESCE — mevcut veri silinmez, eksik alanlar doldurulur.
router.post("/admin-panel/lead-discovery/domain-add", requireAdmin, async (req: Request, res: Response) => {
  const body = req.body as {
    rows?: Array<{
      domain: string;
      companyName?: string;
      sector?: string;
      subSector?: string;
      sourceList?: string;
      listRank?: string;
      city?: string;
    }>;
    domains?: string[];
    source?: string;
    sector?: string;
    label?: string;
  };

  const normalize = (d: string) =>
    d.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").trim().toLowerCase();
  const clean = (v: string | null | undefined): string | null =>
    (v?.trim() || null);

  // Normalize input — destekle hem yeni (rows) hem eski (domains) format
  type InputRow = {
    domain: string;
    companyName: string | null;
    sector: string | null;
    subSector: string | null;
    sourceList: string | null;
    listRank: string | null;
    city: string | null;
  };

  let inputRows: InputRow[];
  if (Array.isArray(body.rows) && body.rows.length > 0) {
    inputRows = body.rows.map(r => ({
      domain: normalize(r.domain),
      companyName: clean(r.companyName),
      sector: clean(r.sector),
      subSector: clean(r.subSector),
      sourceList: clean(r.sourceList),
      listRank: clean(r.listRank),
      city: clean(r.city),
    })).filter(r => r.domain.length > 0);
  } else if (Array.isArray(body.domains) && body.domains.length > 0) {
    const sec = clean(body.sector);
    inputRows = body.domains.map(d => ({
      domain: normalize(d),
      companyName: null,
      sector: sec,
      subSector: null,
      sourceList: clean(body.label ?? null),
      listRank: null,
      city: null,
    })).filter(r => r.domain.length > 0);
  } else {
    res.status(400).json({ error: "rows veya domains array gerekli" });
    return;
  }

  // Deduplicate by domain
  const seen = new Set<string>();
  inputRows = inputRows.filter(r => { if (seen.has(r.domain)) return false; seen.add(r.domain); return true; });
  if (inputRows.length === 0) {
    res.status(400).json({ error: "Geçerli domain bulunamadı" });
    return;
  }

  const src = clean(body.source) ?? "manual_import";
  const allDomains = inputRows.map(r => r.domain);

  // Mevcut olanları bul
  const existing = await db
    .select({ domain: leadCandidatesTable.domain })
    .from(leadCandidatesTable)
    .where(inArray(leadCandidatesTable.domain, allDomains));
  const existingSet = new Set(existing.map(r => r.domain));

  // Enriched = mevcut domain + en az bir zenginleştirme alanı dolu
  const hasEnrichment = (r: InputRow) =>
    !!(r.companyName || r.sector || r.subSector || r.sourceList || r.listRank || r.city);

  let inserted = 0;
  let enriched = 0;
  let unchanged = 0;
  const CHUNK = 50;

  const e = (s: string) => s.replace(/'/g, "''");
  const nt = (v: string | null) => v !== null ? `'${e(v)}'` : "NULL";

  for (let i = 0; i < inputRows.length; i += CHUNK) {
    const chunk = inputRows.slice(i, i + CHUNK);
    const meta = JSON.stringify({ label: body.label ?? src });

    const result = await db.execute(sql`
      INSERT INTO lead_candidates
        (domain, company_name, sector, sub_sector, source_list, list_rank, city,
         source, scan_status, tier, is_municipality, source_data, has_kev_match, waf_enrichment_attempts)
      SELECT * FROM unnest(
        ${sql.raw(`ARRAY[${chunk.map(r => `'${e(r.domain)}'`).join(",")}]`)}::text[],
        ${sql.raw(`ARRAY[${chunk.map(r => nt(r.companyName)).join(",")}]`)}::text[],
        ${sql.raw(`ARRAY[${chunk.map(r => nt(r.sector)).join(",")}]`)}::text[],
        ${sql.raw(`ARRAY[${chunk.map(r => nt(r.subSector)).join(",")}]`)}::text[],
        ${sql.raw(`ARRAY[${chunk.map(r => nt(r.sourceList)).join(",")}]`)}::text[],
        ${sql.raw(`ARRAY[${chunk.map(r => nt(r.listRank)).join(",")}]`)}::text[],
        ${sql.raw(`ARRAY[${chunk.map(r => nt(r.city)).join(",")}]`)}::text[],
        ${sql.raw(`ARRAY[${chunk.map(() => `'${e(src)}'`).join(",")}]`)}::text[],
        ${sql.raw(`ARRAY[${chunk.map(() => "'pending'").join(",")}]`)}::text[],
        ${sql.raw(`ARRAY[${chunk.map(() => "'tier2'").join(",")}]`)}::text[],
        ${sql.raw(`ARRAY[${chunk.map(r => r.domain.endsWith(".bel.tr") || r.domain.includes(".gov.tr") ? "true" : "false").join(",")}]`)}::bool[],
        ${sql.raw(`ARRAY[${chunk.map(() => `'${e(meta)}'`).join(",")}]`)}::jsonb[],
        ${sql.raw(`ARRAY[${chunk.map(() => "false").join(",")}]`)}::bool[],
        ${sql.raw(`ARRAY[${chunk.map(() => "0").join(",")}]`)}::int[]
      ) AS t(domain, company_name, sector, sub_sector, source_list, list_rank, city,
             source, scan_status, tier, is_municipality, source_data, has_kev_match, waf_enrichment_attempts)
      ON CONFLICT (domain) DO UPDATE SET
        company_name = COALESCE(EXCLUDED.company_name, lead_candidates.company_name),
        sector       = COALESCE(EXCLUDED.sector,       lead_candidates.sector),
        sub_sector   = COALESCE(EXCLUDED.sub_sector,   lead_candidates.sub_sector),
        source_list  = COALESCE(EXCLUDED.source_list,  lead_candidates.source_list),
        list_rank    = COALESCE(EXCLUDED.list_rank,    lead_candidates.list_rank),
        city         = COALESCE(EXCLUDED.city,         lead_candidates.city),
        updated_at   = now()
    `);
    inserted += result.rowCount ?? 0;

    // Enriched/unchanged sayacı güncelle
    for (const r of chunk) {
      if (existingSet.has(r.domain)) {
        if (hasEnrichment(r)) enriched++;
        else unchanged++;
      }
    }
  }

  const results = inputRows.map(r => ({
    domain: r.domain,
    status: existingSet.has(r.domain)
      ? (hasEnrichment(r) ? ("enriched" as const) : ("unchanged" as const))
      : ("inserted" as const),
  }));

  logger.info({ inserted, enriched, unchanged, total: inputRows.length, src }, "domain-add tamamlandı");
  res.json({ inserted, enriched, unchanged, skipped: enriched + unchanged, total: inputRows.length, results });
});

// ─── CVE RAPORU ─────────────────────────────────────────────────────────────
// GET /api/admin-panel/lead-discovery/cve-report/export — CSV indirme (önce gelecek)
router.get("/admin-panel/lead-discovery/cve-report/export", requireAdmin, async (req: Request, res: Response) => {
  const minCvss = parseFloat(String(req.query["minCvss"] ?? "7.0"));
  const severityFilter = String(req.query["severity"] ?? "");
  const onlyExploit = req.query["exploit"] === "1";
  const onlyKev = req.query["kev"] === "1";

  const conditions = [gte(cveTrackerTable.cvssScore, String(minCvss))];
  if (severityFilter) conditions.push(eq(cveTrackerTable.severity, severityFilter));
  if (onlyExploit) conditions.push(eq(cveTrackerTable.exploitPublic, true));
  if (onlyKev) conditions.push(eq(cveTrackerTable.cisaKev, true));

  const rows = await db
    .select({
      cveId: cveTrackerTable.cveId,
      cvssScore: cveTrackerTable.cvssScore,
      severity: cveTrackerTable.severity,
      title: cveTrackerTable.title,
      exploitPublic: cveTrackerTable.exploitPublic,
      cisaKev: cveTrackerTable.cisaKev,
      patchAvailable: cveTrackerTable.patchAvailable,
      domain: cveDomainMatchesTable.domain,
      matchedProduct: cveDomainMatchesTable.matchedProduct,
      matchedVersion: cveDomainMatchesTable.matchedVersion,
      confidence: cveDomainMatchesTable.confidence,
      isPatched: cveDomainMatchesTable.isPatched,
    })
    .from(cveTrackerTable)
    .innerJoin(cveDomainMatchesTable, eq(cveDomainMatchesTable.cveId, cveTrackerTable.cveId))
    .where(and(...conditions))
    .orderBy(desc(cveTrackerTable.cvssScore), cveTrackerTable.cveId, cveDomainMatchesTable.domain);

  const header = "CVE ID,CVSS,Severity,Baslik,Exploit,CISA KEV,Yama,Domain,Urun,Versiyon,Guven,Yamalanmis\n";
  const body = rows.map(r =>
    [
      r.cveId,
      r.cvssScore ?? "",
      r.severity ?? "",
      `"${(r.title ?? "").replace(/"/g, '""')}"`,
      r.exploitPublic ? "Evet" : "Hayir",
      r.cisaKev ? "Evet" : "Hayir",
      r.patchAvailable ? "Evet" : "Hayir",
      r.domain,
      `"${(r.matchedProduct ?? "").replace(/"/g, '""')}"`,
      r.matchedVersion ?? "",
      r.confidence ?? "",
      r.isPatched ? "Evet" : "Hayir",
    ].join(",")
  ).join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="cve-raporu-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send("\uFEFF" + header + body); // BOM for Excel Turkish charset
});

// GET /api/admin-panel/lead-discovery/cve-report — CVE listesi + domain detayları
router.get("/admin-panel/lead-discovery/cve-report", requireAdmin, async (req: Request, res: Response) => {
  const minCvss = parseFloat(String(req.query["minCvss"] ?? "7.0"));
  const severityFilter = String(req.query["severity"] ?? "");
  const onlyExploit = req.query["exploit"] === "1";
  const onlyKev = req.query["kev"] === "1";

  const conditions = [gte(cveTrackerTable.cvssScore, String(minCvss))];
  if (severityFilter) conditions.push(eq(cveTrackerTable.severity, severityFilter));
  if (onlyExploit) conditions.push(eq(cveTrackerTable.exploitPublic, true));
  if (onlyKev) conditions.push(eq(cveTrackerTable.cisaKev, true));

  try {
    // CVE özet listesi — sadece eşleşmesi olan CVE'ler (INNER JOIN)
    const cveList = await db
      .select({
        cveId: cveTrackerTable.cveId,
        cvssScore: cveTrackerTable.cvssScore,
        severity: cveTrackerTable.severity,
        title: cveTrackerTable.title,
        exploitPublic: cveTrackerTable.exploitPublic,
        cisaKev: cveTrackerTable.cisaKev,
        patchAvailable: cveTrackerTable.patchAvailable,
        status: cveTrackerTable.status,
        detectedAt: cveTrackerTable.detectedAt,
        affectedDomainCount: count(cveDomainMatchesTable.id),
      })
      .from(cveTrackerTable)
      .innerJoin(cveDomainMatchesTable, eq(cveDomainMatchesTable.cveId, cveTrackerTable.cveId))
      .where(and(...conditions))
      .groupBy(cveTrackerTable.id)
      .orderBy(desc(cveTrackerTable.cvssScore), desc(count(cveDomainMatchesTable.id)))
      .limit(200);

    if (cveList.length === 0) {
      res.json({ total: 0, cves: [] });
      return;
    }

    // Etkilenen domain detayları — correlated subquery yerine basit JOIN
    // (domain_scans subquery'leri kaldırıldı: domain_scans.domain indexi olmadığında
    //  her eşleşme için full table scan → 5 dk timeout'a yol açıyordu)
    const cveIds = cveList.map(c => c.cveId);
    const domainRows = await db
      .select({
        cveId: cveDomainMatchesTable.cveId,
        domain: cveDomainMatchesTable.domain,
        matchedProduct: cveDomainMatchesTable.matchedProduct,
        matchedVersion: cveDomainMatchesTable.matchedVersion,
        confidence: cveDomainMatchesTable.confidence,
        isPatched: cveDomainMatchesTable.isPatched,
        wafDetected: leadCandidatesTable.wafDetected,
        wafProvider: leadCandidatesTable.wafProvider,
      })
      .from(cveDomainMatchesTable)
      .leftJoin(leadCandidatesTable, eq(leadCandidatesTable.id, cveDomainMatchesTable.leadCandidateId))
      .where(inArray(cveDomainMatchesTable.cveId, cveIds))
      .orderBy(cveDomainMatchesTable.domain);

    // domain listesini CVE'lere bağla
    const domainMap = new Map<string, typeof domainRows>();
    for (const row of domainRows) {
      if (!row.cveId) continue;
      const list = domainMap.get(row.cveId) ?? [];
      list.push(row);
      domainMap.set(row.cveId, list);
    }

    const cves = cveList.map(c => ({
      ...c,
      cvssScore: c.cvssScore != null ? Number(c.cvssScore) : null,
      domains: domainMap.get(c.cveId) ?? [],
    }));

    res.json({ total: cves.length, cves });
  } catch (err: unknown) {
    req.log.error({ err }, "CVE raporu sorgusu başarısız");
    res.status(500).json({ error: "CVE raporu alınamadı." });
  }
});

// POST /api/admin-panel/lead-discovery/rescan-manual-domains
// domain_scans tablosundaki tüm domain'leri lead_candidates'a kopyalar (yoksa) ve
// WAF enrichment + kalifikasyon için sıraya alır. Admin panelden tek tıkla tetiklenir.
router.post("/admin-panel/lead-discovery/rescan-manual-domains", requireAdmin, async (req: Request, res: Response) => {
  try {
    // Distinct domain listesi — test domain'lerini ve geçersiz kayıtları çıkar
    const dsRows = await db.execute(sql`
      SELECT DISTINCT ON (domain) domain, overall_score, waf_detected, waf_provider, waf_confidence, id as scan_id
      FROM domain_scans
      WHERE overall_score > 0
        AND domain NOT LIKE '%.nip.io'
        AND domain NOT LIKE '192%'
        AND domain NOT LIKE '10.%'
      ORDER BY domain, created_at DESC
    `);

    const domains = (dsRows.rows ?? []) as Array<{
      domain: string;
      overall_score: number;
      waf_detected: boolean;
      waf_provider: string | null;
      waf_confidence: number | null;
      scan_id: number;
    }>;

    if (domains.length === 0) {
      res.json({ inserted: 0, reset: 0, total: 0, domains: [] });
      return;
    }

    // lead_candidates'ta olmayan domain'leri bul
    const domainList = domains.map(d => d.domain);
    const existingRows = await db.execute(sql`
      SELECT domain FROM lead_candidates WHERE domain = ANY(${domainList})
    `);
    const existingSet = new Set((existingRows.rows as { domain: string }[]).map(r => r.domain));

    let inserted = 0;
    let reset = 0;

    for (const row of domains) {
      const isQualified = row.overall_score < 60;

      if (!existingSet.has(row.domain)) {
        // Yoksa ekle — tier2: tekrar tam tarama yapılacak
        await db.execute(sql`
          INSERT INTO lead_candidates
            (domain, source, scan_status, scan_id, risk_score,
             is_qualified, tier, scan_depth, last_scanned_at,
             waf_detected, waf_provider, waf_confidence, waf_enriched_at, waf_enrichment_status,
             created_at, updated_at)
          VALUES
            (${row.domain}, 'manual_scan', 'pending', ${row.scan_id}, ${row.overall_score},
             ${isQualified}, 'tier2', 'full', NOW(),
             ${row.waf_detected ?? null}, ${row.waf_provider ?? null}, ${row.waf_confidence ?? null},
             ${row.waf_detected != null ? sql`NOW()` : sql`NULL`},
             ${row.waf_detected != null ? 'enriched' : null},
             NOW(), NOW())
          ON CONFLICT (domain) DO NOTHING
        `);
        inserted++;
      } else {
        // Var ise scan_status'ı pending'e al (tier2) — yeniden taranacak
        await db.execute(sql`
          UPDATE lead_candidates SET
            scan_status          = 'pending',
            tier                 = 'tier2',
            updated_at           = NOW()
          WHERE domain = ${row.domain}
            AND scan_status NOT IN ('scanning', 'prescreening')
        `);
        reset++;
      }
    }

    res.json({ inserted, reset, total: domains.length, domains: domainList });

    // Arka planda kalifikasyon başlat
    setImmediate(async () => {
      try {
        await qualifyPendingCandidates(domains.length + 10);
        logger.info({ count: domains.length }, "rescan-manual-domains: kalifikasyon tamamlandı");
      } catch (err) {
        logger.error({ err }, "rescan-manual-domains: kalifikasyon hatası");
      }
    });
  } catch (err) {
    logger.error({ err }, "rescan-manual-domains error");
    res.status(500).json({ error: "İşlem başarısız" });
  }
});

export default router;
