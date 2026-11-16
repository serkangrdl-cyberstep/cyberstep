/**
 * Censys tabanlı Türk domain keşfi.
 *
 * CENSYS_API_TOKEN tanımlı değilse erken çıkar.
 * Censys Platform API ile .tr TLD'li SSL sertifikalarını tarar,
 * bulunan domain'leri lead_candidates tablosuna ekler.
 *
 * API: POST https://api.platform.censys.io/v3/global/search/query
 */
import { db } from "@workspace/db";
import { discoveryRunsTable, leadCandidatesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { shouldExcludeFromPipeline } from "../leadScoringService";
import { CensysApiError, censysSearch, isCensysConfigured, unwrapHit } from "../censysPlatform";

const TR_TLDS = ["com.tr", "net.tr", "org.tr", "bel.tr"];

function extractRootDomain(hostname: string): string {
  const clean = hostname.replace(/^\*\./, "").toLowerCase();
  const parts = clean.split(".");
  if (parts[parts.length - 1] === "tr" && parts.length >= 3) return parts.slice(-3).join(".");
  return parts.slice(-2).join(".");
}

/** Sertifika kaydındaki .tr isimlerini çıkarır (şema farklarına toleranslı). */
function extractDomainsFromHit(hit: Record<string, unknown>): string[] {
  const cert = unwrapHit(hit, "certificate_v1");
  if (!cert) return [];
  const out: string[] = [];
  const names = cert["names"];
  if (Array.isArray(names)) for (const n of names) if (typeof n === "string") out.push(n);
  const parsed = cert["parsed"] as Record<string, unknown> | undefined;
  const cn = (parsed?.["subject"] as Record<string, unknown> | undefined)?.["common_name"];
  if (Array.isArray(cn)) {
    for (const n of cn) if (typeof n === "string") out.push(n);
  } else if (typeof cn === "string") {
    out.push(cn);
  }
  return [...new Set(out.map((n) => n.toLowerCase()).filter((n) => n.endsWith(".tr") && !n.startsWith("*")))];
}

export interface CensysDiscoveryResult {
  runId: number;
  domainsFound: number;
  addedToLeads: number;
}

export async function runCensysDiscovery(): Promise<CensysDiscoveryResult> {
  if (!isCensysConfigured()) {
    logger.info("CENSYS_API_TOKEN tanımlı değil — Censys discovery atlanıyor");
    return { runId: 0, domainsFound: 0, addedToLeads: 0 };
  }

  const [run] = await db.insert(discoveryRunsTable).values({
    source: "censys",
    runParams: { tlds: TR_TLDS },
    status: "running",
  }).returning();
  const runId = run!.id;

  try {
    const discovered = new Set<string>();

    for (const tld of TR_TLDS) {
      try {
        const { hits } = await censysSearch(`cert.names = "${tld}"`, 100);

        for (const hit of hits) {
          for (const domain of extractDomainsFromHit(hit)) {
            const root = extractRootDomain(domain);
            if (!root || root.length < 5) continue;
            if (shouldExcludeFromPipeline(root, null).exclude) continue;
            discovered.add(root);
          }
        }

        logger.info({ tld, hits: hits.length }, "Censys: TLD taraması tamamlandı");
        await new Promise(r => setTimeout(r, 2_000));
      } catch (err: unknown) {
        const status = err instanceof CensysApiError ? err.status : null;
        logger.warn({ tld, status, err: String(err) }, "Censys: TLD taraması başarısız, devam ediliyor");
        // Yetki/kota sorunu tüm TLD'lerde tekrarlanır; boşuna devam etme
        if (status === 401 || status === 403 || status === 429) break;
      }
    }

    let added = 0;
    for (const domain of discovered) {
      const inserted = await db.insert(leadCandidatesTable).values({
        domain,
        source: "censys",
        sourceData: { discoveryMethod: "censys_ssl_cert" },
        scanStatus: "pending",
        isMunicipality: domain.endsWith(".bel.tr"),
      }).onConflictDoUpdate({
        target: leadCandidatesTable.domain,
        set: {
          sourceData: sql`COALESCE(lead_candidates.source_data, excluded.source_data)`,
        },
      }).returning();
      if (inserted.length > 0) added++;
    }

    await db.update(discoveryRunsTable)
      .set({ status: "completed", totalFound: discovered.size, totalAdded: added, completedAt: new Date() })
      .where(eq(discoveryRunsTable.id, runId));

    logger.info({ runId, domainsFound: discovered.size, added }, "Censys discovery tamamlandı");
    return { runId, domainsFound: discovered.size, addedToLeads: added };

  } catch (err) {
    await db.update(discoveryRunsTable)
      .set({ status: "failed", errorMessage: String(err) })
      .where(eq(discoveryRunsTable.id, runId));
    throw err;
  }
}
