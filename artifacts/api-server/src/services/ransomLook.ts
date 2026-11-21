/**
 * RansomLook (CC BY 4.0, ticari kullanım atıfla serbest) — fidye yazılımı sızıntı sitesi duyuruları.
 * Eşleşme yalnızca tam alan adı (veya www.) ifadesi duyuru başlığında geçince sayılır; yanlış pozitifi sınırlamak için
 * şirket adıyla/benzerlikle eşleştirilmez. Sonuç bilgi amaçlıdır, skora girmez; müşteri doğrulamalıdır.
 */
export interface RansomLookHit { group: string; title: string; discovered: string | null }

export function matchRansomPosts(domain: string, body: unknown): RansomLookHit[] {
  const d = domain.trim().toLowerCase().replace(/^www\./, "");
  if (!d || !Array.isArray(body)) return [];
  const re = new RegExp(`(^|[^a-z0-9-])(www\\.)?${d.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9-])`, "i");
  const out: RansomLookHit[] = [];
  for (const it of body as Array<Record<string, unknown>>) {
    const title = typeof it?.["post_title"] === "string" ? (it["post_title"] as string) : "";
    if (!title || !re.test(title)) continue;
    out.push({ group: String(it["group_name"] ?? ""), title: title.slice(0, 200), discovered: typeof it["discovered"] === "string" ? (it["discovered"] as string) : null });
    if (out.length >= 5) break;
  }
  return out;
}

/** null = ölçülemedi (lisans kapalı, ağ/HTTP hatası); [] = eşleşme yok. */
export async function checkRansomLook(domain: string, fetcher: (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{ status: number; json(): Promise<unknown> }>): Promise<RansomLookHit[] | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 12_000);
    const res = await fetcher(`https://www.ransomlook.io/api/search?query=${encodeURIComponent(domain)}`, { signal: ctl.signal, headers: { "User-Agent": "CyberStep.io Security Scanner/1.0", Accept: "application/json" } });
    clearTimeout(t);
    if (res.status !== 200) return null;
    return matchRansomPosts(domain, await res.json());
  } catch { return null; }
}

// ── Şirket adı ile olası eşleşme (yalnızca bilgi; skora girmez) ───────────────

const COMPANY_SUFFIXES = new Set([
  "as", "a.s", "anonim", "sirketi", "sirket", "ltd", "limited", "sti", "sanayi", "san", "ticaret", "tic", "ve",
  "inc", "llc", "gmbh", "corp", "co", "sa", "bv", "holding", "group", "grup",
]);

/** Türkçe karakterleri katlar, noktalama ve şirket türü eklerini atar. */
export function normalizeCompanyName(name: string): string {
  const folded = name.toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
    .replace(/[^a-z0-9\s.]/g, " ");
  const words = folded.split(/\s+/).map((w) => w.replace(/^\.+|\.+$/g, "")).filter(Boolean);
  return words.filter((w) => !COMPANY_SUFFIXES.has(w.replace(/\./g, ""))).join(" ");
}

/**
 * Duyuru başlığı, normalize edilmiş şirket adına TAM eşit olmalı; kısa/genel adlar (5 karakterden az
 * veya tek kısa sözcük) yanlış pozitif üretmesin diye atlanır.
 */
export function matchRansomPostsByName(name: string, body: unknown): RansomLookHit[] {
  const target = normalizeCompanyName(name);
  if (target.length < 5 || !Array.isArray(body)) return [];
  const out: RansomLookHit[] = [];
  for (const it of body as Array<Record<string, unknown>>) {
    const title = typeof it?.["post_title"] === "string" ? (it["post_title"] as string) : "";
    if (!title || normalizeCompanyName(title) !== target) continue;
    out.push({ group: String(it["group_name"] ?? ""), title: title.slice(0, 200), discovered: typeof it["discovered"] === "string" ? (it["discovered"] as string) : null });
    if (out.length >= 5) break;
  }
  return out;
}

const nameCache = new Map<string, { at: number; hits: RansomLookHit[] | null }>();
const NAME_CACHE_MS = 6 * 60 * 60 * 1000;

/** null = ölçülemedi. 6 saat bellek önbelleği (aynı adın tekrar tekrar sorgulanmaması için). */
export async function checkRansomLookByName(name: string, fetcher: Parameters<typeof checkRansomLook>[1]): Promise<RansomLookHit[] | null> {
  const key = normalizeCompanyName(name);
  if (key.length < 5) return [];
  const cached = nameCache.get(key);
  if (cached && Date.now() - cached.at < NAME_CACHE_MS) return cached.hits;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 12_000);
    const res = await fetcher(`https://www.ransomlook.io/api/search?query=${encodeURIComponent(name.trim())}`, { signal: ctl.signal, headers: { "User-Agent": "CyberStep.io Security Scanner/1.0", Accept: "application/json" } });
    clearTimeout(t);
    if (res.status !== 200) return null;
    const hits = matchRansomPostsByName(name, await res.json());
    if (nameCache.size > 500) nameCache.clear();
    nameCache.set(key, { at: Date.now(), hits });
    return hits;
  } catch { return null; }
}
