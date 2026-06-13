/**
 * In-memory günlük API kota takipçisi.
 * Gece yarısında otomatik sıfırlanır (process yaşadığı sürece).
 * Redis gerektirmez — process-local, her restart'ta temiz başlar.
 */
import { logger } from "../lib/logger";

interface QuotaEntry {
  date: string;
  count: number;
}

const quotaMap = new Map<string, QuotaEntry>();

const DAILY_LIMITS: Record<string, number> = {
  shodan: 100,
  virustotal: 500,
  abuseipdb: 1000,
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Verilen servis için kota kontrolü yapar ve kullanıma sayar.
 * @returns true = istek gönderilebilir, false = kota doldu (isteği atla)
 */
export function checkAndConsumeQuota(service: string): boolean {
  const limit = DAILY_LIMITS[service];
  if (limit === undefined) return true;

  const today = todayStr();
  const entry = quotaMap.get(service);

  if (!entry || entry.date !== today) {
    quotaMap.set(service, { date: today, count: 1 });
    return true;
  }

  if (entry.count >= limit) {
    logger.warn({ service, used: entry.count, limit, date: today }, "API günlük kota aşıldı — istek atlanıyor");
    return false;
  }

  entry.count++;
  return true;
}

export interface QuotaStatus {
  used: number;
  limit: number;
  remaining: number;
  date: string;
}

export function getQuotaStatus(): Record<string, QuotaStatus> {
  const today = todayStr();
  const result: Record<string, QuotaStatus> = {};
  for (const [service, limit] of Object.entries(DAILY_LIMITS)) {
    const entry = quotaMap.get(service);
    const used = entry?.date === today ? entry.count : 0;
    result[service] = { used, limit, remaining: Math.max(0, limit - used), date: today };
  }
  return result;
}
