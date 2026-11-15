/**
 * Censys sertifika zenginleştirme servisi.
 * Domain için SSL sertifikası sunan tüm IP'leri bulur; gizli altyapı, paylaşımlı hosting
 * ve shadow IT tespitinde kullanılır.
 *
 * İki kimlik biçimi (Platform önceliklidir):
 *  - Censys Platform (güncel): CENSYS_PAT + CENSYS_ORG_ID
 *      POST https://api.platform.censys.io/v3/global/search/query?organization_id=...
 *      Sorgu (CenQL): CENSYS_PLATFORM_QUERY, varsayılan  host.services.cert.names: "{domain}"
 *      Arama Starter ve üstü paket gerektirir (Free paket yalnızca lookup). İşlem başı 1 kredi.
 *  - Legacy Search (kapatılıyor): CENSYS_API_ID + CENSYS_API_SECRET
 *      GET /v2/hosts/search?q=services.tls.certificates.leaf_data.names:{domain}
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

function getPlatformCredentials(): { pat: string; orgId: string } | null {
  const pat = process.env["CENSYS_PAT"];
  const orgId = process.env["CENSYS_ORG_ID"];
  if (!pat || !orgId) return null;
  return { pat, orgId };
}

export function isCensysConfigured(): boolean {
  return getPlatformCredentials() !== null || getCredentials() !== null;
}

const PLATFORM_BASE = "https://api.platform.censys.io/v3";

interface PlatformService { port?: number; protocol?: string; transport_protocol?: string; service_name?: string }
interface PlatformHost { ip?: string; services?: PlatformService[]; location?: { country_code?: string; city?: string } }

/** Platform yanıtındaki bir hit'ten host kaydını çıkarır (host_v1.resource biçimi ve sade biçim). */
function platformHostOf(hit: unknown): PlatformHost | null {
  if (!hit || typeof hit !== "object") return null;
  const h = hit as Record<string, unknown>;
  const v1 = h["host_v1"] as Record<string, unknown> | undefined;
  const res = (v1?.["resource"] ?? h["host"] ?? h["resource"] ?? h) as PlatformHost;
  return res && typeof res === "object" && typeof res.ip === "string" ? res : null;
}

async function enrichWithCensysPlatform(
  domain: string,
  knownIp: string | null | undefined,
  creds: { pat: string; orgId: string },
): Promise<CensysResult | null> {
  const template = process.env["CENSYS_PLATFORM_QUERY"] || 'host.services.cert.names: "{domain}"';
  const query = template.split("{domain}").join(domain.replace(/"/g, ""));
  try {
    const resp = await axios.post<{ result?: { hits?: unknown[]; total_hits?: number; total?: number } }>(
      `${PLATFORM_BASE}/global/search/query`,
      { query, page_size: 20 },
      {
        params: { organization_id: creds.orgId },
        headers: {
          Authorization: `Bearer ${creds.pat}`,
          "X-Organization-ID": creds.orgId,
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "CyberStep.io/1.0 SecurityResearch",
        },
        timeout: 15_000,
      },
    );
    const hits = resp.data?.result?.hits ?? [];
    const total = resp.data?.result?.total_hits ?? resp.data?.result?.total ?? hits.length;
    const relatedHosts: CensysRelatedHost[] = hits
      .map(platformHostOf)
      .filter((x): x is PlatformHost => x !== null)
      .map((host) => {
        const svcs = host.services ?? [];
        return {
          ip: host.ip ?? "bilinmiyor",
          ports: svcs.map((s) => s.port).filter((p): p is number => typeof p === "number"),
          services: svcs
            .map((s) => s.protocol ?? s.service_name)
            .filter((s): s is string => typeof s === "string")
            .filter((s, i, arr) => arr.indexOf(s) === i),
          countryCode: host.location?.country_code ?? null,
          city: host.location?.city ?? null,
          isSameAsKnown: knownIp != null && host.ip === knownIp,
        };
      });
    logger.info({ domain, totalFound: total, returned: relatedHosts.length }, "censysEnrichment (Platform): tamamlandı");
    return { relatedHosts, totalFound: total, queryDomain: domain };
  } catch (err: unknown) {
    const status = axios.isAxiosError(err) ? err.response?.status : undefined;
    if (status === 401 || status === 403) {
      logger.warn({ domain, status }, "censysEnrichment (Platform): yetki hatası — PAT/organizasyon ya da paket (arama Starter gerektirir)");
    } else if (status === 402 || status === 429) {
      logger.warn({ domain, status }, "censysEnrichment (Platform): kredi/rate limit");
    } else {
      logger.warn({ domain, status, err: String(err) }, "censysEnrichment (Platform): hata");
    }
    return null;
  }
}

export async function enrichWithCensys(
  domain: string,
  knownIp?: string | null,
): Promise<CensysResult | null> {
  const platform = getPlatformCredentials();
  if (platform) {
    const { providerUsable } = await import("../lib/providerPlans");
    if (!providerUsable("censys").usable) {
      logger.debug({ domain }, "censysEnrichment: Censys paketi ticari kullanıma uygun değil (CENSYS_PLAN), atlanıyor");
      return null;
    }
    const { checkAndConsumeQuota } = await import("./apiQuotaTracker");
    if (!checkAndConsumeQuota("censys")) return null;
    return enrichWithCensysPlatform(domain, knownIp, platform);
  }

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
  const platform = getPlatformCredentials();
  if (platform) {
    // Organizasyon bilgisi uç noktası kredi harcamaz; PAT ve organizasyon kimliğini doğrular.
    try {
      await axios.get(`${PLATFORM_BASE}/accounts/organizations/${encodeURIComponent(platform.orgId)}`, {
        headers: { Authorization: `Bearer ${platform.pat}`, Accept: "application/json" },
        timeout: 10_000,
      });
      return { ok: true, message: "Censys Platform bağlantısı başarılı (PAT + organizasyon doğrulandı)." };
    } catch (err: unknown) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      if (status === 401 || status === 403) return { ok: false, message: "PAT ya da organizasyon kimliği geçersiz." };
      return { ok: false, message: `Bağlantı hatası: ${String(err)}` };
    }
  }

  const creds = getCredentials();
  if (!creds) {
    return { ok: false, message: "Censys kimliği yok: CENSYS_PAT + CENSYS_ORG_ID (Platform) ya da CENSYS_API_ID + CENSYS_API_SECRET (legacy) girin." };
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
