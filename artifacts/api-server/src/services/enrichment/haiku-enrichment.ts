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

const TURKEY_CITIES = [
  "İstanbul", "Ankara", "İzmir", "Bursa", "Antalya",
  "Adana", "Konya", "Gaziantep", "Kayseri", "Mersin",
  "Eskişehir", "Diyarbakır", "Samsun", "Trabzon", "Kocaeli",
  "Manisa", "Denizli", "Şanlıurfa", "Malatya", "Balıkesir",
];

export interface EnrichmentResult {
  sector: string | null;
  city: string | null;
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
  const city = parsed.city && TURKEY_CITIES.includes(parsed.city) ? parsed.city : null;
  const confidence = (["high", "medium", "low"] as const).includes(parsed.confidence as "high" | "medium" | "low")
    ? (parsed.confidence as "high" | "medium" | "low")
    : "low";

  if (!sector) {
    logger.debug({ domain, raw }, "Haiku enrichment: sektör belirlenemedi");
  }

  return { sector, city, confidence, reasoning: String(parsed.reasoning ?? "") };
}
