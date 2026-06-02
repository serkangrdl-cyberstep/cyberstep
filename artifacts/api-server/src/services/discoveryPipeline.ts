/**
 * Full discovery → qualify → teaser pipeline.
 * Orchestrates crt.sh + Shodan scans, then qualifies via domain scan,
 * finds contacts via Apollo/Hunter, generates teaser emails via Claude.
 */
import { db } from "@workspace/db";
import { leadCandidatesTable } from "@workspace/db";
import { eq, and, asc, desc, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { scanCRTSH } from "./crtshScanner";
import { scanShodanFree, SHODAN_FREE_QUERIES } from "./shodanDiscovery";
import * as apolloService from "./apolloService";
import * as hunterService from "./hunterService";
import { generateLeadTeaserEmail } from "./leadTeaserEmail";

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
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
} | null> {
  try {
    const apiPort = process.env["PORT"] ?? "5000";
    const resp = await fetch(`http://localhost:${apiPort}/api/domain-scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!resp.ok) return null;
    const data = await resp.json() as { id?: number; overallScore?: number; findings?: Array<{ severity: string; title: string }> };
    return { id: data.id ?? 0, overallScore: data.overallScore ?? 0, findings: data.findings ?? [] };
  } catch {
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

export async function qualifyPendingCandidates(limit: number = 20): Promise<void> {
  const pending = await db.select().from(leadCandidatesTable)
    .where(eq(leadCandidatesTable.scanStatus, "pending"))
    .orderBy(
      desc(leadCandidatesTable.hasFortigate),
      desc(sql`(source_data->>'corporateScore')::int`),
      asc(leadCandidatesTable.createdAt),
    )
    .limit(limit);

  logger.info({ count: pending.length }, "Aday kalifikasyonu başlıyor");

  for (const candidate of pending) {
    try {
      await db.update(leadCandidatesTable).set({ scanStatus: "scanning" })
        .where(eq(leadCandidatesTable.id, candidate.id));

      const scanResult = await runDomainScanInternal(candidate.domain);

      if (!scanResult) {
        await db.update(leadCandidatesTable).set({ scanStatus: "failed" })
          .where(eq(leadCandidatesTable.id, candidate.id));
        await sleep(2000);
        continue;
      }

      const criticals = scanResult.findings.filter((f) => f.severity === "critical");
      const isQualified = criticals.length >= 1 && scanResult.overallScore >= 40;

      await db.update(leadCandidatesTable).set({
        scanStatus: "scanned",
        scanId: scanResult.id,
        riskScore: scanResult.overallScore,
        criticalFindings: criticals.length,
        findingHighlights: criticals.slice(0, 3).map((f) => f.title),
        isQualified,
        updatedAt: new Date(),
      }).where(eq(leadCandidatesTable.id, candidate.id));

      if (!isQualified) {
        logger.info({ domain: candidate.domain, score: scanResult.overallScore }, "Kalifikasyon reddedildi");
        await sleep(1000);
        continue;
      }

      // İletişim bul (Apollo önce, Hunter fallback)
      if (!candidate.contactEmail) {
        try {
          const apolloContacts = await apolloService.findDecisionMakers(candidate.domain);
          let contactEmail: string | null = null;
          let contactName: string | null = null;
          let contactTitle: string | null = null;
          let contactSource = "apollo";

          if (apolloContacts.length > 0) {
            const c = apolloContacts[0] as { email?: string; name?: string; title?: string };
            contactEmail = c.email ?? null;
            contactName = c.name ?? null;
            contactTitle = c.title ?? null;
          } else {
            const hunterResult = await hunterService.domainSearch(candidate.domain);
            const top = hunterResult.emails[0] as { value?: string; first_name?: string; last_name?: string; position?: string } | undefined;
            if (top) {
              contactEmail = top.value ?? null;
              contactName = [top.first_name, top.last_name].filter(Boolean).join(" ") || null;
              contactTitle = top.position ?? null;
              contactSource = "hunter";
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
          }
        } catch (e) {
          logger.warn({ domain: candidate.domain, err: String(e) }, "İletişim bulma başarısız");
        }
        await sleep(500);
      }

      // Teaser üret
      try {
        const refreshed = await db.select().from(leadCandidatesTable).where(eq(leadCandidatesTable.id, candidate.id)).then((r) => r[0]);
        if (refreshed?.contactEmail) {
          await generateLeadTeaserEmail(candidate.id, scanResult);
        }
      } catch (e) {
        logger.warn({ domain: candidate.domain, err: String(e) }, "Teaser üretimi başarısız");
      }

      logger.info({ domain: candidate.domain, criticals: criticals.length, score: scanResult.overallScore }, "Kalifikasyon geçti");
    } catch (e) {
      logger.error({ domain: candidate.domain, err: String(e) }, "Kalifikasyon hatası");
      await db.update(leadCandidatesTable).set({ scanStatus: "failed" })
        .where(eq(leadCandidatesTable.id, candidate.id));
    }

    await sleep(3000);
  }
}

export { getISOWeek };
