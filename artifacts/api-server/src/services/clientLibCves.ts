/**
 * İstemci tarafı JavaScript kitaplıkları (jQuery vb.) için sürüm aralığı doğrulamalı CVE eşleşmesi.
 * Saf yardımcılar (db'ye bağımlı değil). Yalnızca bilgi: TPRM skoruna girmez (skor kuralı ayrıca karara bağlanacak).
 *
 * Kural: eşleşme yalnızca sayfada görülen sürüm, CVE'nin yayımlanmış sürüm aralığındaysa üretilir
 * (kanıt = "sürüm aralığı doğrulandı"). Aralık dışındaki (yamalı) sürümler eşleşmez.
 */
import { isVersionVulnerable } from "./cve/versionEvidence";

export interface JsLibrary { library: string; version: string; source: string }

export interface ClientLibAdvisory {
  library: string;
  cveId: string;
  title: string;
  cvss: number;
  startIncluding?: string;
  endExcluding?: string;
  kev: boolean;
}

/**
 * Elle doğrulanmış kayıtlar. Yeni kayıt eklerken aralığı birden fazla kaynaktan doğrulayın.
 * CVE-2020-11023: jQuery >= 1.0.3 ve < 3.5.0 (3.5.0'da yamalandı); CISA KEV'de (Ocak 2025).
 */
export const CLIENT_LIB_ADVISORIES: readonly ClientLibAdvisory[] = [
  { library: "jquery", cveId: "CVE-2020-11023", title: "jQuery çapraz site betik çalıştırma (XSS) — <option> öğeleri içeren HTML", cvss: 6.9, startIncluding: "1.0.3", endExcluding: "3.5.0", kev: true },
];

/**
 * NVD kaydında sürüm aralığı olmayan (yalnızca ürün adı olan) CVE'ler için elle doğrulanmış aralığı uygular.
 * Eşleşen kayıt yoksa ürünü aynen döndürür.
 */
export function withCuratedRange<P extends { product?: string; versionStartIncluding?: string; versionEndExcluding?: string }>(
  cveId: string, product: P, advisories: readonly ClientLibAdvisory[] = CLIENT_LIB_ADVISORIES,
): P & { curated?: boolean } {
  if (product.versionStartIncluding || product.versionEndExcluding) return product;
  const lib = (product.product ?? "").toLowerCase().replace(/_/g, " ").trim();
  const a = advisories.find((x) => x.cveId === cveId && x.library === lib);
  if (!a) return product;
  return { ...product, versionStartIncluding: a.startIncluding, versionEndExcluding: a.endExcluding, curated: true };
}

export interface ClientLibFinding {
  library: string;
  version: string;
  cveId: string;
  title: string;
  cvss: number;
  kev: boolean;
  range: string;
  evidence: "verified";
  source: string;
}

const VERSION = "(\\d{1,2}\\.\\d{1,2}(?:\\.\\d{1,3})?)";

/** Sayfa HTML'inden jQuery sürümünü okur (script adresi veya başlık yorumu). Bulamazsa boş döner. */
export function detectJsLibraries(html: string): JsLibrary[] {
  const out: JsLibrary[] = [];
  const seen = new Set<string>();
  const add = (library: string, version: string, source: string) => {
    const k = `${library}@${version}`;
    if (!seen.has(k)) { seen.add(k); out.push({ library, version, source }); }
  };
  const scripts = [...html.matchAll(/<script[^>]+src\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]!);
  for (const src of scripts) {
    // jquery-3.3.1.min.js · jquery.3.3.1.js
    let m = src.match(new RegExp(`jquery[-.]${VERSION}(?:\\.min|\\.slim|\\.slim\\.min)?\\.js`, "i"));
    if (m) { add("jquery", m[1]!, "script adresi"); continue; }
    // /jquery/3.3.1/jquery.min.js (CDN)
    m = src.match(new RegExp(`/jquery/${VERSION}/`, "i"));
    if (m) { add("jquery", m[1]!, "script adresi"); continue; }
    // jquery.min.js?ver=3.6.0 (yalnızca dosya adı jquery ise; eklentilerin ?ver=ı sayılmaz)
    m = src.match(new RegExp(`/jquery(?:\\.min)?\\.js\\?(?:ver|v)=${VERSION}`, "i"));
    if (m) add("jquery", m[1]!, "script adresi");
  }
  // İlk 4KB'lık betik gövdesi/başlık yorumu: "jQuery v3.3.1"
  const banner = html.match(new RegExp(`jQuery(?: JavaScript Library)? v${VERSION}`, "i"));
  if (banner) add("jquery", banner[1]!, "betik başlık yorumu");
  return out;
}

/** Görülen kitaplık sürümlerini doğrulanmış CVE kayıtlarıyla eşler. */
export function matchClientLibCves(libs: JsLibrary[], advisories: readonly ClientLibAdvisory[] = CLIENT_LIB_ADVISORIES): ClientLibFinding[] {
  const out: ClientLibFinding[] = [];
  for (const lib of libs) {
    for (const a of advisories) {
      if (a.library !== lib.library) continue;
      if (!a.startIncluding && !a.endExcluding) continue; // aralıksız kayıt eşleşme üretmez
      if (!isVersionVulnerable(lib.version, a.startIncluding, a.endExcluding)) continue;
      out.push({
        library: lib.library, version: lib.version, cveId: a.cveId, title: a.title, cvss: a.cvss, kev: a.kev,
        range: `${a.startIncluding ? `>= ${a.startIncluding}` : ""}${a.startIncluding && a.endExcluding ? ", " : ""}${a.endExcluding ? `< ${a.endExcluding}` : ""}`,
        evidence: "verified", source: lib.source,
      });
    }
  }
  return out;
}

export type HtmlFetchLike = (url: string, init: { redirect: "manual"; signal: AbortSignal; headers: Record<string, string> }) => Promise<{
  status: number; headers: { get: (k: string) => string | null }; text: () => Promise<string>;
}>;

/**
 * Ana sayfa HTML'ini güvenli biçimde çeker: en fazla 3 yönlendirme, her sıçrama genel (public) alan adı olmalı,
 * en çok ~400 KB okunur. Hata/yönlendirme dışı yanıtta null (ölçülemedi).
 */
export async function fetchHomepageHtml(domain: string, fetcher: HtmlFetchLike, isPublic: (host: string) => Promise<boolean>, timeoutMs = 10_000): Promise<string | null> {
  let url = `https://${domain}/`;
  for (let hop = 0; hop < 4; hop++) {
    let host: string;
    try { host = new URL(url).hostname; } catch { return null; }
    if (!(await isPublic(host))) return null;
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await fetcher(url, { redirect: "manual", signal: ctl.signal, headers: { "User-Agent": "CyberStep.io Security Scanner/1.0", Accept: "text/html" } });
      if (r.status >= 300 && r.status < 400) {
        const loc = r.headers.get("location");
        if (!loc) return null;
        url = new URL(loc, url).toString();
        if (!/^https?:/i.test(url)) return null;
        continue;
      }
      if (r.status !== 200) return null;
      return (await r.text()).slice(0, 400_000);
    } catch {
      return null;
    } finally {
      clearTimeout(t);
    }
  }
  return null;
}

/** Var olan bir cve_domain_matches satırının, elle doğrulanmış aralıkla yeniden değerlendirilmesi (saf). */
export function revalidateMatchRow(
  cveId: string,
  productName: string,
  version: string | null | undefined,
  confidence: number | null | undefined,
  note: string | null | undefined,
  evaluate: (v: string | null | undefined, p: { versionStartIncluding?: string; versionEndExcluding?: string }, c: number, n: string | null) => { skip: boolean; confidence: number; note: string },
  advisories: readonly ClientLibAdvisory[] = CLIENT_LIB_ADVISORIES,
): { action: "delete" | "update" | "none"; confidence?: number; note?: string } {
  const p = withCuratedRange(cveId, { product: productName } as { product: string; versionStartIncluding?: string; versionEndExcluding?: string }, advisories);
  if (!p.curated) return { action: "none" };
  // Eski kanıt ibaresini at, kategori notunu koru
  const base = (note ?? "").split(" · ").filter((x) => x && !/Sürüm (tespit|aralığı)|aralık verisi yok/.test(x)).join(" · ") || null;
  const ev = evaluate(version, p, confidence ?? 50, base);
  if (ev.skip) return { action: "delete" };
  return { action: "update", confidence: ev.confidence, note: ev.note };
}
