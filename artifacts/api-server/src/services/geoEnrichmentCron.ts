/**
 * Katman 1 — Coğrafya Enrichment (ip-api.com)
 *
 * Akis: domain -> ip-api.com/json/{domain} -> city + region(il) + ISP
 * ip-api.com single endpoint domain adini dogrudan kabul eder (DNS adimi atlanir).
 * Rate limit: 45 istek/dk (ucretsiz) -> 1.4s throttle -> 50 domain = ~70s/run (6h cron icin uygun).
 * Kural: city zaten doluysa atla (COALESCE korumasi).
 */
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../lib/logger";

const BATCH_SIZE    = 50;
const THROTTLE_MS   = 1_400;   // 45 req/min = 1333ms min; 1400ms = güvenli marj
const API_TIMEOUT   = 8_000;
const IP_API_FIELDS = "status,city,regionName,country,isp";

interface IpApiResult {
  status: string;
  city?: string;
  regionName?: string;
  country?: string;
  isp?: string;
}

async function queryIpApi(domain: string): Promise<IpApiResult | null> {
  try {
    const url = `http://ip-api.com/json/${encodeURIComponent(domain)}?fields=${IP_API_FIELDS}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT);
    try {
      const resp = await fetch(url, { signal: ctrl.signal });
      if (!resp.ok) return null;
      return await resp.json() as IpApiResult;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

export interface GeoEnrichmentResult {
  processed: number;
  enriched: number;
  failures: number;
  topCities: Record<string, number>;
  topRegions: Record<string, number>;
}

export async function runGeoEnrichmentCron(): Promise<GeoEnrichmentResult> {
  // Qualified önce, sadece city IS NULL + geo_enriched_at IS NULL
  const rows = await db.execute<{ id: number; domain: string }>(sql`
    SELECT id, domain
    FROM lead_candidates
    WHERE city IS NULL
      AND geo_enriched_at IS NULL
    ORDER BY is_qualified DESC, id ASC
    LIMIT ${BATCH_SIZE}
  `);

  const candidates = rows.rows;
  if (candidates.length === 0) {
    logger.info("Geo enrichment: islenecek kayit yok");
    return { processed: 0, enriched: 0, failures: 0, topCities: {}, topRegions: {} };
  }

  const topCities: Record<string, number>  = {};
  const topRegions: Record<string, number> = {};
  let enriched  = 0;
  let failures  = 0;

  for (let i = 0; i < candidates.length; i++) {
    const row = candidates[i]!;
    if (i > 0) await new Promise(r => setTimeout(r, THROTTLE_MS));

    const geo = await queryIpApi(row.domain);

    if (!geo || geo.status !== "success") {
      await db.execute(sql`UPDATE lead_candidates SET geo_enriched_at = NOW() WHERE id = ${row.id}`);
      failures++;
      continue;
    }

    const city   = geo.city       ?? null;
    const region = geo.regionName ?? null;
    const isp    = geo.isp        ?? null;

    await db.execute(sql`
      UPDATE lead_candidates SET
        city             = COALESCE(city, ${city}),
        region           = ${region},
        isp_organization = COALESCE(isp_organization, ${isp}),
        geo_enriched_at  = NOW()
      WHERE id = ${row.id}
    `);

    if (city)   { topCities[city]    = (topCities[city]    ?? 0) + 1; enriched++; }
    if (region) { topRegions[region] = (topRegions[region] ?? 0) + 1; }
  }

  logger.info({ processed: candidates.length, enriched, failures, topCities, topRegions },
    "Geo enrichment batch tamamlandi");

  return { processed: candidates.length, enriched, failures, topCities, topRegions };
}
