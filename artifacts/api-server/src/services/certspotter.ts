/**
 * SSLMate Cert Spotter (ücretli CT arama API'si) — crt.sh erişilemezse yedek.
 * Anahtar: CERTSPOTTER_API_KEY. Lisans kapısı: "certspotter".
 */
export function parseCertspotter(body: unknown, domain: string): string[] {
  if (!Array.isArray(body)) return [];
  const seen = new Set<string>();
  for (const it of body as Array<{ dns_names?: unknown }>) {
    for (const n of Array.isArray(it?.dns_names) ? it.dns_names : []) {
      const c = String(n).trim().toLowerCase();
      if (!c || c.startsWith("*")) continue;
      if (c !== domain && !c.endsWith(`.${domain}`)) continue;
      seen.add(c);
      if (seen.size >= 60) return [...seen];
    }
  }
  return [...seen];
}

/** null = ölçülemedi */
export async function fetchCertspotterSubdomains(domain: string, key: string): Promise<{ subdomains: string[]; count: number } | null> {
  try {
    const r = await fetch(`https://api.certspotter.com/v1/issuances?domain=${encodeURIComponent(domain)}&include_subdomains=true&expand=dns_names`, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" }, signal: AbortSignal.timeout(20_000),
    });
    if (r.status !== 200) return null;
    const all = parseCertspotter(await r.json(), domain);
    return { subdomains: all.slice(0, 30), count: all.length };
  } catch { return null; }
}
