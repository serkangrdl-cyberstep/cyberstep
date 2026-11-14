/**
 * Sektör normalizasyonu.
 * lead_candidates.sector iki farklı kaynaktan dolar:
 *   - sectorEnrichmentCron (anahtar kelime/TLD): "Sağlık", "Üretim/Sanayi", "Telecom/ISP" ...
 *   - haiku-enrichment (AI):                      "Sağlık & Klinik", "Üretim & Sanayi" ...
 * Benchmark için bunları sabit slug'lara indirger.
 */

export interface CanonicalSector { slug: string; label: string }

const GROUPS: Array<{ slug: string; label: string; match: string[] }> = [
  { slug: "saglik",    label: "Sağlık",                  match: ["saglik", "klinik", "hastane", "medikal"] },
  { slug: "finans",    label: "Finans & Sigorta",        match: ["finans", "banka", "sigorta", "muhasebe"] },
  { slug: "perakende", label: "E-ticaret & Perakende",   match: ["perakende", "e-ticaret", "eticaret"] },
  { slug: "bilisim",   label: "Bilişim & Telekom",       match: ["teknoloji", "yazilim", "bilisim", "telecom", "telekom", "isp"] },
  { slug: "imalat",    label: "Üretim & Sanayi",         match: ["uretim", "sanayi", "imalat", "tekstil", "moda"] },
  { slug: "insaat",    label: "İnşaat & Gayrimenkul",    match: ["insaat", "gayrimenkul", "yapi"] },
  { slug: "lojistik",  label: "Lojistik & Taşımacılık",  match: ["lojistik", "tasimacilik", "kargo"] },
  { slug: "egitim",    label: "Eğitim",                  match: ["egitim", "universite", "okul"] },
  { slug: "kamu",      label: "Kamu & Belediye",         match: ["kamu", "belediye"] },
  { slug: "turizm",    label: "Turizm & Otelcilik",      match: ["turizm", "otel"] },
  { slug: "gida",      label: "Gıda & Restoran",         match: ["gida", "restoran", "horeca"] },
  { slug: "otomotiv",  label: "Otomotiv",                match: ["otomotiv"] },
  { slug: "hukuk",     label: "Hukuk & Danışmanlık",     match: ["hukuk", "danismanlik"] },
  { slug: "enerji",    label: "Enerji & Madencilik",     match: ["enerji", "madencilik"] },
  { slug: "medya",     label: "Medya & Yayıncılık",      match: ["medya", "yayincilik"] },
  { slug: "tarim",     label: "Tarım",                   match: ["tarim"] },
];

export const SECTOR_LABELS: Record<string, string> = Object.fromEntries(GROUPS.map(g => [g.slug, g.label]));

/** Türkçe karakterleri sadeleştirir ve küçük harfe çevirir. */
export function foldTurkish(s: string): string {
  return s
    .replace(/İ/g, "i").replace(/I/g, "ı")
    .toLowerCase()
    .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u")
    .replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c")
    .normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Ham sektör metnini sabit gruba eşler; eşleşmezse (veya "Diğer") null. */
export function canonicalSector(raw: string | null | undefined): CanonicalSector | null {
  if (!raw) return null;
  const f = foldTurkish(raw);
  if (!f.trim() || f.trim() === "diger") return null;
  for (const g of GROUPS) {
    if (g.match.some(m => f.includes(m))) return { slug: g.slug, label: g.label };
  }
  return null;
}
