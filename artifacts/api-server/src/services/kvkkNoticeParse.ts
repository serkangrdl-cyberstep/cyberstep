/** KVKK veri ihlali kamuoyu duyurularını ayrıştırır ve tedarikçi bağlantısını sınıflar (saf fonksiyonlar). */

export interface NoticeListItem { noticeId: number; url: string; company: string; dateText: string | null }

const TR_MONTHS: Record<string, string> = { ocak: "01", şubat: "02", mart: "03", nisan: "04", mayıs: "05", haziran: "06", temmuz: "07", ağustos: "08", eylül: "09", ekim: "10", kasım: "11", aralık: "12" };

/** "11 Kasım 2026, Çarşamba" → "2026-11-11" */
export function parseTrDate(text: string | null | undefined): string | null {
  const m = text?.match(/(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)\s+(\d{4})/);
  if (!m) return null;
  const mon = TR_MONTHS[m[2].toLocaleLowerCase("tr")];
  return mon ? `${m[3]}-${mon}-${m[1].padStart(2, "0")}` : null;
}

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const stripTags = (s: string) => decode(s.replace(/<[^>]+>/g, " "));

export function companyFromTitle(title: string): string {
  return decode(title).replace(/^Kamuoyu Duyurusu \(Veri İhlali Bildirimi\)\s*[–-]\s*/i, "").trim();
}

/** Liste sayfası: her kutuda başlık bağlantısı ve .date alanı var. */
export function parseNoticeList(html: string): NoticeListItem[] {
  const items: NoticeListItem[] = [];
  const seen = new Set<number>();
  const boxRe = /<div class="news__box">([\s\S]*?)<p class="date">([^<]*)<\/p>/g;
  for (const m of html.matchAll(boxRe)) {
    const link = m[1].match(/href="(https?:\/\/www\.kvkk\.gov\.tr\/Icerik\/(\d+)\/kamuoyu-duyurusu-veri-ihlali[^"]*)"[^>]*title="([^"]+)"/);
    if (!link) continue;
    const noticeId = Number(link[2]);
    if (seen.has(noticeId)) continue;
    seen.add(noticeId);
    items.push({ noticeId, url: link[1], company: companyFromTitle(link[3]), dateText: decode(m[2]) });
  }
  return items;
}

export interface NoticeDetail { summary: string; affectedCount: number | null; decisionNo: string | null; publishedAt: string | null }

/** Duyuru sayfası: .news__detail-article içindeki metin ("Veri sorumlusu sıfatını haiz ..." ile başlayan özet). */
export function parseNoticeDetail(html: string): NoticeDetail | null {
  const art = html.match(/<div class="news__detail-article[^"]*">([\s\S]*?)<\/div>\s*(?:<\/div>|<div class="news__)/);
  const body = stripTags(art ? art[1] : html);
  const start = body.indexOf("Veri sorumlusu sıfatını haiz");
  if (start < 0) return null;
  const end = body.indexOf("Kamuoyuna saygıyla", start);
  const summary = body.slice(start, end > 0 ? end : undefined).trim();
  const count = summary.match(/ilgili kişi sayısının\s+([\d.]+)/i);
  const decision = summary.match(/(\d{2}\.\d{2}\.\d{4})\s+tarih\w*\s+ve\s+(\d{4}\/\d+)\s+sayılı/i);
  const pub = stripTags(html).match(/Yayınlanma Tarihi:?\s*(\d{1,2}\s+\S+\s+\d{4})/);
  return {
    summary,
    affectedCount: count ? Number(count[1].replace(/\./g, "")) : null,
    decisionNo: decision ? decision[2] : null,
    publishedAt: parseTrDate(pub?.[1] ?? null),
  };
}

const SUPPLIER_PATTERNS: [string, RegExp][] = [
  ["veri işleyen", /veri işleyen/i],
  ["hizmet sağlayıcı", /hizmet sağlayıcı/i],
  ["üçüncü taraf", /üçüncü (taraf|parti)/i],
  ["tedarikçi", /tedarikçi/i],
  ["alt yüklenici / taşeron", /alt yüklenici|taşeron/i],
  ["yazılım kütüphanesi", /yazılım kütüphane/i],
  ["dış kaynak / bulut hizmeti", /dış kaynak|bulut hizmet|outsourc/i],
];

export function supplierSignals(text: string): string[] {
  return SUPPLIER_PATTERNS.filter(([, re]) => re.test(text)).map(([label]) => label);
}

/** Şahıs işletmesi ve yurt dışı şirketleri lead dışı bırakmak için kaba kurumsal Türk firma ölçütü. */
export function looksLikeTurkishCompany(name: string): boolean {
  if (/(^|[\s,.(])(Inc|Corp|LLC|GmbH|B\.V|Pte|PLC|S\.A)(?=$|[\s,.)])/iu.test(name)) return false;
  // \b ASCII dışı harflerde (Ş) çalışmadığından Unicode duyarlı sınırlar kullanılır
  return /(^|[\s,.(])(A\.?\s?Ş\.?|Anonim|Ltd\.?\s*Şti\.?|Limited\s+Şirketi|Şirketi|Holding)(?=$|[\s,.)])/iu.test(name);
}

export function classifyNotice(company: string, summary: string): { supplierLinked: boolean; signals: string[]; isLead: boolean } {
  const signals = supplierSignals(summary);
  const supplierLinked = signals.length > 0;
  return { supplierLinked, signals, isLead: supplierLinked && looksLikeTurkishCompany(company) };
}
