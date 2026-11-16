/**
 * Censys Platform API (v3) istemcisi.
 *
 * Kimlik: CENSYS_API_TOKEN (Personal Access Token, Bearer).
 * Opsiyonel: CENSYS_ORG_ID (ücretli organizasyon hesapları için; Free'de gerekmez).
 * Eski search.censys.io (ID/Secret) API'si kaldırıldı; bu dosya onun yerini alır.
 *
 * Arama: POST https://api.platform.censys.io/v3/global/search/query
 */
import axios from "axios";
import { logger } from "../lib/logger";

const BASE_URL = "https://api.platform.censys.io/v3/global";

export function getCensysToken(): string | null {
  return process.env["CENSYS_API_TOKEN"] || process.env["CENSYS_API_KEY"] || null;
}

export function isCensysConfigured(): boolean {
  return getCensysToken() !== null;
}

export class CensysApiError extends Error {
  constructor(public status: number | undefined, message: string) {
    super(message);
  }
}

export interface CensysSearchResult {
  hits: Array<Record<string, unknown>>;
  total: number;
}

/** Yanıt gövdesinden kısa, güvenli bir hata özeti çıkarır. */
function describeError(err: unknown): CensysApiError {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const data = err.response?.data as Record<string, unknown> | undefined;
    const detail =
      (typeof data?.["detail"] === "string" && data["detail"]) ||
      (typeof data?.["message"] === "string" && data["message"]) ||
      (typeof data?.["title"] === "string" && data["title"]) ||
      err.message;
    return new CensysApiError(status, `HTTP ${status ?? "?"}: ${String(detail).slice(0, 200)}`);
  }
  return new CensysApiError(undefined, String(err).slice(0, 200));
}

export async function censysSearch(
  query: string,
  pageSize = 20,
): Promise<CensysSearchResult> {
  const token = getCensysToken();
  if (!token) throw new CensysApiError(undefined, "CENSYS_API_TOKEN tanımlı değil");

  const orgId = process.env["CENSYS_ORG_ID"];
  try {
    const resp = await axios.post(
      `${BASE_URL}/search/query`,
      { query, page_size: pageSize },
      {
        params: orgId ? { organization_id: orgId } : undefined,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "CyberStep.io/1.0 SecurityResearch",
          ...(orgId ? { "X-Organization-ID": orgId } : {}),
        },
        timeout: 20_000,
      },
    );
    const result = (resp.data as { result?: { hits?: unknown[]; total_hits?: number } })?.result;
    const hits = (result?.hits ?? []) as Array<Record<string, unknown>>;
    return { hits, total: result?.total_hits ?? hits.length };
  } catch (err) {
    const e = describeError(err);
    logger.warn({ status: e.status, detail: e.message }, "censysPlatform: istek başarısız");
    throw e;
  }
}

/** Hit içindeki kaynak nesneyi (host_v1 / certificate_v1 ...) çıkarır; şema farklarına toleranslı. */
export function unwrapHit(
  hit: Record<string, unknown>,
  key: "host_v1" | "certificate_v1" | "webproperty_v1",
): Record<string, unknown> | null {
  const node = hit[key] as Record<string, unknown> | undefined;
  if (!node || typeof node !== "object") return null;
  const resource = node["resource"] as Record<string, unknown> | undefined;
  return resource && typeof resource === "object" ? resource : node;
}
