/**
 * SSL ve Mail Reputation Monitoring Servisi
 *
 * domain_scans tablosundaki domainleri periyodik olarak SSL sertifika geçerliliği
 * ve mail güvenlik konfigürasyonu açısından kontrol eder.
 *
 * SSL kontrolleri:
 *   - Sertifika geçerliliği (ssl_is_valid)
 *   - Son kullanma tarihi (ssl_expiry_date, ssl_days_remaining)
 *
 * Mail kontrolleri (0-100 arası skor, 25 puan/kontrol):
 *   - SPF kaydı ve hardfail politikası (mail_spf_valid)
 *   - DKIM hint — apex _domainkey TXT kaydı varlığı (mail_dkim_hint)
 *   - DMARC politikası reject/quarantine (mail_dmarc_valid)
 *   - MX kaydı varlığı (mail_mx_exists)
 *
 * Sonuçlar ssl_checked_at ve mail_checked_at damgasıyla yazılır.
 * SSL: 7 günde bir yeniden kontrol edilir.
 * Mail: 7 günde bir yeniden kontrol edilir.
 */

import * as dns from "dns/promises";
import * as https from "https";
import { db, domainScansTable } from "@workspace/db";
import { sql, isNull, lt, or, eq } from "drizzle-orm";
import { logger } from "../../lib/logger";

// ─── SSL check ────────────────────────────────────────────────────────────────

interface SslResult {
  isValid: boolean;
  expiryDate: Date | null;
  daysRemaining: number | null;
  issuer: string | null;
}

async function checkSsl(domain: string): Promise<SslResult> {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: domain,
        port: 443,
        method: "HEAD",
        timeout: 8000,
        rejectUnauthorized: true,
      },
      (res) => {
        try {
          const cert = (res.socket as { getPeerCertificate?: () => { valid_to?: string; issuer?: { O?: string; CN?: string } } }).getPeerCertificate?.();
          if (cert?.valid_to) {
            const expiry = new Date(cert.valid_to);
            const daysRemaining = Math.floor((expiry.getTime() - Date.now()) / 86400000);
            resolve({
              isValid: daysRemaining > 0,
              expiryDate: expiry,
              daysRemaining,
              issuer: cert.issuer?.O ?? cert.issuer?.CN ?? null,
            });
          } else {
            resolve({ isValid: false, expiryDate: null, daysRemaining: null, issuer: null });
          }
        } catch {
          resolve({ isValid: false, expiryDate: null, daysRemaining: null, issuer: null });
        }
      }
    );
    req.on("error", () => resolve({ isValid: false, expiryDate: null, daysRemaining: null, issuer: null }));
    req.on("timeout", () => { req.destroy(); resolve({ isValid: false, expiryDate: null, daysRemaining: null, issuer: null }); });
    req.end();
  });
}

// ─── Mail checks ──────────────────────────────────────────────────────────────

async function checkSpf(domain: string): Promise<boolean> {
  try {
    const records = await dns.resolveTxt(domain);
    for (const r of records) {
      const joined = r.join("");
      if (joined.startsWith("v=spf1") && joined.includes("-all")) return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function checkDmarc(domain: string): Promise<boolean> {
  try {
    const records = await dns.resolveTxt(`_dmarc.${domain}`);
    for (const r of records) {
      const joined = r.join("");
      if (joined.startsWith("v=DMARC1")) {
        const policy = joined.match(/p=([^;]+)/)?.[1]?.toLowerCase();
        return policy === "reject" || policy === "quarantine";
      }
    }
    return false;
  } catch {
    return false;
  }
}

async function checkMx(domain: string): Promise<boolean> {
  try {
    const records = await dns.resolveMx(domain);
    return records.length > 0;
  } catch {
    return false;
  }
}

/**
 * DKIM hint: apex domain'deki _domainkey TXT kaydı varlığı.
 * Spesifik selector aramaz; genel bir "DKIM altyapısı mevcut mu?" göstergesidir.
 * Selectors: default, google, mail, selector1, selector2 denenir.
 */
async function checkDkimHint(domain: string): Promise<boolean> {
  const QUICK_SELECTORS = ["default", "google", "mail", "selector1", "selector2", "dkim", "k1"];
  const results = await Promise.allSettled(
    QUICK_SELECTORS.map((sel) =>
      dns.resolveTxt(`${sel}._domainkey.${domain}`)
    )
  );
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.length > 0) {
      const found = r.value.some((parts) => parts.join("").includes("v=DKIM1"));
      if (found) return true;
    }
  }
  return false;
}

// ─── Batch runners ────────────────────────────────────────────────────────────

export interface SslMonitorResult {
  processed: number;
  valid: number;
  expiringSoon: number;
  expired: number;
  unreachable: number;
}

export interface MailMonitorResult {
  processed: number;
  avgScore: number;
  perfect: number;
  errors: number;
}

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

/**
 * SSL monitoring — 7 günden eski veya hiç kontrol edilmemiş domainler.
 */
export async function runSslMonitor(batchSize = 30): Promise<SslMonitorResult> {
  const cutoff = new Date(Date.now() - SEVEN_DAYS);

  const rows = await db
    .select({ id: domainScansTable.id, domain: domainScansTable.domain })
    .from(domainScansTable)
    .where(
      or(
        isNull(domainScansTable.sslCheckedAt),
        lt(domainScansTable.sslCheckedAt, cutoff)
      )
    )
    .orderBy(sql`ssl_checked_at NULLS FIRST, created_at DESC`)
    .limit(batchSize);

  logger.info({ count: rows.length }, "SSL monitor: batch başladı");

  let processed = 0;
  let valid = 0;
  let expiringSoon = 0;
  let expired = 0;
  let unreachable = 0;

  for (const row of rows) {
    try {
      const ssl = await checkSsl(row.domain);

      await db
        .update(domainScansTable)
        .set({
          sslCheckedAt: new Date(),
          sslIsValid: ssl.isValid,
          sslExpiryDate: ssl.expiryDate,
          sslDaysRemaining: ssl.daysRemaining,
          // Mevcut sslIssuer kolonunu da güncelle (scan pipeline ile senkron)
          ...(ssl.issuer != null ? { sslIssuer: ssl.issuer } : {}),
        })
        .where(eq(domainScansTable.id, row.id));

      processed++;

      if (ssl.expiryDate === null) {
        unreachable++;
      } else if (!ssl.isValid) {
        expired++;
        logger.warn({ domain: row.domain, daysRemaining: ssl.daysRemaining }, "SSL: sertifika süresi dolmuş");
      } else if ((ssl.daysRemaining ?? 999) <= 30) {
        expiringSoon++;
        logger.info({ domain: row.domain, daysRemaining: ssl.daysRemaining }, "SSL: yakında sona erecek");
      } else {
        valid++;
      }
    } catch (err) {
      logger.warn({ domain: row.domain, err }, "SSL monitor: domain kontrol hatası");
    }
  }

  logger.info({ processed, valid, expiringSoon, expired, unreachable }, "SSL monitor: batch tamamlandı");
  return { processed, valid, expiringSoon, expired, unreachable };
}

/**
 * Mail reputation monitoring — 7 günden eski veya hiç kontrol edilmemiş domainler.
 */
export async function runMailMonitor(batchSize = 50): Promise<MailMonitorResult> {
  const cutoff = new Date(Date.now() - SEVEN_DAYS);

  const rows = await db
    .select({ id: domainScansTable.id, domain: domainScansTable.domain })
    .from(domainScansTable)
    .where(
      or(
        isNull(domainScansTable.mailCheckedAt),
        lt(domainScansTable.mailCheckedAt, cutoff)
      )
    )
    .orderBy(sql`mail_checked_at NULLS FIRST, created_at DESC`)
    .limit(batchSize);

  logger.info({ count: rows.length }, "Mail monitor: batch başladı");

  let processed = 0;
  let totalScore = 0;
  let perfect = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const [spfValid, dmarcValid, mxExists, dkimHint] = await Promise.all([
        checkSpf(row.domain),
        checkDmarc(row.domain),
        checkMx(row.domain),
        checkDkimHint(row.domain),
      ]);

      // Her kontrol 25 puan; toplam 100
      const score = [spfValid, dmarcValid, mxExists, dkimHint].filter(Boolean).length * 25;

      await db
        .update(domainScansTable)
        .set({
          mailCheckedAt: new Date(),
          mailSpfValid: spfValid,
          mailDmarcValid: dmarcValid,
          mailMxExists: mxExists,
          mailDkimHint: dkimHint,
          mailReputationScore: score,
          // Mevcut kolonlarla da senkronize et
          spfPass: spfValid,
          dmarcPass: dmarcValid,
          mxPass: mxExists,
          dkimPass: dkimHint,
        })
        .where(eq(domainScansTable.id, row.id));

      processed++;
      totalScore += score;
      if (score === 100) perfect++;
    } catch (err) {
      errors++;
      logger.warn({ domain: row.domain, err }, "Mail monitor: domain kontrol hatası");
    }
  }

  const avgScore = processed > 0 ? Math.round(totalScore / processed) : 0;
  logger.info({ processed, avgScore, perfect, errors }, "Mail monitor: batch tamamlandı");
  return { processed, avgScore, perfect, errors };
}

// ─── Per-scan helpers (orchestrator için) ─────────────────────────────────────

/**
 * Tek bir domain_scan kaydı için SSL kontrolü yap ve sonucu yaz.
 */
export async function runSslCheck(scanId: number): Promise<void> {
  const [row] = await db
    .select({ id: domainScansTable.id, domain: domainScansTable.domain })
    .from(domainScansTable)
    .where(eq(domainScansTable.id, scanId));
  if (!row) return;

  const ssl = await checkSsl(row.domain);
  await db
    .update(domainScansTable)
    .set({
      sslCheckedAt: new Date(),
      sslIsValid: ssl.isValid,
      sslExpiryDate: ssl.expiryDate,
      sslDaysRemaining: ssl.daysRemaining,
      ...(ssl.issuer != null ? { sslIssuer: ssl.issuer } : {}),
    })
    .where(eq(domainScansTable.id, scanId));
}

/**
 * Tek bir domain_scan kaydı için mail reputation kontrolü yap ve sonucu yaz.
 */
export async function runMailCheck(scanId: number): Promise<void> {
  const [row] = await db
    .select({ id: domainScansTable.id, domain: domainScansTable.domain })
    .from(domainScansTable)
    .where(eq(domainScansTable.id, scanId));
  if (!row) return;

  const [spfValid, dmarcValid, mxExists, dkimHint] = await Promise.all([
    checkSpf(row.domain),
    checkDmarc(row.domain),
    checkMx(row.domain),
    checkDkimHint(row.domain),
  ]);
  const score = [spfValid, dmarcValid, mxExists, dkimHint].filter(Boolean).length * 25;

  await db
    .update(domainScansTable)
    .set({
      mailCheckedAt: new Date(),
      mailSpfValid: spfValid,
      mailDmarcValid: dmarcValid,
      mailMxExists: mxExists,
      mailDkimHint: dkimHint,
      mailReputationScore: score,
      spfPass: spfValid,
      dmarcPass: dmarcValid,
      mxPass: mxExists,
      dkimPass: dkimHint,
    })
    .where(eq(domainScansTable.id, scanId));
}
