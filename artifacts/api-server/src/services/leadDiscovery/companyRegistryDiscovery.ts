/**
 * OpenCorporates API ile Türk şirket kaydı keşfi.
 *
 * API key gerektirmez (ücretsiz tier, rate limit var).
 * Türkiye jurisdiction'ından web sitesi alanı dolu şirketleri çeker,
 * .tr uzantılı domainleri lead_candidates tablosuna ekler.
 *
 * Haftada 1 kez çalışır (Pazartesi 09:00 Istanbul).
 * Endpoint: https://api.opencorporates.com/v0.4/companies/search?jurisdiction_code=tr
 */
import axios from "axios";
import { db } from "@workspace/db";
import { discoveryRunsTable, leadCandidatesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { shouldExcludeFromPipeline } from "../leadScoringService";

const OC_SEARCH_URL = "https://api.opencorporates.com/v0.4/companies/search";
const RATE_LIMIT_MS = 3_000;
const MAX_PAGES = 5;

function extractRootDomain(hostname: string): string {
  const clean = hostname.replace(/^\*\./, "").toLowerCase();
  const parts = clean.split(".");
  if (parts[parts.length - 1] === "tr" && parts.length >= 3) return parts.slice(-3).join(".");
  return parts.slice(-2).join(".");
}

interface OcCompany {
  name?: string;
  company_number?: string;
  registered_address?: { city?: string };
  website?: string;
}

interface OcItem {
  company?: OcCompany;
}

export interface CompanyRegistryResult {
  runId: number;
  companiesScanned: number;
  domainsFound: number;
  addedToLeads: number;
}

export async function runCompanyRegistryDiscovery(): Promise<CompanyRegistryResult> {
  const [run] = await db.insert(discoveryRunsTable).values({
    source: "company_registry",
    runParams: { jurisdiction: "tr", maxPages: MAX_PAGES },
    status: "running",
  }).returning();
  const runId = run!.id;

  try {
    const discovered = new Map<string, { companyName: string; city: string | null }>();
    let companiesScanned = 0;

    for (let page = 1; page <= MAX_PAGES; page++) {
      try {
        const resp = await axios.get(OC_SEARCH_URL, {
          params: {
            jurisdiction_code: "tr",
            per_page: 100,
            page,
          },
          headers: { "User-Agent": "CyberStep-SecurityResearch/1.0" },
          timeout: 15_000,
        });

        const results = (resp.data as Record<string, unknown>)?.["results"] as Record<string, unknown> | undefined;
        const companies = (results?.["companies"] as OcItem[] | undefined) ?? [];

        if (companies.length === 0) break;

        for (const item of companies) {
          companiesScanned++;
          const company = item.company;
          if (!company?.website) continue;

          try {
            const url = new URL(
              company.website.startsWith("http") ? company.website : `https://${company.website}`
            );
            const hostname = url.hostname.replace(/^www\./, "");
            if (!hostname.endsWith(".tr")) continue;

            const root = extractRootDomain(hostname);
            if (!root || root.length < 5) continue;
            if (shouldExcludeFromPipeline(root, null).exclude) continue;

            discovered.set(root, {
              companyName: company.name ?? "",
              city: company.registered_address?.city ?? null,
            });
          } catch {}
        }

        logger.info({ page, companiesScanned, found: discovered.size }, "Company Registry: sayfa tarandı");
        await new Promise(r => setTimeout(r, RATE_LIMIT_MS));

      } catch (err: unknown) {
        const status = axios.isAxiosError(err) ? err.response?.status : null;
        if (status === 429) {
          logger.warn({ page }, "OpenCorporates rate limit aşıldı, tarama durduruluyor");
          break;
        }
        logger.warn({ page, err: String(err) }, "Company Registry: sayfa alınamadı, devam ediliyor");
        break;
      }
    }

    let added = 0;
    for (const [domain, info] of discovered) {
      const inserted = await db.insert(leadCandidatesTable).values({
        domain,
        companyName: info.companyName || null,
        city: info.city,
        source: "company_registry",
        sourceData: { discoveryMethod: "opencorporates", companyName: info.companyName },
        scanStatus: "pending",
      }).onConflictDoUpdate({
        target: leadCandidatesTable.domain,
        set: {
          companyName: sql`COALESCE(lead_candidates.company_name, excluded.company_name)`,
          city: sql`COALESCE(lead_candidates.city, excluded.city)`,
          sourceData: sql`COALESCE(lead_candidates.source_data, excluded.source_data)`,
        },
      }).returning();
      if (inserted.length > 0) added++;
    }

    await db.update(discoveryRunsTable)
      .set({ status: "completed", totalFound: discovered.size, totalAdded: added, completedAt: new Date() })
      .where(eq(discoveryRunsTable.id, runId));

    logger.info({ runId, companiesScanned, domainsFound: discovered.size, added }, "Company Registry discovery tamamlandı");
    return { runId, companiesScanned, domainsFound: discovered.size, addedToLeads: added };

  } catch (err) {
    await db.update(discoveryRunsTable)
      .set({ status: "failed", errorMessage: String(err) })
      .where(eq(discoveryRunsTable.id, runId));
    throw err;
  }
}
