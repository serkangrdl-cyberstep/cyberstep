/**
 * URLScan.io tabanlı Türk domain keşfi.
 * Ücretsiz tier: anonim ~100 istek/gün; API key ile ~1000/gün.
 * Kayıt gerektirmez — API key opsiyonel.
 */
import axios from "axios";
import { db } from "@workspace/db";
import { discoveryRunsTable, leadCandidatesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { inferSectorFromDomain } from "../crtshScanner";

const URLSCAN_BASE = "https://urlscan.io/api/v1";

const EXCLUDED_TLDS = [".gov.tr", ".mil.tr", ".pol.tr"];
const EXCLUDED_DOMAINS = new Set([
  "cloudflare.com", "amazonaws.com", "azure.com", "google.com",
  "microsoft.com", "github.io", "netlify.app", "vercel.app",
]);

function isExcluded(domain: string): boolean {
  const d = domain.toLowerCase();
  if (EXCLUDED_TLDS.some(t => d.endsWith(t))) return true;
  if ([...EXCLUDED_DOMAINS].some(e => d.includes(e))) return true;
  return false;
}

function extractRootDomain(hostname: string): string {
  const parts = hostname.split(".");
  if (parts[parts.length - 1] === "tr" && parts.length >= 3) return parts.slice(-3).join(".");
  return parts.slice(-2).join(".");
}

async function searchUrlScanPage(page: number, apiKey: string | undefined): Promise<string[]> {
  const query = "domain:*.tr NOT domain:*.gov.tr NOT domain:*.mil.tr";
  const url = `${URLSCAN_BASE}/search/?q=${encodeURIComponent(query)}&size=100&offset=${page * 100}`;

  const headers: Record<string, string> = { "User-Agent": "CyberStep-SecurityResearch/1.0" };
  if (apiKey) headers["API-Key"] = apiKey;

  const resp = await axios.get(url, { headers, timeout: 20_000 });
  const results = (resp.data as { results?: Array<{ page?: { domain?: string } }> }).results ?? [];

  const domains: string[] = [];
  for (const r of results) {
    const domain = r.page?.domain?.toLowerCase();
    if (!domain || !domain.endsWith(".tr")) continue;
    if (isExcluded(domain)) continue;
    const root = extractRootDomain(domain);
    if (root && root.includes(".")) domains.push(root);
  }
  return domains;
}

export interface URLScanResult {
  runId: number;
  pagesScanned: number;
  domainsFound: number;
  addedToLeads: number;
}

export async function runUrlscanDiscovery(pages = 5): Promise<URLScanResult> {
  const apiKey = process.env["URLSCAN_API_KEY"] ?? undefined;

  const [run] = await db.insert(discoveryRunsTable).values({
    source: "urlscan",
    runParams: { pages, hasApiKey: !!apiKey },
    status: "running",
  }).returning();

  try {
    const allDomains = new Set<string>();

    for (let page = 0; page < pages; page++) {
      try {
        const batch = await searchUrlScanPage(page, apiKey);
        batch.forEach(d => allDomains.add(d));
      } catch (err) {
        logger.warn({ page, err: String(err) }, "URLScan sayfa hatası, devam ediliyor");
      }
      if (page < pages - 1) await new Promise(r => setTimeout(r, 3000));
    }

    let added = 0;
    for (const domain of allDomains) {
      const sector = inferSectorFromDomain(domain);
      const inserted = await db.insert(leadCandidatesTable).values({
        domain,
        sector,
        source: "urlscan",
        sourceData: { discoveryMethod: "urlscan_search" },
        scanStatus: "pending",
        isMunicipality: domain.endsWith(".bel.tr"),
      }).onConflictDoNothing().returning();
      if (inserted.length > 0) added++;
    }

    await db.update(discoveryRunsTable).set({
      status: "completed",
      totalFound: allDomains.size,
      totalAdded: added,
      completedAt: new Date(),
    }).where(eq(discoveryRunsTable.id, run.id));

    logger.info({ runId: run.id, pages, domainsFound: allDomains.size, added }, "URLScan discovery done");
    return { runId: run.id, pagesScanned: pages, domainsFound: allDomains.size, addedToLeads: added };
  } catch (err) {
    await db.update(discoveryRunsTable).set({ status: "failed", errorMessage: String(err) })
      .where(eq(discoveryRunsTable.id, run.id));
    throw err;
  }
}
