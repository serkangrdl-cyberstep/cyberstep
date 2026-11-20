/** Tedarikçinin beyan ettiği alt hizmet sağlayıcılar (dördüncü taraf). Doğrulanmamış beyandır. */
export interface Subprocessor { name: string; domain: string | null; dataTypes: string | null; country: string | null }

const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export function normalizeDomainLoose(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const d = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#:]/)[0] ?? "";
  return DOMAIN_RE.test(d) ? d : null;
}

const clip = (v: unknown, n: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);

/** En çok 20 kayıt; adı olmayanlar atılır; alan adı geçersizse null. */
export function sanitizeSubprocessors(raw: unknown): Subprocessor[] {
  if (!Array.isArray(raw)) return [];
  const out: Subprocessor[] = [];
  for (const r of raw.slice(0, 20)) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const name = clip(o["name"], 120);
    if (!name) continue;
    out.push({ name, domain: normalizeDomainLoose(o["domain"]), dataTypes: clip(o["dataTypes"], 200), country: clip(o["country"], 60) });
  }
  return out;
}

/** Beyan edilen alt sağlayıcılardan, müşterinin portföyünde zaten tedarikçi olanlar (alan adı eşleşmesi). */
export function inPortfolio(subs: Subprocessor[], portfolioDomains: string[]): Set<string> {
  const set = new Set(portfolioDomains.map((d) => d.toLowerCase()));
  return new Set(subs.filter((s) => s.domain && set.has(s.domain)).map((s) => s.domain!));
}
