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
