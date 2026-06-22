/**
 * VirusTotal pasif DNS tabanlı subdomain keşfi.
 * Ücretsiz tier: 4 istek/dakika — rate limit'e kesinlikle uy.
 * Mevcut lead_candidates'daki yüksek skorlu domain'lerin alt domainlerini bulur.
 * VIRUSTOTAL_API_KEY gereklidir (virustotal.com'da ücretsiz hesap).
 */
import axios from "axios";
import { db } from "@workspace/db";
import { discoveryRunsTable, leadCandidatesTable } from "@workspace/db";
import { eq, gte, desc, and } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { inferSectorFromDomain } from "../crtshScanner";

const VT_BASE = "https://www.virustotal.com/api/v3";

const EXCLUDED_TLDS = [".gov.tr", ".mil.tr", ".pol.tr"];

function isExcluded(domain: string): boolean {
  return EXCLUDED_TLDS.some(t => domain.toLowerCase().endsWith(t));
}

async function getSubdomains(domain: string, apiKey: string): Promise<string[]> {
  const url = `${VT_BASE}/domains/${domain}/subdomains?limit=40`;
  const resp = await axios.get(url, {
    headers: { "x-apikey": apiKey },
    timeout: 15_000,
  });
  const data = resp.data as { data?: Array<{ id?: string }> };
  return (data.data ?? [])
    .map(item => (item.id ?? "").toLowerCase())
    .filter(d => d.endsWith(".tr") && !isExcluded(d));
}

export interface VirusTotalResult {
  runId: number;
  domainsScanned: number;
  subdomainsFound: number;
  addedToLeads: number;
}

export async function runVirusTotalDiscovery(limit = 50): Promise<VirusTotalResult> {
  const apiKey = process.env["VIRUSTOTAL_API_KEY"];
  if (!apiKey) {
    logger.warn("VIRUSTOTAL_API_KEY eksik — VirusTotal subdomain discovery atlanıyor");
    return { runId: 0, domainsScanned: 0, subdomainsFound: 0, addedToLeads: 0 };
  }

  const [run] = await db.insert(discoveryRunsTable).values({
    source: "virustotal_subdomain",
    runParams: { limit },
    status: "running",
  }).returning();

  try {
    const topDomains = await db.select({
      domain: leadCandidatesTable.domain,
    })
      .from(leadCandidatesTable)
      .where(
        and(
          gte(leadCandidatesTable.riskScore, 60),
          gte(leadCandidatesTable.criticalFindings, 0),
        )
      )
      .orderBy(desc(leadCandidatesTable.riskScore))
      .limit(limit);

    let added = 0;
    let subdomainsFound = 0;

    for (const { domain } of topDomains) {
      try {
        const subs = await getSubdomains(domain, apiKey);
        subdomainsFound += subs.length;

        for (const sub of subs) {
          const sector = inferSectorFromDomain(sub);
          const inserted = await db.insert(leadCandidatesTable).values({
            domain: sub,
            sector,
            source: "virustotal_subdomain",
            sourceData: { parentDomain: domain, discoveryMethod: "vt_passive_dns" },
            scanStatus: "pending",
            isMunicipality: sub.endsWith(".bel.tr"),
          }).onConflictDoNothing().returning();
          if (inserted.length > 0) added++;
        }
      } catch (err) {
        logger.warn({ domain, err: String(err) }, "VirusTotal subdomain hatası, devam ediliyor");
      }
      // 4 istek/dakika = 15 saniye bekleme
      await new Promise(r => setTimeout(r, 15_000));
    }

    await db.update(discoveryRunsTable).set({
      status: "completed",
      totalFound: subdomainsFound,
      totalAdded: added,
      completedAt: new Date(),
    }).where(eq(discoveryRunsTable.id, run.id));

    logger.info({ runId: run.id, domainsScanned: topDomains.length, subdomainsFound, added }, "VirusTotal discovery done");
    return { runId: run.id, domainsScanned: topDomains.length, subdomainsFound, addedToLeads: added };
  } catch (err) {
    await db.update(discoveryRunsTable).set({ status: "failed", errorMessage: String(err) })
      .where(eq(discoveryRunsTable.id, run.id));
    throw err;
  }
}
