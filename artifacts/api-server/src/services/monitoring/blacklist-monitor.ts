/**
 * Blacklist Monitoring Servisi
 *
 * domain_scans tablosundaki domainleri periyodik olarak blacklist kontrolünden geçirir.
 * Sonuçları blacklist_hits, blacklist_score, blacklist_checked_at kolonlarına yazar.
 *
 * Kontrol edilen listeler:
 *   1. Spamhaus zen.spamhaus.org   (IP tabanlı DNS)
 *   2. SURBL    multi.surbl.org     (domain tabanlı DNS)
 *   3. MXToolbox dnsbl.mxtoolbox.com (IP tabanlı DNS)
 *   4. Google Safe Browsing         (GOOGLE_SAFE_BROWSING_API_KEY varsa)
 *
 * Skor: 100 - 25 * hit_count  →  0 en kötü, 100 temiz
 */

import * as dns from "dns/promises";
import * as https from "https";
import { db, domainScansTable } from "@workspace/db";
import { sql, isNull, lt, or, eq } from "drizzle-orm";
import { logger } from "../../lib/logger";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

async function checkDnsbl(lookup: string): Promise<boolean> {
  try {
    await dns.resolve4(lookup);
    return true;
  } catch {
    return false;
  }
}

async function checkSpamhaus(domain: string): Promise<boolean> {
  const ip = await resolveIp(domain);
  if (!ip) return false;
  return checkDnsbl(`${reverseIp(ip)}.zen.spamhaus.org`);
}

async function checkSurbl(domain: string): Promise<boolean> {
  // SURBL: domain-tabanlı kontrol (apex domain)
  const apex = domain.replace(/^www\./, "");
  return checkDnsbl(`${apex}.multi.surbl.org`);
}

async function checkMxtoolbox(domain: string): Promise<boolean> {
  const ip = await resolveIp(domain);
  if (!ip) return false;
  return checkDnsbl(`${reverseIp(ip)}.dnsbl.mxtoolbox.com`);
}

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
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
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

// ─── Core check ───────────────────────────────────────────────────────────────

interface BlacklistHits {
  spamhaus: boolean;
  google_safebrowsing: boolean;
  surbl: boolean;
  mxtoolbox: boolean;
  hit_count: number;
}

async function runSingleDomain(domain: string): Promise<{ hits: BlacklistHits; score: number }> {
  const [spamhaus, surbl, mxtoolbox, google_safebrowsing] = await Promise.all([
    checkSpamhaus(domain),
    checkSurbl(domain),
    checkMxtoolbox(domain),
    checkGoogleSafeBrowsing(domain),
  ]);

  const hit_count = [spamhaus, surbl, mxtoolbox, google_safebrowsing].filter(Boolean).length;
  const score = Math.max(0, 100 - hit_count * 25);

  return {
    hits: { spamhaus, google_safebrowsing, surbl, mxtoolbox, hit_count },
    score,
  };
}

// ─── Batch runner ─────────────────────────────────────────────────────────────

export interface BlacklistMonitorResult {
  processed: number;
  clean: number;
  listed: number;
  errors: number;
}

/**
 * Blacklist checked olmayan veya 24 saatten eski domainleri kontrol eder.
 * Her çalışmada en fazla `batchSize` domain işler.
 */
export async function runBlacklistMonitor(batchSize = 50): Promise<BlacklistMonitorResult> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const rows = await db
    .select({ id: domainScansTable.id, domain: domainScansTable.domain })
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
      const { hits, score } = await runSingleDomain(row.domain);

      await db
        .update(domainScansTable)
        .set({
          blacklistCheckedAt: new Date(),
          blacklistHits: hits,
          blacklistScore: score,
        })
        .where(eq(domainScansTable.id, row.id));

      processed++;
      if (hits.hit_count === 0) {
        clean++;
      } else {
        listed++;
        logger.warn({ domain: row.domain, hits, score }, "Blacklist: domain listede bulundu");
      }
    } catch (err) {
      errors++;
      logger.warn({ domain: row.domain, err }, "Blacklist monitor: domain kontrol hatası");
    }
  }

  logger.info({ processed, clean, listed, errors }, "Blacklist monitor: batch tamamlandı");
  return { processed, clean, listed, errors };
}
