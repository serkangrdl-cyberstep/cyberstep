/**
 * TPRM derin tarama — ek ücretsiz istihbarat kaynakları (saf yardımcılar, DB'ye bağımlı değil).
 *   - VulnCheck KEV (Community, ücretsiz; ürün içinde kullanımda belirgin atıf şart)
 *   - Hudson Rock Cavalier (anahtarsız OSINT uç noktası; yalnızca bilgi, skora girmez)
 *   - Mozilla MDN Observatory v2 (anahtarsız; yalnızca bilgi, skora girmez — başlıklar zaten puanlanıyor)
 */

import { isSourceLicensed } from "./dataSourceLicenses";

export type FetchLike = (url: string, init?: { method?: string; headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

const UA = "CyberStep.io Security Scanner/1.0";

async function getJson(fetcher: FetchLike, url: string, headers: Record<string, string> = {}, method = "GET", timeoutMs = 15_000): Promise<{ status: number; body: unknown } | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetcher(url, { method, headers: { "User-Agent": UA, Accept: "application/json", ...headers }, signal: ctl.signal });
    let body: unknown = null;
    try { body = await r.json(); } catch { body = null; }
    return { status: r.status, body };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Geçici hata: ağ/zaman aşımı (null), 429 veya 5xx. 4xx (429 hariç) kalıcı sayılır, yeniden denenmez. */
export function isTransient(res: { status: number } | null): boolean {
  return res === null || res.status === 429 || res.status >= 500;
}

export interface RetryOpts { retryDelayMs?: number }

/** İstek geçici hatayla dönerse bir kez daha dener (kaynakların aralıklı hataları "ölçülemedi" sayılmasın). */
async function getJsonRetry(fetcher: FetchLike, url: string, headers: Record<string, string> = {}, method = "GET", timeoutMs = 15_000, opts: RetryOpts = {}) {
  const first = await getJson(fetcher, url, headers, method, timeoutMs);
  if (!isTransient(first)) return first;
  await new Promise((r) => setTimeout(r, opts.retryDelayMs ?? 1500));
  return getJson(fetcher, url, headers, method, timeoutMs);
}

// ── VulnCheck KEV ────────────────────────────────────────────────────────────

/** Yanıt: { data: [{ cve: ["CVE-..."], ... }] }. CVE kayıtlıysa true. */
export function parseVulnCheckKevHit(body: unknown, cveId: string): boolean {
  const data = (body as { data?: Array<{ cve?: unknown }> } | null)?.data;
  if (!Array.isArray(data)) return false;
  return data.some((d) => Array.isArray(d?.cve) ? (d.cve as unknown[]).includes(cveId) : d?.cve === cveId);
}

export interface VulnCheckKevResult { kev: string[]; failed: boolean }

/**
 * Verilen CVE'lerden VulnCheck KEV'de olanları döner. Token yoksa null (kaynak yapılandırılmamış —
 * "kontrol edilemedi" sayılmaz, çünkü hiç denenmedi). Herhangi bir sorgu hata verirse failed=true.
 */
export async function checkVulnCheckKev(cveIds: string[], token: string | undefined, fetcher: FetchLike, opts: RetryOpts = {}): Promise<VulnCheckKevResult | null> {
  if (!token) return null;
  const ids = [...new Set(cveIds)].slice(0, 15);
  const kev: string[] = [];
  let failed = false;
  for (const id of ids) {
    const res = await getJsonRetry(fetcher, `https://api.vulncheck.com/v3/index/vulncheck-kev?cve=${encodeURIComponent(id)}`, { Authorization: `Bearer ${token}` }, "GET", 15_000, opts);
    if (!res || res.status >= 400) { failed = true; continue; }
    if (parseVulnCheckKevHit(res.body, id)) kev.push(id);
  }
  return { kev, failed };
}

// ── Hudson Rock (infostealer) ────────────────────────────────────────────────

export interface HudsonRockResult { employees: number; users: number; stealers: number }

export function parseHudsonRock(body: unknown): HudsonRockResult | null {
  const b = body as Record<string, unknown> | null;
  if (!b || typeof b !== "object") return null;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
  const employees = num(b["employees"]);
  const users = num(b["users"]);
  if (employees === null && users === null) return null;
  return { employees: employees ?? 0, users: users ?? 0, stealers: num(b["totalStealers"]) ?? num(b["total"]) ?? 0 };
}

/** Başarısız/beklenmedik yanıt → null ("kontrol edilemedi"). */
export async function checkHudsonRock(domain: string, fetcher: FetchLike, opts: RetryOpts = {}): Promise<HudsonRockResult | null> {
  if (!isSourceLicensed("hudsonrock")) return null;
  const res = await getJsonRetry(fetcher, `https://cavalier.hudsonrock.com/api/json/v2/osint-tools/search-by-domain?domain=${encodeURIComponent(domain)}`, {}, "GET", 15_000, opts);
  if (!res || res.status !== 200) return null;
  return parseHudsonRock(res.body);
}

// ── Mozilla MDN Observatory v2 ───────────────────────────────────────────────

export interface MozillaObsV2 { grade: string; score: number | null }

export function parseObservatoryV2(body: unknown): MozillaObsV2 | null {
  const b = body as { grade?: unknown; score?: unknown; error?: unknown } | null;
  if (!b || b.error || typeof b.grade !== "string" || !b.grade) return null;
  return { grade: b.grade, score: typeof b.score === "number" ? b.score : null };
}

export async function checkObservatoryV2(domain: string, fetcher: FetchLike, opts: RetryOpts = {}): Promise<MozillaObsV2 | null> {
  if (!isSourceLicensed("mozilla")) return null;
  const res = await getJsonRetry(fetcher, `https://observatory-api.mdn.mozilla.net/api/v2/scan?host=${encodeURIComponent(domain)}`, {}, "POST", 25_000, opts);
  if (!res || res.status !== 200) return null;
  return parseObservatoryV2(res.body);
}
