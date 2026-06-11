/**
 * Netcraft tabanlı Türk domain keşfi.
 *
 * NETCRAFT_API_KEY env değişkeni ayarlanmamışsa fonksiyon erken çıkar.
 * API key mevcutsa Netcraft domain arama API'si ile Türk TLD'lerini tarar,
 * bulunan domain'leri lead_candidates tablosuna ekler.
 *
 * Endpoint: GET https://api.netcraft.com/v1/search/domains?domain=*.com.tr&per_page=100
 */
import axios from "axios";
import { db } from "@workspace/db";
import { discoveryRunsTable, leadCandidatesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { shouldExcludeFromPipeline } from "../leadScoringService";

const NETCRAFT_BASE = "https://api.netcraft.com/v1/search/domains";
const TR_TLDS = [".com.tr", ".net.tr", ".org.tr", ".web.tr", ".biz.tr"];

function extractRootDomain(hostname: string): string {
  const clean = hostname.replace(/^\*\./, "").toLowerCase();
  const parts = clean.split(".");
  if (parts[parts.length - 1] === "tr" && parts.length >= 3) return parts.slice(-3).join(".");
  return parts.slice(-2).join(".");
}

export interface NetcraftDiscoveryResult {
  runId: number;
  domainsFound: number;
  addedToLeads: number;
}

export async function runNetcraftDiscovery(): Promise<NetcraftDiscoveryResult> {
  const apiKey = process.env["NETCRAFT_API_KEY"];
  if (!apiKey) {
    logger.info("NETCRAFT_API_KEY tanımlı değil — Netcraft discovery atlanıyor");
    return { runId: 0, domainsFound: 0, addedToLeads: 0 };
  }

  const [run] = await db.insert(discoveryRunsTable).values({
    source: "netcraft",
    runParams: { tlds: TR_TLDS },
    status: "running",
  }).returning();
  const runId = run!.id;

  try {
    const discovered = new Set<string>();

    for (const tld of TR_TLDS) {
      try {
        const resp = await axios.get(NETCRAFT_BASE, {
          params: { domain: `*${tld}`, per_page: 100 },
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "User-Agent": "CyberStep-SecurityResearch/1.0",
          },
          timeout: 15_000,
        });

        const items: Array<{ name?: string; hostname?: string }> =
          Array.isArray(resp.data?.data)
            ? resp.data.data
            : Array.isArray(resp.data?.results)
              ? resp.data.results
              : [];

        for (const item of items) {
          const rawDomain = (item.name ?? item.hostname ?? "").toLowerCase();
          if (!rawDomain) continue;
          const root = extractRootDomain(rawDomain);
          if (!root || root.length < 5) continue;
          if (!TR_TLDS.some((t) => root.endsWith(t))) continue;
          if (shouldExcludeFromPipeline(root, null).exclude) continue;
          discovered.add(root);
        }

        await new Promise((r) => setTimeout(r, 2_000));
      } catch (err) {
        logger.warn({ tld, err: String(err) }, "Netcraft TLD taraması başarısız, devam ediliyor");
      }
    }

    let added = 0;
    const domainArr = [...discovered];
    const CHUNK = 50;
    for (let i = 0; i < domainArr.length; i += CHUNK) {
      const chunk = domainArr.slice(i, i + CHUNK);
      const inserted = await db.insert(leadCandidatesTable)
        .values(chunk.map((domain) => ({
          domain,
          source: "netcraft",
          scanStatus: "pending" as const,
          sourceData: { discoveryMethod: "netcraft_api", tld: TR_TLDS.find((t) => domain.endsWith(t)) ?? "" },
        })))
        .onConflictDoUpdate({
          target: leadCandidatesTable.domain,
          set: { sourceData: sql`COALESCE(lead_candidates.source_data, excluded.source_data)` },
        })
        .returning({ id: leadCandidatesTable.id })
        .catch(() => [] as { id: number }[]);
      added += inserted.length;
    }

    await db.update(discoveryRunsTable)
      .set({ status: "completed", totalFound: discovered.size, totalAdded: added, completedAt: new Date() })
      .where(eq(discoveryRunsTable.id, runId));

    logger.info({ runId, domainsFound: discovered.size, added }, "Netcraft discovery tamamlandı");
    return { runId, domainsFound: discovered.size, addedToLeads: added };

  } catch (err) {
    await db.update(discoveryRunsTable)
      .set({ status: "failed", errorMessage: String(err) })
      .where(eq(discoveryRunsTable.id, runId));
    logger.error({ err, runId }, "Netcraft discovery başarısız");
    throw err;
  }
}
