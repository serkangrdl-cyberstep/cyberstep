import https from "https";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../../lib/logger";

const CISA_KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
const EPSS_API_HOST = "api.first.org";
const EPSS_BATCH_SIZE = 100;

type EpssEntry = { cve: string; epss: string; percentile: string };
type KevEntry = {
  cveID: string;
  dateAdded?: string;
  dueDate?: string;
  knownRansomwareCampaignUse?: string;
};

function httpsGet(host: string, path: string, timeoutMs = 20000): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get({ host, path, timeout: timeoutMs }, (res) => {
      let data = "";
      res.on("data", (c: Buffer) => { data += c.toString(); });
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
  });
}

async function fetchEpssScores(
  cveIds: string[]
): Promise<Map<string, { epss: number; percentile: number }>> {
  const map = new Map<string, { epss: number; percentile: number }>();

  for (let i = 0; i < cveIds.length; i += EPSS_BATCH_SIZE) {
    const batch = cveIds.slice(i, i + EPSS_BATCH_SIZE);
    const path = `/data/v1/epss?cve=${encodeURIComponent(batch.join(","))}`;

    try {
      const raw = await httpsGet(EPSS_API_HOST, path, 20000);
      const json = JSON.parse(raw) as { data?: EpssEntry[] };
      for (const e of json.data ?? []) {
        map.set(e.cve, { epss: parseFloat(e.epss), percentile: parseFloat(e.percentile) });
      }
    } catch (e) {
      logger.warn({ err: e, batch: batch.slice(0, 3) }, "EPSS batch fetch hatası — bu batch atlanıyor");
    }

    if (i + EPSS_BATCH_SIZE < cveIds.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return map;
}

async function fetchCisaKev(): Promise<
  Map<string, { dateAdded: string; dueDate: string | null; ransomware: boolean }>
> {
  const map = new Map<string, { dateAdded: string; dueDate: string | null; ransomware: boolean }>();

  const rawUrl = new URL(CISA_KEV_URL);
  const raw = await httpsGet(rawUrl.host, rawUrl.pathname, 20000);
  const json = JSON.parse(raw) as { vulnerabilities?: KevEntry[] };

  for (const v of json.vulnerabilities ?? []) {
    map.set(v.cveID, {
      dateAdded: v.dateAdded ?? "",
      dueDate: v.dueDate ?? null,
      ransomware: v.knownRansomwareCampaignUse === "Known",
    });
  }

  return map;
}

/**
 * Verilen CVSS skoru ve EPSS skorunu kullanarak efektif CVE riskini hesaplar.
 *
 * Kural:
 *   - is_kev = true  → her zaman en riskli band (döner: 10)
 *   - epss > 0.5     → CVSS × 1.5 (capped 10) — yüksek aktif istismar olasılığı
 *   - epss < 0.05    → CVSS × 0.6             — düşük gerçek dünya riski
 *   - aksi hâlde     → CVSS (değişmez)
 *
 * Mevcut MITRE eşikleri (80/60/40/0) korunur; bu fonksiyon yalnızca
 * girdiyi zenginleştirir.
 */
export function applyEpssWeighting(
  cvssScore: number,
  epssScore: number | null,
  isKev: boolean
): number {
  if (isKev) return 10;
  if (epssScore === null) return cvssScore;
  if (epssScore > 0.5) return Math.min(10, cvssScore * 1.5);
  if (epssScore < 0.05) return cvssScore * 0.6;
  return cvssScore;
}

export async function syncVulnIntelligence(): Promise<void> {
  logger.info("syncVulnIntelligence başlatılıyor");

  // 1. cve_domain_matches'teki tüm unique CVE ID'leri çek
  let cveIds: string[];
  try {
    const rows = await db.execute(
      sql`SELECT DISTINCT cve_id FROM cve_domain_matches WHERE cve_id IS NOT NULL`
    );
    cveIds = (rows.rows as { cve_id: string }[]).map(r => r.cve_id);
  } catch (e) {
    logger.error({ err: e }, "cve_domain_matches okuma hatası — sync iptal");
    return;
  }

  if (cveIds.length === 0) {
    logger.info("cve_domain_matches'te CVE bulunamadı — sync atlanıyor");
    return;
  }

  logger.info({ count: cveIds.length }, "CVE ID'leri alındı, EPSS + KEV sync başlıyor");

  // 2. EPSS batch fetch (hata durumunda eski cache korunur)
  let epssMap = new Map<string, { epss: number; percentile: number }>();
  try {
    epssMap = await fetchEpssScores(cveIds);
    logger.info({ fetched: epssMap.size }, "EPSS skorları alındı");
  } catch (e) {
    logger.warn({ err: e }, "EPSS fetch başarısız — eski cache korunuyor");
  }

  // 3. CISA KEV fetch (hata durumunda eski cache korunur)
  let kevMap = new Map<string, { dateAdded: string; dueDate: string | null; ransomware: boolean }>();
  try {
    kevMap = await fetchCisaKev();
    logger.info({ kevCount: kevMap.size }, "CISA KEV katalogu alındı");
  } catch (e) {
    logger.warn({ err: e }, "CISA KEV fetch başarısız — eski cache korunuyor");
  }

  // 4. cve_intelligence tablosuna upsert
  const now = new Date();
  let upserted = 0;

  for (const cveId of cveIds) {
    const epss = epssMap.get(cveId);
    const kev = kevMap.get(cveId);

    try {
      await db.execute(sql`
        INSERT INTO cve_intelligence
          (cve_id, epss_score, epss_percentile, epss_updated_at, is_kev,
           kev_date_added, kev_due_date, kev_ransomware_use, updated_at)
        VALUES (
          ${cveId},
          ${epss?.epss ?? null},
          ${epss?.percentile ?? null},
          ${epss ? now : null},
          ${!!kev},
          ${kev?.dateAdded ?? null},
          ${kev?.dueDate ?? null},
          ${kev?.ransomware ?? false},
          ${now}
        )
        ON CONFLICT (cve_id) DO UPDATE SET
          epss_score        = CASE WHEN EXCLUDED.epss_score IS NOT NULL THEN EXCLUDED.epss_score        ELSE cve_intelligence.epss_score        END,
          epss_percentile   = CASE WHEN EXCLUDED.epss_score IS NOT NULL THEN EXCLUDED.epss_percentile   ELSE cve_intelligence.epss_percentile   END,
          epss_updated_at   = CASE WHEN EXCLUDED.epss_score IS NOT NULL THEN EXCLUDED.epss_updated_at   ELSE cve_intelligence.epss_updated_at   END,
          is_kev            = EXCLUDED.is_kev,
          kev_date_added    = EXCLUDED.kev_date_added,
          kev_due_date      = EXCLUDED.kev_due_date,
          kev_ransomware_use = EXCLUDED.kev_ransomware_use,
          updated_at        = EXCLUDED.updated_at
      `);
      upserted++;
    } catch (e) {
      logger.warn({ err: e, cveId }, "cve_intelligence upsert hatası — bu CVE atlanıyor");
    }
  }

  logger.info({ upserted, kevMatches: kevMap.size }, "cve_intelligence upsert tamamlandı");

  // 5. lead_candidates.has_kev_match güncelle
  try {
    await db.execute(sql`
      UPDATE lead_candidates lc
      SET has_kev_match = TRUE
      WHERE has_kev_match = FALSE
        AND EXISTS (
          SELECT 1
          FROM cve_domain_matches cdm
          JOIN cve_intelligence ci ON cdm.cve_id = ci.cve_id
          WHERE cdm.domain = lc.domain
            AND ci.is_kev = TRUE
        )
    `);
    logger.info("lead_candidates.has_kev_match güncellendi");
  } catch (e) {
    logger.warn({ err: e }, "has_kev_match güncelleme hatası");
  }

  logger.info("syncVulnIntelligence tamamlandı");
}
