/**
 * Tedarikçi CSV ayrıştırıcı.
 * - Ayraç otomatik: ";" (Excel Türkçe), "," veya sekme
 * - Başlık satırı varsa kolonlar adlarına göre bulunur (domain / alan adı / web sitesi, ad / firma / unvan)
 * - Başlık yoksa nokta içeren ilk kolon domain, diğer ilk kolon ad sayılır
 * - Kritiklik kolonu (opsiyonel): kritik / önemli / standart; yoksa standart
 * - Tek kolonluk düz liste (her satıra bir domain) de kabul edilir
 */

export type VendorCriticality = "kritik" | "onemli" | "standart";
export interface VendorCsvRow { domain: string; name: string | null; criticality: VendorCriticality }

const DOMAIN_HEADERS = ["domain", "alan adi", "alanadi", "alan adı", "web", "website", "web sitesi", "url", "site"];
const NAME_HEADERS = ["ad", "adi", "adı", "isim", "name", "firma", "firma adi", "firma adı", "tedarikci", "tedarikçi", "unvan", "şirket", "sirket", "company"];

const CRITICALITY_HEADERS = ["kritiklik", "kritiklik seviyesi", "önem", "onem", "önem derecesi", "criticality", "priority", "öncelik", "oncelik"];

function parseCriticality(v: string): VendorCriticality {
  const t = v.toLowerCase().trim();
  if (["kritik", "critical", "yüksek", "yuksek", "high"].includes(t)) return "kritik";
  if (["önemli", "onemli", "important", "orta", "medium"].includes(t)) return "onemli";
  return "standart";
}

function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === delim && !quoted) {
      out.push(cur.trim()); cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function detectDelimiter(lines: string[]): string {
  const sample = lines.slice(0, 5).join("\n");
  const counts: Array<[string, number]> = [[";", 0], [",", 0], ["\t", 0]];
  for (const c of counts) c[1] = sample.split(c[0]).length - 1;
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0]![1] > 0 ? counts[0]![0] : ";";
}

const looksLikeDomain = (v: string) => /[a-z0-9-]+\.[a-z]{2,}/i.test(v) && !/\s/.test(v.trim());

export function parseVendorCsv(text: string): VendorCsvRow[] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const delim = detectDelimiter(lines);
  const table = lines.map(l => splitLine(l, delim));

  let domainCol = -1;
  let nameCol = -1;
  let critCol = -1;
  let start = 0;

  const header = table[0]!.map(h => h.toLowerCase().trim());
  const hDomain = header.findIndex(h => DOMAIN_HEADERS.includes(h));
  if (hDomain >= 0) {
    domainCol = hDomain;
    nameCol = header.findIndex((h, i) => i !== hDomain && NAME_HEADERS.includes(h));
    critCol = header.findIndex((h, i) => i !== hDomain && i !== nameCol && CRITICALITY_HEADERS.includes(h));
    start = 1;
  } else {
    const first = table[0]!;
    domainCol = first.findIndex(looksLikeDomain);
    if (domainCol < 0) {
      // Tanınmayan başlık satırı: ikinci satırdan tahmin et
      const second = table[1];
      domainCol = second ? second.findIndex(looksLikeDomain) : -1;
      start = 1;
    }
    if (domainCol < 0) domainCol = 0;
    const ref = table[start] ?? [];
    nameCol = ref.findIndex((v, i) => i !== domainCol && v.length > 0 && !looksLikeDomain(v));
  }

  const rows: VendorCsvRow[] = [];
  for (const cells of table.slice(start)) {
    const domain = (cells[domainCol] ?? "").trim();
    if (!domain) continue;
    const name = nameCol >= 0 ? (cells[nameCol] ?? "").trim() || null : null;
    const criticality = critCol >= 0 ? parseCriticality(cells[critCol] ?? "") : "standart";
    rows.push({ domain, name, criticality });
  }
  return rows;
}

export const VENDOR_CSV_TEMPLATE = "domain;firma adi;kritiklik\nornekfirma.com.tr;Örnek Firma A.Ş.;kritik\ntedarikci2.com;Tedarikçi 2 Ltd.;onemli\ntedarikci3.com;Tedarikçi 3 Ltd.;standart\n";
