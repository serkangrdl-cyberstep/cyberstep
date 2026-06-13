/**
 * Full discovery → qualify → teaser pipeline.
 * Orchestrates crt.sh + Shodan scans, then qualifies via domain scan,
 * finds contacts via Apollo/Hunter, generates teaser emails via Claude.
 */
import { db } from "@workspace/db";
import { leadCandidatesTable, domainScansTable, customerTechStackTable } from "@workspace/db";
import { eq, and, asc, desc, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { scanCRTSH } from "./crtshScanner";
import { scanShodanFree, SHODAN_FREE_QUERIES } from "./shodanDiscovery";
import * as apolloService from "./apolloService";
import * as hunterService from "./hunterService";
import { whoisLookup } from "./whoisService";
import { scrapeContactEmail } from "./webContactScraper";
import { generateLeadTeaserEmail } from "./leadTeaserEmail";
import { shouldExcludeFromPipeline, computeCVEBreakdown } from "./leadScoringService";
import { checkLiveness } from "./leadDiscovery/webContentEnrichment";

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((res) => setTimeout(() => res(fallback), ms)),
  ]);
}

function getSalesSignal(vendorName: string): string | null {
  const n = vendorName.toLowerCase();
  if (n.includes("cloudflare")) return "cdn_user";
  if (n.includes("wordpress")) return "cms_wordpress";
  if (n.includes("fortinet") || n.includes("fortigate")) return "fortinet_customer";
  if (n.includes("microsoft") || n.includes("office 365") || n.includes("exchange")) return "microsoft_shop";
  return null;
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.valueOf() - yearStart.valueOf()) / 86400000) + 1) / 7);
}

async function runDomainScanInternal(domain: string): Promise<{
  id: number;
  overallScore: number;
  findings: Array<{ severity: string; title: string }>;
  cveSummary: Array<{ cvssScore: number; cveId?: string }>;
} | null> {
  try {
    const { performDomainScan } = await import("../routes/domain-scan/index");
    const result = await performDomainScan(domain);
    if (!result) return null;
    return {
      id: result.id ?? 0,
      overallScore: result.overallScore ?? 0,
      findings: result.findings ?? [],
      cveSummary: (result.cveSummary as Array<{ cvssScore: number; cveId?: string }>) ?? [],
    };
  } catch (err) {
    logger.warn({ err, domain }, "Discovery pipeline: direct domain scan failed");
    return null;
  }
}

export interface PipelineConfig {
  useCrtsh?: boolean;
  useShodan?: boolean;
  crtshQueries?: string[];
  shodanQueryIndexes?: number[];
  autoQualify?: boolean;
  maxDomains?: number;
  qualifyLimit?: number;
}

export async function runFullDiscoveryAndQualify(config: PipelineConfig = {}): Promise<void> {
  const {
    useCrtsh = true,
    useShodan = true,
    crtshQueries = ["%.com.tr", "%.net.tr"],
    shodanQueryIndexes = [0, 2, 4],
    autoQualify = true,
    maxDomains = 200,
    qualifyLimit = 20,
  } = config;

  logger.info("=== Lead Discovery Pipeline Başladı ===");

  if (useCrtsh) {
    for (const query of crtshQueries) {
      logger.info({ query }, "crt.sh taraması başlıyor");
      try {
        await scanCRTSH(query, { daysBack: 30, minCorporateScore: 60, limit: Math.floor(maxDomains / crtshQueries.length) });
      } catch (e) {
        logger.error({ query, err: String(e) }, "crt.sh taraması başarısız");
      }
      await sleep(2000);
    }
  }

  if (useShodan && process.env["SHODAN_API_KEY"]) {
    for (const idx of shodanQueryIndexes) {
      logger.info({ idx, label: SHODAN_FREE_QUERIES[idx]?.label }, "Shodan taraması başlıyor");
      try {
        await scanShodanFree(idx, 100);
      } catch (e) {
        logger.error({ idx, err: String(e) }, "Shodan taraması başarısız");
      }
      await sleep(3000);
    }
  }

  if (!autoQualify) {
    logger.info("Kalifikasyon atlandı (autoQualify=false)");
    return;
  }

  await qualifyPendingCandidates(qualifyLimit);
  logger.info("=== Pipeline Tamamlandı ===");
}

export async function qualifyPendingCandidates(limit: number = 200): Promise<{ processed: number; qualified: number }> {
  const pending = await db.select().from(leadCandidatesTable)
    .where(eq(leadCandidatesTable.scanStatus, "pending"))
    .orderBy(
      desc(leadCandidatesTable.hasFortigate),
      desc(sql`(source_data->>'corporateScore')::int`),
      asc(leadCandidatesTable.createdAt),
    )
    .limit(limit);

  logger.info({ count: pending.length }, "Aday kalifikasyonu başlıyor");

  const MAX_RUNTIME_MS = 25 * 60 * 1000; // 25 dakika circuit breaker
  const SCAN_TIMEOUT_MS = 25_000;         // tek domain taraması max 25s
  const batchStart = Date.now();
  let processedCount = 0;
  let qualifiedCount = 0;

  for (const candidate of pending) {
    // Circuit breaker: 15 dakika geçtiyse dur
    if (Date.now() - batchStart > MAX_RUNTIME_MS) {
      logger.warn({ processed: processedCount, qualified: qualifiedCount }, "Kalifikasyon: max süre (15 dk) aşıldı, batch sonlandırılıyor");
      break;
    }

    try {
      // Eleme kontrolü — kamu TLD'leri ve kurum tiplerini atla
      const sourceOrg = (candidate.sourceData as Record<string, unknown> | null)?.["org"] as string | null ?? null;
      const exclusion = shouldExcludeFromPipeline(candidate.domain, sourceOrg);
      if (exclusion.exclude) {
        logger.info({ domain: candidate.domain, reason: exclusion.reason }, "Kalifikasyon: domain eleme listesinde, atlanıyor");
        await db.update(leadCandidatesTable).set({ scanStatus: "failed" })
          .where(eq(leadCandidatesTable.id, candidate.id));
        processedCount++;
        await sleep(300);
        continue;
      }

      // Liveness check — ölü siteleri domain scan'a sokmadan önce ele
      const liveness = await checkLiveness(candidate.domain);
      if (!liveness.isAlive) {
        logger.info(
          { domain: candidate.domain, httpStatus: liveness.httpStatus, responseTimeMs: liveness.responseTimeMs },
          "Kalifikasyon: site erişilemiyor, kapsam dışı bırakıldı",
        );
        await db.update(leadCandidatesTable).set({
          scanStatus: "failed",
          isAlive: false,
          httpStatus: liveness.httpStatus,
          responseTimeMs: liveness.responseTimeMs,
          updatedAt: new Date(),
        }).where(eq(leadCandidatesTable.id, candidate.id));
        processedCount++;
        await sleep(300);
        continue;
      }

      // Canlı site — durumu kaydet ve taramaya geç
      await db.update(leadCandidatesTable).set({
        isAlive: true,
        httpStatus: liveness.httpStatus,
        responseTimeMs: liveness.responseTimeMs,
        scanStatus: "scanning",
        updatedAt: new Date(),
      }).where(eq(leadCandidatesTable.id, candidate.id));

      // Domain taraması — max 25s timeout
      const scanResult = await withTimeout(runDomainScanInternal(candidate.domain), SCAN_TIMEOUT_MS, null);

      if (!scanResult) {
        await db.update(leadCandidatesTable).set({ scanStatus: "failed" })
          .where(eq(leadCandidatesTable.id, candidate.id));
        processedCount++;
        await sleep(1000);
        continue;
      }

      const criticals = scanResult.findings.filter((f) => f.severity === "critical");
      const isQualified = scanResult.overallScore < 60;

      // CVE breakdown hesapla ve sourceData'ya ekle
      const cveBreakdown = computeCVEBreakdown(scanResult.cveSummary);
      const existingSourceData = (candidate.sourceData as Record<string, unknown> | null) ?? {};
      const updatedSourceData = { ...existingSourceData, cveBreakdown };

      await db.update(leadCandidatesTable).set({
        scanStatus: "scanned",
        scanId: scanResult.id,
        riskScore: scanResult.overallScore,
        criticalFindings: criticals.length,
        findingHighlights: criticals.slice(0, 3).map((f) => f.title),
        isQualified,
        sourceData: updatedSourceData,
        updatedAt: new Date(),
      }).where(eq(leadCandidatesTable.id, candidate.id));

      // Shadow IT → customer_tech_stack aktarımı
      try {
        const scanRow = await db
          .select({ shadowItServices: domainScansTable.shadowItServices })
          .from(domainScansTable)
          .where(eq(domainScansTable.id, scanResult.id))
          .then((r) => r[0]);

        const services = (scanRow?.shadowItServices ?? []) as Array<{
          name: string; category: string; risk: string; description: string; version?: string;
        }>;

        if (services.length > 0) {
          // Önceki shadow IT girişlerini temizle (re-scan senaryosu)
          await db.delete(customerTechStackTable).where(
            and(
              eq(customerTechStackTable.leadCandidateId, candidate.id),
              eq(customerTechStackTable.detectedVia, "shadow_it_scan"),
            ),
          );

          for (const svc of services) {
            await db.insert(customerTechStackTable).values({
              domain: candidate.domain,
              leadCandidateId: candidate.id,
              category: svc.category,
              vendor: svc.name,
              version: svc.version ?? null,
              securityRisk: (svc.risk as "critical" | "high" | "medium" | "low" | "none") ?? null,
              securityNote: svc.description,
              salesSignal: getSalesSignal(svc.name),
              detectedVia: "shadow_it_scan",
              confidence: 80,
            }).onConflictDoNothing();
          }

          logger.info({ domain: candidate.domain, count: services.length }, "Shadow IT → customer_tech_stack aktarıldı");
        }
      } catch (e) {
        logger.warn({ domain: candidate.domain, err: String(e) }, "Shadow IT tech_stack aktarımı başarısız");
      }

      processedCount++;
      if (!isQualified) {
        logger.info({ domain: candidate.domain, score: scanResult.overallScore }, "Kalifikasyon reddedildi");
        await sleep(1000);
        continue;
      }
      qualifiedCount++;

      // İletişim bul: Apollo → Hunter → WHOIS → Web scraping
      if (!candidate.contactEmail) {
        try {
          let contactEmail: string | null = null;
          let contactName: string | null = null;
          let contactTitle: string | null = null;
          let contactSource = "apollo";

          // 1. Apollo
          const apolloContacts = await apolloService.findDecisionMakers(candidate.domain);
          if (apolloContacts.length > 0) {
            const c = apolloContacts[0] as { email?: string; name?: string; title?: string };
            contactEmail = c.email ?? null;
            contactName = c.name ?? null;
            contactTitle = c.title ?? null;
          }

          // 2. Hunter fallback
          if (!contactEmail) {
            const hunterResult = await hunterService.domainSearch(candidate.domain);
            const top = hunterResult.emails[0] as { value?: string; first_name?: string; last_name?: string; position?: string } | undefined;
            if (top) {
              contactEmail = top.value ?? null;
              contactName = [top.first_name, top.last_name].filter(Boolean).join(" ") || null;
              contactTitle = top.position ?? null;
              contactSource = "hunter";
            }
          }

          // 3. WHOIS fallback
          if (!contactEmail) {
            const whoisEmail = await whoisLookup(candidate.domain);
            if (whoisEmail) {
              contactEmail = whoisEmail;
              contactSource = "whois";
            }
          }

          // 4. Web scraping fallback
          if (!contactEmail) {
            const webContact = await scrapeContactEmail(candidate.domain);
            if (webContact) {
              contactEmail = webContact.email;
              contactSource = `web${webContact.sourcePath}`;
            }
          }

          if (contactEmail) {
            await db.update(leadCandidatesTable).set({
              contactEmail,
              contactName,
              contactTitle,
              contactSource,
              updatedAt: new Date(),
            }).where(eq(leadCandidatesTable.id, candidate.id));
            logger.info({ domain: candidate.domain, source: contactSource }, "Kontak bulundu");
          }
        } catch (e) {
          logger.warn({ domain: candidate.domain, err: String(e) }, "İletişim bulma başarısız");
        }
        await sleep(500);
      }

      // Teaser üret — contactEmail olmasa da fire-and-forget
      setImmediate(async () => {
        try {
          await generateLeadTeaserEmail(candidate.id, scanResult);
          logger.info({ domain: candidate.domain }, "Teaser email otomatik üretildi");
        } catch (e) {
          logger.warn({ err: String(e), domain: candidate.domain }, "Teaser email üretimi başarısız");
        }
      });

      logger.info({ domain: candidate.domain, criticals: criticals.length, score: scanResult.overallScore }, "Kalifikasyon geçti");
    } catch (e) {
      logger.error({ domain: candidate.domain, err: String(e) }, "Kalifikasyon hatası");
      await db.update(leadCandidatesTable).set({ scanStatus: "failed" })
        .where(eq(leadCandidatesTable.id, candidate.id));
      processedCount++;
    }

    await sleep(1500);
  }

  logger.info({ processed: processedCount, qualified: qualifiedCount }, "Kalifikasyon batch tamamlandı");
  return { processed: processedCount, qualified: qualifiedCount };
}

export { getISOWeek };
