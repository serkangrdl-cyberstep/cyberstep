import { Router } from "express";
import { db } from "@workspace/db";
import { customerTechStackTable, customerSecurityMaturityTable } from "@workspace/db";
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

    const wafCount = await db.select({ count: count() }).from(customerTechStackTable).where(and(eq(customerTechStackTable.category, "waf"), eq(customerTechStackTable.isActive, true))).then((r) => r[0]?.count || 0);
    const microsoftCount = await db.select({ count: count() }).from(customerTechStackTable).where(and(eq(customerTechStackTable.vendor, "microsoft"), eq(customerTechStackTable.category, "mail"), eq(customerTechStackTable.isActive, true))).then((r) => r[0]?.count || 0);
    const fortinetCount = await db.select({ count: count() }).from(customerTechStackTable).where(and(eq(customerTechStackTable.vendor, "fortinet"), eq(customerTechStackTable.isActive, true))).then((r) => r[0]?.count || 0);
    const criticalPortCount = await db.select({ count: count() }).from(customerTechStackTable).where(and(eq(customerTechStackTable.category, "open_port"), eq(customerTechStackTable.securityRisk, "critical"), eq(customerTechStackTable.isActive, true))).then((r) => r[0]?.count || 0);

    const distinctDomains = await db.selectDistinct({ domain: customerTechStackTable.domain }).from(customerTechStackTable).where(eq(customerTechStackTable.isActive, true));
    const uniqueDomains = distinctDomains.length;

    res.json({
      uniqueDomains,
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

// GET /api/admin-panel/tech-stack/segments
router.get("/admin-panel/tech-stack/segments", requireAdmin, async (req, res) => {
  try {
    const fortinetM365 = await db
      .selectDistinct({ domain: customerTechStackTable.domain })
      .from(customerTechStackTable)
      .where(and(eq(customerTechStackTable.vendor, "fortinet"), eq(customerTechStackTable.isActive, true)));

    const criticalPort = await db
      .selectDistinct({ domain: customerTechStackTable.domain })
      .from(customerTechStackTable)
      .where(and(eq(customerTechStackTable.category, "open_port"), eq(customerTechStackTable.securityRisk, "critical"), eq(customerTechStackTable.isActive, true)));

    const enterprise = await db
      .selectDistinct({ domain: customerTechStackTable.domain })
      .from(customerTechStackTable)
      .where(and(eq(customerTechStackTable.salesSignal, "budget_indicator_enterprise"), eq(customerTechStackTable.isActive, true)));

    res.json({
      fortinetDomains: { count: fortinetM365.length, domains: fortinetM365.map((d) => d.domain) },
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

export default router;
