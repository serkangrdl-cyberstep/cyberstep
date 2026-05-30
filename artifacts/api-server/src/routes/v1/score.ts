import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { domainScansTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { requireApiKey, domainRateLimit, trackUsage, scoreToGrade, gradeToRisk } from "./middleware";

const router = Router();

// ─── Shared: fetch latest scan for a domain ───────────────────────────────────
async function getLatestScan(domain: string) {
  const [scan] = await db.select().from(domainScansTable)
    .where(eq(domainScansTable.domain, domain.toLowerCase().trim()))
    .orderBy(desc(domainScansTable.createdAt))
    .limit(1);
  return scan ?? null;
}

// ─── GET /api/v1/score/:domain ────────────────────────────────────────────────
// Quick score — freemium eligible
router.get("/v1/score/:domain", requireApiKey, domainRateLimit, async (req: Request, res: Response) => {
  const domain = String(req.params.domain).toLowerCase().trim();
  const start = req.v1StartedAt ?? Date.now();

  try {
    const scan = await getLatestScan(domain);

    if (!scan) {
      const ms = Date.now() - start;
      await trackUsage(req.apiKey!.id, "/v1/score", domain, null, 404, ms);
      res.status(404).json({ error: "Domain bulunamadı veya henüz taranmamış.", domain });
      return;
    }

    const grade = scoreToGrade(scan.overallScore);
    const ms = Date.now() - start;
    await trackUsage(req.apiKey!.id, "/v1/score", domain, null, 200, ms);

    res.json({
      domain: scan.domain,
      status: "scanned",
      score: scan.overallScore,
      grade,
      risk: gradeToRisk(grade),
      lastScanAt: scan.createdAt,
      summary: {
        spf: scan.spfPass,
        dmarc: scan.dmarcPass,
        ssl: scan.sslPass,
        blacklisted: scan.blacklisted,
      },
    });
  } catch (err) {
    logger.error({ err, domain }, "v1/score error");
    res.status(500).json({ error: "Sunucu hatası." });
  }
});

// ─── GET /api/v1/score/:domain/full ──────────────────────────────────────────
// Full scan results — standard+ only
router.get("/v1/score/:domain/full", requireApiKey, domainRateLimit, async (req: Request, res: Response) => {
  const domain = String(req.params.domain).toLowerCase().trim();
  const start = req.v1StartedAt ?? Date.now();

  try {
    const scan = await getLatestScan(domain);

    if (!scan) {
      const ms = Date.now() - start;
      await trackUsage(req.apiKey!.id, "/v1/score/full", domain, null, 404, ms);
      res.status(404).json({ error: "Domain bulunamadı veya henüz taranmamış.", domain });
      return;
    }

    const grade = scoreToGrade(scan.overallScore);
    const ms = Date.now() - start;
    await trackUsage(req.apiKey!.id, "/v1/score/full", domain, null, 200, ms);

    res.json({
      domain: scan.domain,
      status: "scanned",
      score: scan.overallScore,
      grade,
      risk: gradeToRisk(grade),
      lastScanAt: scan.createdAt,
      email: {
        spf: { pass: scan.spfPass, record: scan.spfRecord },
        dmarc: { pass: scan.dmarcPass, record: scan.dmarcRecord },
        dkim: { pass: scan.dkimPass, selectors: scan.dkimSelectors },
        mx: { pass: scan.mxPass, records: scan.mxRecords },
      },
      ssl: {
        pass: scan.sslPass,
        expiry: scan.sslExpiry,
        issuer: scan.sslIssuer,
        daysUntilExpiry: scan.sslDaysUntilExpiry,
        labsGrade: scan.sslLabsGrade,
      },
      reputation: {
        blacklisted: scan.blacklisted,
        blacklistCount: scan.blacklistCount,
        virusTotalMalicious: scan.virusTotalMalicious,
        virusTotalSuspicious: scan.virusTotalSuspicious,
        abuseIpdbScore: scan.abuseIpdbScore,
        urlhausListed: scan.urlhausListed,
        usomListed: scan.usomListed,
        safeBrowsingFlagged: scan.safeBrowsingFlagged,
      },
      breaches: {
        count: scan.hibpBreachCount,
        items: scan.hibpBreaches,
      },
      vulnerabilities: {
        cves: scan.cveSummary,
        shadowItServices: scan.shadowItServices,
        openPorts: scan.shodanOpenPorts ?? [],
        shodanVulnCount: scan.shodanVulnCount,
      },
      httpHeaders: {
        score: scan.httpHeadersScore,
        details: scan.httpHeadersDetails,
      },
      subdomains: {
        count: scan.ctSubdomainCount,
        sample: (scan.ctSubdomains ?? []).slice(0, 20),
      },
      recommendations: buildRecommendations(scan),
    });
  } catch (err) {
    logger.error({ err, domain }, "v1/score/full error");
    res.status(500).json({ error: "Sunucu hatası." });
  }
});

type ScanRow = Awaited<ReturnType<typeof getLatestScan>>;

function buildRecommendations(scan: NonNullable<ScanRow>): string[] {
  const recs: string[] = [];
  if (!scan.spfPass) recs.push("SPF kaydı eksik: DNS'e 'v=spf1 ... ~all' kaydı ekleyin.");
  if (!scan.dmarcPass) recs.push("DMARC kaydı eksik: _dmarc bölgenize v=DMARC1 kaydı ekleyin.");
  if (!scan.dkimPass) recs.push("DKIM imzalama aktif değil: e-posta sağlayıcınızın DKIM kurulumunu tamamlayın.");
  if (!scan.sslPass) recs.push("SSL/TLS sertifikası sorunlu veya süresi dolmak üzere.");
  if (scan.blacklisted) recs.push("Domain kara listeye alınmış: blacklist kaldırma işlemlerini başlatın.");
  if (scan.hibpBreachCount > 0) recs.push(`${scan.hibpBreachCount} veri ihlali tespit edildi: etkilenen şifreler değiştirilmeli.`);
  if (scan.shodanVulnCount > 0) recs.push(`Shodan ${scan.shodanVulnCount} açık güvenlik açığı raporluyor.`);
  if ((scan.shadowItServices ?? []).length > 0) recs.push("Yetkisiz bulut hizmetleri (Shadow IT) tespit edildi.");
  return recs;
}

export default router;
