/**
 * Censys v2 SSL sertifika parmak izi zenginleştirme servisi.
 * Domain için SSL sertifikası sunan tüm IP'leri Censys Search API'siyle bulur.
 * Gizli altyapı, paylaşımlı hosting ve shadow IT tespitinde kullanılır.
 *
 * Kimlik: CENSYS_API_ID + CENSYS_API_SECRET (Basic Auth)
 * Endpoint: GET /v2/hosts/search?q=services.tls.certificates.leaf_data.names:{domain}
 */

import axios from "axios";
import { logger } from "../lib/logger";

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

interface CensysHit {
  ip?: string;
  services?: Array<{
    port?: number;
    transport_protocol?: string;
    service_name?: string;
    extended_service_name?: string;
  }>;
  location?: {
    country_code?: string;
    city?: string;
  };
}

interface CensysSearchResponse {
  result?: {
    hits?: CensysHit[];
    total?: number;
  };
}

function getCredentials(): { id: string; secret: string } | null {
  const id = process.env["CENSYS_API_ID"];
  const secret = process.env["CENSYS_API_SECRET"];
  if (!id || !secret) return null;
  return { id, secret };
}

export function isCensysConfigured(): boolean {
  return getCredentials() !== null;
}

export async function enrichWithCensys(
  domain: string,
  knownIp?: string | null,
): Promise<CensysResult | null> {
  const creds = getCredentials();
  if (!creds) {
    logger.debug({ domain }, "censysEnrichment: API kimliği yok, atlanıyor");
    return null;
  }

  const query = `services.tls.certificates.leaf_data.names:${domain}`;

  try {
    const resp = await axios.get<CensysSearchResponse>(
      "https://search.censys.io/api/v2/hosts/search",
      {
        params: { q: query, per_page: 20, virtual_hosts: "INCLUDE" },
        auth: { username: creds.id, password: creds.secret },
        timeout: 15_000,
        headers: { "User-Agent": "CyberStep.io/1.0 SecurityResearch" },
      },
    );

    const hits = resp.data?.result?.hits ?? [];
    const total = resp.data?.result?.total ?? 0;

    const relatedHosts: CensysRelatedHost[] = hits.map((hit) => {
      const ports = (hit.services ?? [])
        .map((s) => s.port)
        .filter((p): p is number => typeof p === "number");

      const services = (hit.services ?? [])
        .map((s) => s.extended_service_name ?? s.service_name)
        .filter((s): s is string => typeof s === "string")
        .filter((s, i, arr) => arr.indexOf(s) === i);

      return {
        ip: hit.ip ?? "bilinmiyor",
        ports,
        services,
        countryCode: hit.location?.country_code ?? null,
        city: hit.location?.city ?? null,
        isSameAsKnown: knownIp != null && hit.ip === knownIp,
      };
    });

    logger.info(
      { domain, totalFound: total, returned: relatedHosts.length },
      "censysEnrichment: tamamlandı",
    );

    return { relatedHosts, totalFound: total, queryDomain: domain };
  } catch (err: unknown) {
    const status =
      axios.isAxiosError(err) ? err.response?.status : undefined;
    if (status === 401 || status === 403) {
      logger.warn({ domain }, "censysEnrichment: kimlik doğrulama hatası — API kimliği geçersiz");
    } else if (status === 429) {
      logger.warn({ domain }, "censysEnrichment: rate limit aşıldı");
    } else {
      logger.warn({ domain, err: String(err) }, "censysEnrichment: hata");
    }
    return null;
  }
}

export async function testCensysConnection(): Promise<{
  ok: boolean;
  quota?: { used: number; allowance: number };
  message: string;
}> {
  const creds = getCredentials();
  if (!creds) {
    return { ok: false, message: "CENSYS_API_ID veya CENSYS_API_SECRET eksik." };
  }

  try {
    const resp = await axios.get<{
      code?: string;
      quota?: { used: number; allowance: number };
    }>(
      "https://search.censys.io/api/v2/account",
      {
        auth: { username: creds.id, password: creds.secret },
        timeout: 10_000,
        headers: { "User-Agent": "CyberStep.io/1.0 SecurityResearch" },
      },
    );

    const quota = resp.data?.quota;
    return {
      ok: true,
      quota,
      message: quota
        ? `Bağlantı başarılı. Kullanılan: ${quota.used} / ${quota.allowance} sorgu`
        : "Bağlantı başarılı.",
    };
  } catch (err: unknown) {
    const status = axios.isAxiosError(err) ? err.response?.status : undefined;
    if (status === 401 || status === 403) {
      return { ok: false, message: "API kimliği geçersiz — ID veya Secret hatalı." };
    }
    return { ok: false, message: `Bağlantı hatası: ${String(err)}` };
  }
}
