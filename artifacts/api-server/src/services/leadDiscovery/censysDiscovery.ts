/**
 * Censys tabanlı Türk domain keşfi.
 *
 * CENSYS_API_ID ve CENSYS_API_SECRET env değişkenleri tanımlı değilse erken çıkar.
 * Censys Search API v2 ile .tr TLD'li SSL sertifikalarını tarar,
 * bulunan domain'leri lead_candidates tablosuna ekler.
 *
 * Ücretsiz tier: 250 sorgu/ay — 3 TLD × 1 sorgu/gün = ayda ~90 sorgu.
 * API: https://search.censys.io/api/v2/hosts/search
 */
import axios from "axios";
import { db } from "@workspace/db";
import { discoveryRunsTable, leadCandidatesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { shouldExcludeFromPipeline } from "../leadScoringService";

const CENSYS_SEARCH_URL = "https://search.censys.io/api/v2/hosts/search";
const TR_TLDS = ["com.tr", "net.tr", "org.tr"];

function extractRootDomain(hostname: string): string {
  const clean = hostname.replace(/^\*\./, "").toLowerCase();
  const parts = clean.split(".");
  if (parts[parts.length - 1] === "tr" && parts.length >= 3) return parts.slice(-3).join(".");
  return parts.slice(-2).join(".");
}

function extractDomainsFromHit(hit: Record<string, unknown>): string[] {
  const domains: string[] = [];
  const services = (hit["services"] as Array<Record<string, unknown>> | undefined) ?? [];

  for (const svc of services) {
    const tls = svc["tls"] as Record<string, unknown> | undefined;
    if (!tls) continue;
    const certs = tls["certificates"] as Record<string, unknown> | undefined;
    const leaf = (certs?.["leaf_data"] as Record<string, unknown> | undefined);
    const subject = (leaf?.["subject"] as Record<string, unknown> | undefined);
    const cn = subject?.["common_name"] as string | undefined;
    if (cn && typeof cn === "string" && cn.endsWith(".tr") && !cn.startsWith("*")) {
      domains.push(cn.toLowerCase());
    }
    const names = (leaf?.["names"] as string[] | undefined) ?? [];
    for (const n of names) {
      if (typeof n === "string" && n.endsWith(".tr") && !n.startsWith("*")) {
        domains.push(n.toLowerCase());
      }
    }
  }

  return [...new Set(domains)];
}

export interface CensysDiscoveryResult {
  runId: number;
  domainsFound: number;
  addedToLeads: number;
}

function buildCensysAuth(): { auth?: { username: string; password: string }; headers?: Record<string, string> } | null {
  const singleKey = process.env["CENSYS_API_KEY"];
  const apiId = process.env["CENSYS_API_ID"];
  const apiSecret = process.env["CENSYS_API_SECRET"];

  if (singleKey) {
    return { headers: { Authorization: `Bearer ${singleKey}` } };
  }
  if (apiId && apiSecret) {
    return { auth: { username: apiId, password: apiSecret } };
  }
  return null;
}

export async function runCensysDiscovery(): Promise<CensysDiscoveryResult> {
  const censysAuth = buildCensysAuth();

  if (!censysAuth) {
    logger.info("CENSYS_API_KEY (veya CENSYS_API_ID+SECRET) tanımlı değil — Censys discovery atlanıyor");
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
        const resp = await axios.post(
          CENSYS_SEARCH_URL,
          {
            q: `services.tls.certificates.leaf_data.subject.common_name: "*.${tld}"`,
            per_page: 100,
          },
          {
            ...(censysAuth.auth ? { auth: censysAuth.auth } : {}),
            headers: {
              "User-Agent": "CyberStep-SecurityResearch/1.0",
              ...(censysAuth.headers ?? {}),
            },
            timeout: 20_000,
          },
        );

        const hits = ((resp.data as Record<string, unknown>)?.["result"] as Record<string, unknown>)?.["hits"] as Array<Record<string, unknown>> ?? [];

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
        const status = axios.isAxiosError(err) ? err.response?.status : null;
        logger.warn({ tld, status, err: String(err) }, "Censys: TLD taraması başarısız, devam ediliyor");
      }
    }

    let added = 0;
    for (const domain of discovered) {
      const inserted = await db.insert(leadCandidatesTable).values({
        domain,
        source: "censys",
        sourceData: { discoveryMethod: "censys_ssl_cert" },
        scanStatus: "pending",
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
