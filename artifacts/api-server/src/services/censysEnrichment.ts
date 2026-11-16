/**
 * Censys Platform host lookup ile güncel açık servis doğrulaması.
 * Shodan verisi eski olabildiği için, domain'in çözümlendiği IP'ler Censys'ten
 * (Free hesapta açık olan lookup endpoint'iyle) tekrar sorgulanır.
 *
 * Kimlik: CENSYS_API_TOKEN (bkz. censysPlatform.ts)
 * Kota: Free hesapta aylık 100 kredi; domain başına en fazla MAX_IPS lookup.
 */

import dns from "node:dns/promises";
import { logger } from "../lib/logger";
import {
  CensysApiError,
  censysHostLookup,
  getCensysToken,
  isCensysConfigured,
} from "./censysPlatform";

export { isCensysConfigured };

const MAX_IPS = 2;

export interface CensysRelatedHost {
  ip: string;
  /** Censys'in bu hosta ait en son tarama zamanı (ISO) */
  lastSeen?: string | null;
  ports: number[];
  services: string[];
  countryCode: string | null;
  city: string | null;
  isSameAsKnown: boolean;
}

export interface CensysResult {
  relatedHosts: CensysRelatedHost[];
  totalFound: number;
  queryDomain: string;
}

function toRelatedHost(
  ip: string,
  host: Record<string, unknown>,
  knownIp?: string | null,
): CensysRelatedHost {
  const svcs = (host["services"] as Array<Record<string, unknown>> | undefined) ?? [];
  const ports = svcs
    .map((s) => s["port"])
    .filter((p): p is number => typeof p === "number");
  const services = svcs
    .map((s) => s["protocol"] ?? s["extended_service_name"] ?? s["service_name"])
    .filter((s): s is string => typeof s === "string")
    .filter((s, i, arr) => arr.indexOf(s) === i);
  const times = svcs
    .map((s) => s["scan_time"])
    .filter((t): t is string => typeof t === "string")
    .sort();
  const loc = host["location"] as Record<string, unknown> | undefined;

  return {
    ip,
    lastSeen: times.length ? times[times.length - 1]! : null,
    ports,
    services,
    countryCode: typeof loc?.["country_code"] === "string" ? (loc["country_code"] as string) : null,
    city: typeof loc?.["city"] === "string" ? (loc["city"] as string) : null,
    isSameAsKnown: knownIp != null && ip === knownIp,
  };
}

export async function enrichWithCensys(
  domain: string,
  knownIp?: string | null,
): Promise<CensysResult | null> {
  if (!isCensysConfigured()) {
    logger.debug({ domain }, "censysEnrichment: API token yok, atlanıyor");
    return null;
  }

  let ips: string[] = [];
  try {
    ips = (await dns.resolve4(domain)).slice(0, MAX_IPS);
  } catch {
    logger.debug({ domain }, "censysEnrichment: A kaydı çözülemedi");
    return null;
  }
  if (ips.length === 0) return null;

  const relatedHosts: CensysRelatedHost[] = [];
  for (const ip of ips) {
    try {
      const host = await censysHostLookup(ip);
      if (host) relatedHosts.push(toRelatedHost(ip, host, knownIp ?? ips[0]));
    } catch (err) {
      // Ayrıntı censysPlatform içinde günlüğe yazıldı; yetki/kota hatasında dur
      const status = err instanceof CensysApiError ? err.status : undefined;
      if (status === 401 || status === 403 || status === 429) break;
    }
  }

  logger.info({ domain, ips: ips.length, found: relatedHosts.length }, "censysEnrichment: tamamlandı");
  return relatedHosts.length
    ? { relatedHosts, totalFound: relatedHosts.length, queryDomain: domain }
    : null;
}

export async function testCensysConnection(): Promise<{
  ok: boolean;
  message: string;
}> {
  if (!getCensysToken()) {
    return { ok: false, message: "CENSYS_API_TOKEN eksik." };
  }
  try {
    const host = await censysHostLookup("8.8.8.8");
    return {
      ok: true,
      message: host
        ? "Bağlantı başarılı: host lookup çalışıyor (Free hesapta açık olan endpoint)."
        : "Token geçerli, ancak test IP'si için kayıt dönmedi.",
    };
  } catch (err) {
    const status = err instanceof CensysApiError ? err.status : undefined;
    const detail = err instanceof Error ? err.message : String(err);
    if (status === 401) return { ok: false, message: `Token geçersiz. ${detail}` };
    if (status === 403) {
      return { ok: false, message: `Token geçerli ama bu endpoint'e yetkili değil. ${detail}` };
    }
    return { ok: false, message: `Bağlantı hatası. ${detail}` };
  }
}
