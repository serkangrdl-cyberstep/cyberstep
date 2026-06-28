/**
 * Haiku Domain Enrichment
 *
 * Claude Haiku kullanarak bir domain adından sektör ve şehir tahmini yapar.
 * Replit AI Integrations üzerinden çalışır (harici API key gerekmez).
 */
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { logAiCost } from "../aiCostTracker";
import { logger } from "../../lib/logger";

const HAIKU_MODEL = "claude-haiku-4-5";

// Tutarlılık için sabit liste — model bu listedeki değerleri döndürmeli
export const SECTOR_LIST = [
  "Teknoloji & Yazılım",
  "E-ticaret & Perakende",
  "Finans & Bankacılık",
  "Sağlık & Klinik",
  "Eğitim & Üniversite",
  "İnşaat & Gayrimenkul",
  "Üretim & Sanayi",
  "Lojistik & Taşımacılık",
  "Turizm & Otelcilik",
  "Medya & Yayıncılık",
  "Hukuk & Danışmanlık",
  "Kamu & Belediye",
  "Enerji & Madencilik",
  "Tekstil & Moda",
  "Gıda & Restoran",
  "Otomotiv",
  "Tarım",
  "Diğer",
];

export const TURKEY_CITIES = [
  "İstanbul", "Ankara", "İzmir", "Bursa", "Antalya",
  "Adana", "Konya", "Gaziantep", "Kayseri", "Mersin",
  "Eskişehir", "Diyarbakır", "Samsun", "Trabzon", "Kocaeli",
  "Manisa", "Denizli", "Şanlıurfa", "Malatya", "Balıkesir",
];

// ASCII/variant → canonical Turkish mapping
const CITY_ALIASES: Record<string, string> = {
  "istanbul":   "İstanbul",
  "istambul":   "İstanbul",
  "izmir":      "İzmir",
  "izmır":      "İzmir",
  "sanliurfa":  "Şanlıurfa",
  "şanliurfa":  "Şanlıurfa",
  "urfa":       "Şanlıurfa",
  "diyarbakir": "Diyarbakır",
  "eskisehir":  "Eskişehir",
  "eskişehir":  "Eskişehir",
  "kocaeli":    "Kocaeli",
  "balikesir":  "Balıkesir",
  "balıkesir":  "Balıkesir",
  "malatya":    "Malatya",
  "ankara":     "Ankara",
  "bursa":      "Bursa",
  "antalya":    "Antalya",
  "adana":      "Adana",
  "konya":      "Konya",
  "gaziantep":  "Gaziantep",
  "kayseri":    "Kayseri",
  "mersin":     "Mersin",
  "samsun":     "Samsun",
  "trabzon":    "Trabzon",
  "manisa":     "Manisa",
  "denizli":    "Denizli",
};

export const CITY_TO_REGION: Record<string, string> = {
  // MARMARA
  "İstanbul": "Marmara", "Tekirdağ": "Marmara", "Edirne": "Marmara",
  "Kırklareli": "Marmara", "Balıkesir": "Marmara", "Çanakkale": "Marmara",
  "Bursa": "Marmara", "Yalova": "Marmara", "Kocaeli": "Marmara",
  "Sakarya": "Marmara", "Düzce": "Marmara", "Bolu": "Marmara",
  "Bilecik": "Marmara", "Eskişehir": "Marmara",
  // EGE
  "İzmir": "Ege", "Manisa": "Ege", "Afyonkarahisar": "Ege",
  "Kütahya": "Ege", "Uşak": "Ege", "Denizli": "Ege", "Muğla": "Ege", "Aydın": "Ege",
  // AKDENİZ
  "Antalya": "Akdeniz", "Isparta": "Akdeniz", "Burdur": "Akdeniz",
  "Konya": "Akdeniz", "Karaman": "Akdeniz", "Mersin": "Akdeniz",
  "Adana": "Akdeniz", "Osmaniye": "Akdeniz", "Hatay": "Akdeniz",
  "Kahramanmaraş": "Akdeniz",
  // İÇ ANADOLU
  "Ankara": "İç Anadolu", "Çankırı": "İç Anadolu", "Kırıkkale": "İç Anadolu",
  "Kırşehir": "İç Anadolu", "Nevşehir": "İç Anadolu", "Aksaray": "İç Anadolu",
  "Niğde": "İç Anadolu", "Kayseri": "İç Anadolu", "Sivas": "İç Anadolu",
  "Yozgat": "İç Anadolu",
  // KARADENİZ
  "Zonguldak": "Karadeniz", "Bartın": "Karadeniz", "Karabük": "Karadeniz",
  "Kastamonu": "Karadeniz", "Sinop": "Karadeniz", "Samsun": "Karadeniz",
  "Ordu": "Karadeniz", "Giresun": "Karadeniz", "Trabzon": "Karadeniz",
  "Rize": "Karadeniz", "Artvin": "Karadeniz", "Gümüşhane": "Karadeniz",
  "Bayburt": "Karadeniz", "Amasya": "Karadeniz", "Tokat": "Karadeniz",
  "Çorum": "Karadeniz",
  // DOĞU ANADOLU
  "Malatya": "Doğu Anadolu", "Elazığ": "Doğu Anadolu", "Tunceli": "Doğu Anadolu",
  "Bingöl": "Doğu Anadolu", "Erzincan": "Doğu Anadolu", "Erzurum": "Doğu Anadolu",
  "Kars": "Doğu Anadolu", "Ardahan": "Doğu Anadolu", "Iğdır": "Doğu Anadolu",
  "Ağrı": "Doğu Anadolu", "Van": "Doğu Anadolu", "Bitlis": "Doğu Anadolu",
  "Muş": "Doğu Anadolu",
  // GÜNEYDOĞU ANADOLU
  "Gaziantep": "Güneydoğu Anadolu", "Kilis": "Güneydoğu Anadolu",
  "Adıyaman": "Güneydoğu Anadolu", "Şanlıurfa": "Güneydoğu Anadolu",
  "Diyarbakır": "Güneydoğu Anadolu", "Mardin": "Güneydoğu Anadolu",
  "Batman": "Güneydoğu Anadolu", "Şırnak": "Güneydoğu Anadolu",
  "Siirt": "Güneydoğu Anadolu", "Hakkari": "Güneydoğu Anadolu",
};

export const REGIONS = [
  "Marmara", "Ege", "Akdeniz", "İç Anadolu",
  "Karadeniz", "Doğu Anadolu", "Güneydoğu Anadolu",
] as const;

export function getRegion(city: string | null | undefined): string | null {
  if (!city) return null;
  return CITY_TO_REGION[city] ?? null;
}

/**
 * Şehir adını normalize eder: "Istanbul" → "İstanbul", "Izmir" → "İzmir" vb.
 * TURKEY_CITIES listesinde olmayan değerleri null döndürür.
 */
export function normalizeCity(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Remove combining dot above (U+0307) produced by İ/Ş.toLowerCase() in Node
  const lower = trimmed.toLowerCase().replace(/\u0307/g, "");
  const alias = CITY_ALIASES[lower];
  if (alias) return alias;
  // Zaten listede varsa doğrudan döndür
  if (TURKEY_CITIES.includes(trimmed)) return trimmed;
  return null;
}

export interface EnrichmentResult {
  sector: string | null;
  city: string | null;
  region: string | null;
  confidence: "high" | "medium" | "low";
  reasoning: string;
}

function extractJson(raw: string): Record<string, unknown> {
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : {};
  } catch {
    return {};
  }
}

export async function enrichDomain(
  domain: string,
  companyName?: string | null,
): Promise<EnrichmentResult> {
  const prompt = `Sen bir Türkiye iş dünyası uzmanısın. Aşağıdaki domain adına bakarak şirketi analiz et.

Domain: ${domain}${companyName ? `\nŞirket Adı: ${companyName}` : ""}

Görev:
1. Bu şirketin sektörünü belirle (aşağıdaki listeden seç)
2. Şirketin Türkiye'deki muhtemel şehrini belirle
3. Güven seviyeni belirt

Sektör Listesi:
${SECTOR_LIST.join("\n")}

Kurallar:
- Domain adındaki ipuçlarını kullan (hastane→Sağlık, yazilim→Teknoloji vb.)
- .edu.tr → Eğitim, .gov.tr → Kamu, .bel.tr → Kamu (kesin, high confidence)
- Şehir belirleyemiyorsan null döndür
- Türkiye dışı bir şirketse null döndür
- Yeterli ipucu yoksa "Diğer" döndür, uydurma

SADECE JSON döndür, başka hiçbir şey yazma:
{"sector":"Teknoloji & Yazılım","city":"İstanbul","confidence":"medium","reasoning":"domain adında yazilim geçiyor"}`;

  const message = await anthropic.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 200,
    messages: [{ role: "user", content: prompt }],
  });

  void logAiCost({
    task: "haiku-domain-enrichment",
    service: "domain-enrichment",
    model: HAIKU_MODEL,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    cacheType: "none",
  });

  const block = message.content[0];
  const raw = block?.type === "text" ? block.text : "";
  const parsed = extractJson(raw) as Partial<EnrichmentResult>;

  const sector = parsed.sector && SECTOR_LIST.includes(parsed.sector) ? parsed.sector : null;
  const city = normalizeCity(parsed.city as string | null | undefined);
  const region = getRegion(city);
  const confidence = (["high", "medium", "low"] as const).includes(parsed.confidence as "high" | "medium" | "low")
    ? (parsed.confidence as "high" | "medium" | "low")
    : "low";

  if (!sector) {
    logger.debug({ domain, raw }, "Haiku enrichment: sektör belirlenemedi");
  }

  return { sector, city, region, confidence, reasoning: String(parsed.reasoning ?? "") };
}
