import { Router } from "express";
import { db } from "@workspace/db";
import { customerTechStackTable, customerSecurityMaturityTable, domainScansTable } from "@workspace/db";
import { eq, desc, sql, and, isNotNull, count } from "drizzle-orm";
import { fingerprintDomain } from "../../services/technographics/fingerprintEngine";
import { requireAdmin } from "./middleware";

const router = Router();

// GET /api/admin-panel/tech-stack/stats
router.get("/admin-panel/tech-stack/stats", requireAdmin, async (req, res) => {
  try {
    const totalDomains = await db.select({ count: count() }).from(customerTechStackTable).then((r) => r[0]?.count || 0);

    const byCategory = await db
      .select({ category: customerTechStackTable.category, vendor: customerTechStackTable.vendor, cnt: count() })
      .from(customerTechStackTable)
      .where(eq(customerTechStackTable.isActive, true))
      .groupBy(customerTechStackTable.category, customerTechStackTable.vendor)
      .orderBy(desc(count()));

    // WAF/CDN koruması: customer_tech_stack (category waf/cdn/"Güvenlik / CDN") + domain_scans (waf_detected=true)
    const wafResult = await db.execute(sql`
      SELECT COUNT(DISTINCT domain)::int AS cnt FROM (
        SELECT domain FROM customer_tech_stack
        WHERE is_active = true
          AND category IN ('waf', 'cdn', 'Güvenlik / CDN', 'firewall')
        UNION
        SELECT domain FROM domain_scans WHERE waf_detected = true
      ) sub
    `);
    const wafCount = Number((wafResult.rows[0] as { cnt: number })?.cnt || 0);
    const microsoftCount = await db.select({ count: count() }).from(customerTechStackTable).where(and(eq(customerTechStackTable.vendor, "microsoft"), eq(customerTechStackTable.category, "mail"), eq(customerTechStackTable.isActive, true))).then((r) => r[0]?.count || 0);
    // FortiGate: hem customer_tech_stack (Shodan) hem domain_scans (WAF header) — waf_provider ILIKE '%forti%' kapsar
    const fortinetResult = await db.execute(sql`
      SELECT COUNT(DISTINCT domain)::int AS cnt FROM (
        SELECT domain FROM customer_tech_stack WHERE vendor = 'fortinet' AND is_active = true
        UNION
        SELECT domain FROM domain_scans WHERE waf_provider ILIKE '%forti%'
      ) sub
    `);
    const fortinetCount = Number((fortinetResult.rows[0] as { cnt: number })?.cnt || 0);
    const criticalPortCount = await db.select({ count: count() }).from(customerTechStackTable).where(and(eq(customerTechStackTable.category, "open_port"), eq(customerTechStackTable.securityRisk, "critical"), eq(customerTechStackTable.isActive, true))).then((r) => r[0]?.count || 0);

    const distinctDomains = await db.selectDistinct({ domain: customerTechStackTable.domain }).from(customerTechStackTable).where(eq(customerTechStackTable.isActive, true));
    const uniqueDomains = distinctDomains.length;

    const scannedResult = await db.execute(sql`SELECT COUNT(DISTINCT domain)::int as cnt FROM domain_scans`);
    const scannedDomains = Number((scannedResult.rows[0] as { cnt: number })?.cnt || 0);
    const pendingFingerprint = Math.max(0, scannedDomains - uniqueDomains);

    res.json({
      uniqueDomains,
      scannedDomains,
      pendingFingerprint,
      totalEntries: Number(totalDomains),
      wafDetected: Number(wafCount),
      microsoft365: Number(microsoftCount),
      fortinet: Number(fortinetCount),
      criticalOpenPorts: Number(criticalPortCount),
      byCategory,
    });
  } catch (e) {
    req.log.error({ err: e }, "Tech stack stats hatası");
    res.status(500).json({ error: "İstatistikler alınamadı" });
  }
});

// GET /api/admin-panel/tech-stack/drilldown?filter=<type>
// Returns domain list for a KPI card filter. Must be before /:domain wildcard.
router.get("/admin-panel/tech-stack/drilldown", requireAdmin, async (req, res) => {
  const filter = String(req.query["filter"] || "");
  try {
    let rows: { domain: string }[] = [];

    if (filter === "waf") {
      const r = await db.execute(sql`
        SELECT DISTINCT domain FROM (
          SELECT domain FROM customer_tech_stack WHERE is_active = true AND category IN ('waf','cdn','Güvenlik / CDN','firewall')
          UNION
          SELECT domain FROM domain_scans WHERE waf_detected = true
        ) sub ORDER BY domain
      `);
      rows = r.rows as { domain: string }[];
    } else if (filter === "fortinet") {
      const r = await db.execute(sql`
        SELECT DISTINCT domain FROM (
          SELECT domain FROM customer_tech_stack WHERE vendor = 'fortinet' AND is_active = true
          UNION
          SELECT domain FROM domain_scans WHERE waf_provider ILIKE '%forti%'
        ) sub ORDER BY domain
      `);
      rows = r.rows as { domain: string }[];
    } else if (filter === "microsoft365") {
      const r = await db.selectDistinct({ domain: customerTechStackTable.domain })
        .from(customerTechStackTable)
        .where(and(eq(customerTechStackTable.vendor, "microsoft"), eq(customerTechStackTable.category, "mail"), eq(customerTechStackTable.isActive, true)))
        .orderBy(customerTechStackTable.domain);
      rows = r;
    } else if (filter === "criticalPorts") {
      const r = await db.selectDistinct({ domain: customerTechStackTable.domain })
        .from(customerTechStackTable)
        .where(and(eq(customerTechStackTable.category, "open_port"), eq(customerTechStackTable.securityRisk, "critical"), eq(customerTechStackTable.isActive, true)))
        .orderBy(customerTechStackTable.domain);
      rows = r;
    } else if (filter === "analyzed") {
      const r = await db.selectDistinct({ domain: customerTechStackTable.domain })
        .from(customerTechStackTable)
        .where(eq(customerTechStackTable.isActive, true))
        .orderBy(customerTechStackTable.domain)
        .limit(200);
      rows = r;
    } else if (filter === "scanned") {
      const r = await db.execute(sql`SELECT DISTINCT domain FROM domain_scans ORDER BY domain LIMIT 200`);
      rows = r.rows as { domain: string }[];
    } else if (filter === "pending") {
      const r = await db.execute(sql`
        SELECT DISTINCT ds.domain FROM domain_scans ds
        WHERE ds.domain NOT IN (
          SELECT DISTINCT domain FROM customer_tech_stack WHERE is_active = true
        )
        ORDER BY ds.domain LIMIT 200
      `);
      rows = r.rows as { domain: string }[];
    } else {
      res.status(400).json({ error: "Geçersiz filter" }); return;
    }

    res.json({ domains: rows.map(r => r.domain), total: rows.length });
  } catch (e) {
    req.log.error({ err: e }, "Tech stack drilldown hatası");
    res.status(500).json({ error: "Drilldown alınamadı" });
  }
});

// GET /api/admin-panel/tech-stack/segments
router.get("/admin-panel/tech-stack/segments", requireAdmin, async (req, res) => {
  try {
    // Fortinet: hem customer_tech_stack (Shodan tespiti) hem domain_scans (WAF header tespiti)
    const fortinetResult = await db.execute(sql`
      SELECT DISTINCT domain FROM customer_tech_stack
      WHERE vendor = 'fortinet' AND is_active = true
      UNION
      SELECT DISTINCT domain FROM domain_scans
      WHERE waf_provider = 'fortinet'
    `);
    const fortinetDomainList = (fortinetResult.rows as { domain: string }[]).map((r) => r.domain);

    const criticalPort = await db
      .selectDistinct({ domain: customerTechStackTable.domain })
      .from(customerTechStackTable)
      .where(and(eq(customerTechStackTable.category, "open_port"), eq(customerTechStackTable.securityRisk, "critical"), eq(customerTechStackTable.isActive, true)));

    const enterprise = await db
      .selectDistinct({ domain: customerTechStackTable.domain })
      .from(customerTechStackTable)
      .where(and(eq(customerTechStackTable.salesSignal, "budget_indicator_enterprise"), eq(customerTechStackTable.isActive, true)));

    res.json({
      fortinetDomains: { count: fortinetDomainList.length, domains: fortinetDomainList },
      criticalPortDomains: { count: criticalPort.length, domains: criticalPort.map((d) => d.domain) },
      enterpriseDomains: { count: enterprise.length, domains: enterprise.map((d) => d.domain) },
    });
  } catch (e) {
    req.log.error({ err: e }, "Tech stack segments hatası");
    res.status(500).json({ error: "Segmentler alınamadı" });
  }
});

// GET /api/admin-panel/tech-stack/by-vendor
router.get("/admin-panel/tech-stack/by-vendor", requireAdmin, async (req, res) => {
  try {
    const vendor = String(req.query["vendor"] || "");
    const category = String(req.query["category"] || "");

    const conditions = [eq(customerTechStackTable.isActive, true)];
    if (vendor) conditions.push(eq(customerTechStackTable.vendor, vendor));
    if (category) conditions.push(eq(customerTechStackTable.category, category));

    const rows = await db
      .selectDistinct({ domain: customerTechStackTable.domain })
      .from(customerTechStackTable)
      .where(and(...conditions))
      .orderBy(customerTechStackTable.domain);

    const topVendors = await db
      .select({ vendor: customerTechStackTable.vendor, category: customerTechStackTable.category, cnt: count() })
      .from(customerTechStackTable)
      .where(eq(customerTechStackTable.isActive, true))
      .groupBy(customerTechStackTable.vendor, customerTechStackTable.category)
      .orderBy(desc(count()))
      .limit(30);

    res.json({ domains: rows.map((r) => r.domain), count: rows.length, topVendors });
  } catch (e) {
    req.log.error({ err: e }, "Tech stack by-vendor hatası");
    res.status(500).json({ error: "Vendor listesi alınamadı" });
  }
});

// GET /api/admin-panel/tech-stack/recent — tüm taranan domainler (maturity özeti ile)
router.get("/admin-panel/tech-stack/recent", requireAdmin, async (req, res) => {
  try {
    const rows = await db
      .selectDistinct({
        domain: customerTechStackTable.domain,
        lastVerifiedAt: customerTechStackTable.lastVerifiedAt,
      })
      .from(customerTechStackTable)
      .where(eq(customerTechStackTable.isActive, true))
      .orderBy(desc(customerTechStackTable.lastVerifiedAt))
      .limit(200);

    if (rows.length === 0) { res.json([]); return; }

    const domains = rows.map(r => r.domain);

    const [stackCounts, maturities] = await Promise.all([
      db.select({
        domain: customerTechStackTable.domain,
        cnt: count(),
      })
        .from(customerTechStackTable)
        .where(and(eq(customerTechStackTable.isActive, true), sql`domain = ANY(${sql.raw(`ARRAY[${domains.map(d => `'${d.replace(/'/g, "''")}'`).join(",")}]`)}`))
        .groupBy(customerTechStackTable.domain),
      db.select({
        domain: customerSecurityMaturityTable.domain,
        maturityScore: customerSecurityMaturityTable.maturityScore,
        maturityLevel: customerSecurityMaturityTable.maturityLevel,
        companySegment: customerSecurityMaturityTable.companySegment,
        updatedAt: customerSecurityMaturityTable.updatedAt,
      })
        .from(customerSecurityMaturityTable)
        .where(sql`domain = ANY(${sql.raw(`ARRAY[${domains.map(d => `'${d.replace(/'/g, "''")}'`).join(",")}]`)})`),
    ]);

    const countMap = new Map(stackCounts.map(r => [r.domain, Number(r.cnt)]));
    const matMap = new Map(maturities.map(m => [m.domain, m]));

    const result = rows.map(r => ({
      domain: r.domain,
      stackCount: countMap.get(r.domain) ?? 0,
      maturityScore: matMap.get(r.domain)?.maturityScore ?? null,
      maturityLevel: matMap.get(r.domain)?.maturityLevel ?? null,
      companySegment: matMap.get(r.domain)?.companySegment ?? null,
      updatedAt: matMap.get(r.domain)?.updatedAt ?? r.lastVerifiedAt,
    }));

    res.json(result);
  } catch (e) {
    req.log.error({ err: e }, "Tech stack recent hatası");
    res.status(500).json({ error: "Geçmiş alınamadı" });
  }
});

// GET /api/admin-panel/tech-stack/:domain
router.get("/admin-panel/tech-stack/:domain", requireAdmin, async (req, res) => {
  try {
    const domain = String(req.params["domain"]);
    const stack = await db
      .select()
      .from(customerTechStackTable)
      .where(and(eq(customerTechStackTable.domain, domain), eq(customerTechStackTable.isActive, true)))
      .orderBy(desc(customerTechStackTable.confidence));

    const [maturity] = await db.select().from(customerSecurityMaturityTable).where(eq(customerSecurityMaturityTable.domain, domain));

    res.json({ domain, stack, maturity: maturity || null });
  } catch (e) {
    req.log.error({ err: e }, "Tech stack domain hatası");
    res.status(500).json({ error: "Domain bilgisi alınamadı" });
  }
});

// POST /api/admin-panel/tech-stack/fingerprint
router.post("/admin-panel/tech-stack/fingerprint", requireAdmin, async (req, res) => {
  try {
    const { domain } = req.body as { domain: string };
    if (!domain) { res.status(400).json({ error: "Domain gerekli" }); return; }

    const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const result = await fingerprintDomain(cleanDomain, { useShodan: !!process.env.SHODAN_API_KEY });
    res.json({ domain: cleanDomain, stackCount: result.stack.length, maturity: result.maturity, stack: result.stack });
  } catch (e) {
    req.log.error({ err: e }, "Fingerprint hatası");
    res.status(500).json({ error: "Fingerprint başarısız" });
  }
});

// POST /api/admin-panel/tech-stack/backfill-network-devices
// Mevcut lead_candidates.source_data ve domain_scans.shodan_open_ports'tan
// customer_tech_stack'e FortiGate + diğer ağ cihazlarını tek seferlik yazar.
router.post("/admin-panel/tech-stack/backfill-network-devices", requireAdmin, async (req, res) => {
  try {
    // 1. FortiGate: lead_candidates.source_data (has_fortigate=true veya product ILIKE '%forti%')
    const fortiResult = await db.execute(sql`
      INSERT INTO customer_tech_stack (
        domain, lead_candidate_id, category, vendor, product, version,
        sales_signal, detected_via, confidence, is_active
      )
      SELECT
        domain, id, 'firewall', 'fortinet',
        CASE
          WHEN source_data->>'product' ILIKE '%forti%' THEN source_data->>'product'
          WHEN source_data->>'httpTitle' ILIKE '%fortigate%' THEN 'FortiGate'
          ELSE 'FortiGate'
        END,
        NULL, 'has_fortinet', 'shodan', 95, true
      FROM lead_candidates
      WHERE has_fortigate = true
         OR source_data->>'product' ILIKE '%forti%'
         OR source_data->>'httpTitle' ILIKE '%fortigate%'
      ON CONFLICT DO NOTHING
    `);

    // 2. Diğer ağ cihazları: domain_scans.shodan_open_ports (MikroTik, Cisco, Sophos vb.)
    const networkResult = await db.execute(sql`
      INSERT INTO customer_tech_stack (
        domain, lead_candidate_id, category, vendor, product, version,
        sales_signal, detected_via, confidence, is_active
      )
      SELECT
        ds.domain, lc.id, 'firewall',
        CASE
          WHEN (elem->>'product') ILIKE '%fortinet%' OR (elem->>'product') ILIKE '%fortigate%' THEN 'fortinet'
          WHEN (elem->>'product') ILIKE '%mikrotik%' OR (elem->>'product') ILIKE '%routeros%'  THEN 'mikrotik'
          WHEN (elem->>'product') ILIKE '%cisco%'                                               THEN 'cisco'
          WHEN (elem->>'product') ILIKE '%sophos%'                                              THEN 'sophos'
          WHEN (elem->>'product') ILIKE '%palo alto%' OR (elem->>'product') ILIKE '%pan-os%'   THEN 'paloalto'
          WHEN (elem->>'product') ILIKE '%juniper%'  OR (elem->>'product') ILIKE '%junos%'     THEN 'juniper'
          WHEN (elem->>'product') ILIKE '%checkpoint%'                                          THEN 'checkpoint'
        END,
        CASE
          WHEN (elem->>'product') ILIKE '%fortinet%' OR (elem->>'product') ILIKE '%fortigate%' THEN 'FortiGate'
          WHEN (elem->>'product') ILIKE '%mikrotik%' OR (elem->>'product') ILIKE '%routeros%'  THEN 'MikroTik'
          WHEN (elem->>'product') ILIKE '%cisco%'                                               THEN 'Cisco'
          WHEN (elem->>'product') ILIKE '%sophos%'                                              THEN 'Sophos'
          WHEN (elem->>'product') ILIKE '%palo alto%' OR (elem->>'product') ILIKE '%pan-os%'   THEN 'Palo Alto'
          WHEN (elem->>'product') ILIKE '%juniper%'  OR (elem->>'product') ILIKE '%junos%'     THEN 'Juniper'
          WHEN (elem->>'product') ILIKE '%checkpoint%'                                          THEN 'Check Point'
          ELSE elem->>'product'
        END,
        NULLIF(elem->>'version', ''),
        CASE
          WHEN (elem->>'product') ILIKE '%fortinet%' OR (elem->>'product') ILIKE '%fortigate%' THEN 'has_fortinet'
          ELSE 'has_network_device'
        END,
        'shodan', 90, true
      FROM domain_scans ds
      JOIN lead_candidates lc ON lc.scan_id = ds.id,
        jsonb_array_elements(ds.shodan_open_ports) AS elem
      WHERE (elem->>'product') ILIKE ANY(ARRAY['%fortinet%','%fortigate%','%mikrotik%','%routeros%','%cisco%','%sophos%','%palo alto%','%pan-os%','%juniper%','%junos%','%checkpoint%'])
         OR (elem->>'service') ILIKE ANY(ARRAY['%fortinet%','%fortigate%','%mikrotik%','%cisco%','%sophos%'])
      ON CONFLICT DO NOTHING
    `);

    const fortiCount   = Number((fortiResult as { rowCount?: number }).rowCount ?? 0);
    const networkCount = Number((networkResult as { rowCount?: number }).rowCount ?? 0);

    req.log.info({ fortiCount, networkCount }, "Tech stack backfill tamamlandı");
    res.json({ ok: true, fortigate: fortiCount, networkDevices: networkCount, total: fortiCount + networkCount });
  } catch (e) {
    req.log.error({ err: e }, "Tech stack backfill hatası");
    res.status(500).json({ error: "Backfill başarısız" });
  }
});

export default router;
