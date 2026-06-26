/**
 * Blacklist Monitoring Servisi
 *
 * runBlacklistCheck(domainScanId): belirtilen tarama için blacklist kontrolü yapar.
 * runBlacklistMonitor(batchSize): cron çağrısı — kontrol edilmemiş/eski domainleri işler.
 *
 * Kontrol edilen kaynaklar:
 *   1. Spamhaus ZEN   — DNS: {reversed_ip}.zen.spamhaus.org  (herhangi yanıt = listede)
 *   2. Google Safe Browsing API v4 — GOOGLE_SAFE_BROWSING_API_KEY gerekir
 *   3. SURBL          — DNS: {domain}.multi.surbl.org          (herhangi yanıt = listede)
 *   4. MXToolbox      — MXTOOLBOX_API_KEY yoksa null (atlanır)
 *
 * Skor mantığı:
 *   0 isabet → 100 (temiz)
 *   1 isabet → 50
 *   2 isabet → 20
 *   3+ isabet → 0
 *
 * Skor < 50 ise domain_scan_alerts tablosuna severity='high' kaydı oluşturulur.
 */

import * as dns from "dns/promises";
import * as https from "https";
import { db, domainScansTable, domainScanAlertsTable } from "@workspace/db";
import { sql, isNull, lt, or, eq } from "drizzle-orm";
import { logger } from "../../lib/logger";

// ─── Skor tablosu ─────────────────────────────────────────────────────────────

function calcBlacklistScore(hitCount: number): number {
  if (hitCount === 0) return 100;
  if (hitCount === 1) return 50;
  if (hitCount === 2) return 20;
  return 0;
}

// ─── DNS yardımcıları ─────────────────────────────────────────────────────────

async function resolveIp(domain: string): Promise<string | null> {
  try {
    const addrs = await dns.resolve4(domain);
    return addrs[0] ?? null;
  } catch {
    return null;
  }
}

function reverseIp(ip: string): string {
  return ip.split(".").reverse().join(".");
}

async function dnsListed(lookup: string): Promise<boolean> {
  try {
    await dns.resolve4(lookup);
    return true; // herhangi bir yanıt = listede
  } catch {
    return false;
  }
}

// ─── Kaynak kontrolleri ───────────────────────────────────────────────────────

/**
 * 1. Spamhaus ZEN — IP tabanlı DNS lookup
 */
async function checkSpamhaus(ip: string): Promise<boolean> {
  return dnsListed(`${reverseIp(ip)}.zen.spamhaus.org`);
}

/**
 * 2. Google Safe Browsing API v4 — GOOGLE_SAFE_BROWSING_API_KEY gerekir
 */
async function checkGoogleSafeBrowsing(domain: string): Promise<boolean> {
  const apiKey = process.env["GOOGLE_SAFE_BROWSING_API_KEY"];
  if (!apiKey) return false;

  return new Promise((resolve) => {
    const body = JSON.stringify({
      client: { clientId: "cyberstep-monitor", clientVersion: "1.0" },
      threatInfo: {
        threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"],
        platformTypes: ["ANY_PLATFORM"],
        threatEntryTypes: ["URL"],
        threatEntries: [{ url: `https://${domain}/` }],
      },
    });

    const req = https.request(
      {
        hostname: "safebrowsing.googleapis.com",
        path: `/v4/threatMatches:find?key=${encodeURIComponent(apiKey)}`,
        method: "POST",
        timeout: 8000,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data) as { matches?: unknown[] };
            resolve((parsed.matches ?? []).length > 0);
          } catch {
            resolve(false);
          }
        });
      }
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
    req.write(body);
    req.end();
  });
}

/**
 * 3. SURBL — domain tabanlı DNS lookup
 */
async function checkSurbl(domain: string): Promise<boolean> {
  const apex = domain.replace(/^www\./, "");
  return dnsListed(`${apex}.multi.surbl.org`);
}

/**
 * 4. MXToolbox — MXTOOLBOX_API_KEY yoksa null (atlanır)
 *    API: GET https://mxtoolbox.com/api/v1/lookup/blacklist/{domain}
 */
async function checkMxtoolbox(domain: string): Promise<boolean | null> {
  const apiKey = process.env["MXTOOLBOX_API_KEY"];
  if (!apiKey) return null;

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: "mxtoolbox.com",
        path: `/api/v1/lookup/blacklist/${encodeURIComponent(domain)}`,
        method: "GET",
        timeout: 10000,
        headers: {
          Authorization: apiKey,
          "User-Agent": "CyberStep.io Security Monitor/1.0",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data) as { Failed?: unknown[] };
            resolve((parsed.Failed ?? []).length > 0);
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
    req.end();
  });
}

// ─── Yardımcı: alert kaydı ────────────────────────────────────────────────────

async function createBlacklistAlert(
  scanId: number,
  domain: string,
  hits: BlacklistHits,
  score: number
): Promise<void> {
  try {
    await db.insert(domainScanAlertsTable).values({
      scanId,
      domain,
      alertType: "blacklist",
      severity: "high",
      title: `Blacklist uyarısı: ${domain} (skor: ${score}/100)`,
      details: hits,
    });
    logger.warn({ scanId, domain, score, hitCount: hits.hit_count }, "Blacklist alert oluşturuldu");
  } catch (err) {
    logger.warn({ err, scanId, domain }, "Blacklist alert kaydedilemedi");
  }
}

// ─── Tipler ───────────────────────────────────────────────────────────────────

interface BlacklistHits {
  spamhaus: boolean;
  google_safebrowsing: boolean;
  surbl: boolean;
  mxtoolbox: boolean | null;  // null = API key yok, atlandı
  hit_count: number;
}

// ─── Ana kontrol fonksiyonu ───────────────────────────────────────────────────

/**
 * Tek bir domain_scans kaydı için blacklist kontrolü yapar.
 * origin_ip ve domain alanlarını domain_scans'ten okur.
 * Sonuçları blacklist_hits, blacklist_score, blacklist_checked_at'e yazar.
 * Skor < 50 ise domain_scan_alerts tablosuna severity='high' kaydı oluşturur.
 */
export async function runBlacklistCheck(domainScanId: number): Promise<void> {
  // domain_scans'ten oku; lead_candidates JOIN ile şirket adı (bilgi amaçlı)
  const rows = await db.execute<{
    id: number;
    domain: string;
    origin_ip: string | null;
    email: string | null;
    company_name: string | null;
  }>(sql`
    SELECT
      ds.id,
      ds.domain,
      ds.origin_ip,
      ds.email,
      lc.company_name
    FROM domain_scans ds
    LEFT JOIN lead_candidates lc ON lc.domain = ds.domain
    WHERE ds.id = ${domainScanId}
    LIMIT 1
  `);

  const row = rows.rows[0];
  if (!row) {
    logger.warn({ domainScanId }, "runBlacklistCheck: tarama bulunamadı");
    return;
  }

  const { domain } = row;

  // IP: origin_ip mevcutsa kullan, yoksa DNS'ten çöz
  const ip: string | null = row.origin_ip ?? await resolveIp(domain);

  // Paralel kontroller
  const [spamhaus, googleSb, surbl, mxtoolbox] = await Promise.all([
    ip ? checkSpamhaus(ip) : Promise.resolve(false),
    checkGoogleSafeBrowsing(domain),
    checkSurbl(domain),
    checkMxtoolbox(domain),
  ]);

  // Sadece non-null sonuçları say (null = atlandı)
  const activeSources = [spamhaus, googleSb, surbl, mxtoolbox].filter((v) => v !== null) as boolean[];
  const hit_count = activeSources.filter(Boolean).length;
  const score = calcBlacklistScore(hit_count);

  const hits: BlacklistHits = {
    spamhaus,
    google_safebrowsing: googleSb,
    surbl,
    mxtoolbox,
    hit_count,
  };

  // DB'ye yaz
  await db
    .update(domainScansTable)
    .set({
      blacklistCheckedAt: new Date(),
      blacklistHits: hits,
      blacklistScore: score,
    })
    .where(eq(domainScansTable.id, domainScanId));

  // Skor < 50 → alert oluştur
  if (score < 50) {
    await createBlacklistAlert(domainScanId, domain, hits, score);
  }

  logger.info(
    { domainScanId, domain, ip, hit_count, score },
    "runBlacklistCheck tamamlandı"
  );
}

// ─── Cron batch runner ────────────────────────────────────────────────────────

export interface BlacklistMonitorResult {
  processed: number;
  clean: number;
  listed: number;
  errors: number;
}

/**
 * Cron için toplu çalıştırıcı.
 * 24 saatten eski veya hiç kontrol edilmemiş domainleri işler.
 */
export async function runBlacklistMonitor(batchSize = 50): Promise<BlacklistMonitorResult> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const rows = await db
    .select({ id: domainScansTable.id })
    .from(domainScansTable)
    .where(
      or(
        isNull(domainScansTable.blacklistCheckedAt),
        lt(domainScansTable.blacklistCheckedAt, cutoff)
      )
    )
    .orderBy(sql`blacklist_checked_at NULLS FIRST, created_at DESC`)
    .limit(batchSize);

  logger.info({ count: rows.length }, "Blacklist monitor: batch başladı");

  let processed = 0;
  let clean = 0;
  let listed = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      // Mevcut skoru kontrol için önce oku
      const before = await db
        .select({ score: domainScansTable.blacklistScore, domain: domainScansTable.domain })
        .from(domainScansTable)
        .where(eq(domainScansTable.id, row.id))
        .limit(1);

      await runBlacklistCheck(row.id);

      // Sonucu oku
      const after = await db
        .select({ score: domainScansTable.blacklistScore })
        .from(domainScansTable)
        .where(eq(domainScansTable.id, row.id))
        .limit(1);

      processed++;
      const finalScore = after[0]?.score ?? 100;
      if (finalScore === 100) {
        clean++;
      } else {
        listed++;
        logger.info({ domain: before[0]?.domain, score: finalScore }, "Blacklist: domain listede");
      }
    } catch (err) {
      errors++;
      logger.warn({ scanId: row.id, err }, "Blacklist monitor: işlem hatası");
    }
  }

  logger.info({ processed, clean, listed, errors }, "Blacklist monitor: batch tamamlandı");
  return { processed, clean, listed, errors };
}
