/**
 * Censys Platform sertifika-isim zenginleştirme servisi.
 * Domain için SSL sertifikası sunan IP'leri Censys Platform API'siyle bulur.
 * Gizli altyapı, paylaşımlı hosting ve shadow IT tespitinde kullanılır.
 *
 * Kimlik: CENSYS_API_TOKEN (bkz. censysPlatform.ts)
 * Sorgu: host.services.cert.names = "{domain}"
 */

import { logger } from "../lib/logger";
import {
  CensysApiError,
  censysSearch,
  getCensysToken,
  isCensysConfigured,
  unwrapHit,
} from "./censysPlatform";

export { isCensysConfigured };

export interface CensysRelatedHost {
  ip: string;
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
  hit: Record<string, unknown>,
  knownIp?: string | null,
): CensysRelatedHost | null {
  const host = unwrapHit(hit, "host_v1");
  if (!host) return null;
  const ip = typeof host["ip"] === "string" ? (host["ip"] as string) : null;
  if (!ip) return null;

  const svcs = (host["services"] as Array<Record<string, unknown>> | undefined) ?? [];
  const ports = svcs
    .map((s) => s["port"])
    .filter((p): p is number => typeof p === "number");
  const services = svcs
    .map((s) => s["protocol"] ?? s["extended_service_name"] ?? s["service_name"])
    .filter((s): s is string => typeof s === "string")
    .filter((s, i, arr) => arr.indexOf(s) === i);
  const loc = host["location"] as Record<string, unknown> | undefined;

  return {
    ip,
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

  const safe = domain.replace(/[^a-zA-Z0-9.\-]/g, "");
  try {
    const { hits, total } = await censysSearch(`host.services.cert.names = "${safe}"`, 20);
    const relatedHosts = hits
      .map((h) => toRelatedHost(h, knownIp))
      .filter((h): h is CensysRelatedHost => h !== null);

    logger.info(
      { domain, totalFound: total, returned: relatedHosts.length },
      "censysEnrichment: tamamlandı",
    );
    return { relatedHosts, totalFound: total, queryDomain: domain };
  } catch (err) {
    // Ayrıntı censysPlatform içinde zaten günlüğe yazıldı
    if (!(err instanceof CensysApiError)) {
      logger.warn({ domain, err: String(err) }, "censysEnrichment: hata");
    }
    return null;
  }
}

export async function testCensysConnection(): Promise<{
  ok: boolean;
  message: string;
}> {
  if (!getCensysToken()) {
    return { ok: false, message: "CENSYS_API_TOKEN eksik." };
  }
  try {
    const { total } = await censysSearch('host.ip = "8.8.8.8"', 1);
    return { ok: true, message: `Bağlantı başarılı (arama endpoint'i çalışıyor, ${total} sonuç).` };
  } catch (err) {
    const status = err instanceof CensysApiError ? err.status : undefined;
    const detail = err instanceof Error ? err.message : String(err);
    if (status === 401) return { ok: false, message: `Token geçersiz. ${detail}` };
    if (status === 403) {
      return { ok: false, message: `Token geçerli ama bu hesap arama API'sine yetkili değil (Free kısıtı olabilir). ${detail}` };
    }
    return { ok: false, message: `Bağlantı hatası. ${detail}` };
  }
}
