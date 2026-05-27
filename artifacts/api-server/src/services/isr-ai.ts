import { GoogleGenAI } from "@google/genai";
import { logger } from "../lib/logger";

function getClient() {
  const apiKey = process.env["AI_INTEGRATIONS_GEMINI_API_KEY"];
  const baseUrl = process.env["AI_INTEGRATIONS_GEMINI_BASE_URL"];
  if (!apiKey || !baseUrl) return null;
  return new GoogleGenAI({ apiKey, httpOptions: { baseUrl } });
}

export interface EmailClassification {
  type: "new_deal" | "rfq_response" | "ignored";
  dealRefId?: number;
  customerName?: string;
  customerCompany?: string;
  customerPhone?: string;
  vendorName?: string;
  productKeywords?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  summary?: string;
}

export interface ParsedRfqResponse {
  lines: Array<{
    sku?: string;
    description: string;
    quantity: number;
    unitCost: number;
    currency: string;
  }>;
  validUntil?: string;
  currency: string;
  notes?: string;
}

export async function classifyEmail(params: {
  fromEmail: string;
  fromName: string;
  subject: string;
  bodyText: string;
  vendorNames: string[];
}): Promise<EmailClassification> {
  const client = getClient();
  if (!client) {
    logger.warn("Gemini not configured — skipping email classification");
    return { type: "ignored" };
  }

  const refMatch = params.subject.match(/\[ISR-REF:DEAL-(\d+)\]/i);
  const dealRefId = refMatch ? parseInt(refMatch[1]) : undefined;

  const prompt = `
Sen bir satış asistanısın. Gelen e-postayı analiz et ve JSON formatında yanıt ver.

E-posta Bilgileri:
- Gönderen: ${params.fromName} <${params.fromEmail}>
- Konu: ${params.subject}
- Mesaj Referansı: ${dealRefId ? `[ISR-REF:DEAL-${dealRefId}]` : "yok"}
- İçerik: ${params.bodyText.slice(0, 2000)}

Bilinen Satıcılar: ${params.vendorNames.join(", ")}

Görevin:
1. E-posta türünü belirle:
   - "new_deal": Müşteriden gelen yeni ürün/fiyat teklifi talebi
   - "rfq_response": Distribütör veya satıcıdan gelen fiyat teklifi yanıtı (konuda [ISR-REF:DEAL-X] varsa büyük ihtimalle bu)
   - "ignored": Spam, abonelik, bildirim veya alakasız

2. Aşağıdaki JSON formatında yanıt ver (sadece JSON, başka hiçbir şey ekleme):

Eğer "new_deal" ise:
{
  "type": "new_deal",
  "customerName": "...",
  "customerCompany": "...",
  "customerPhone": "...",
  "vendorName": "...",
  "productKeywords": "...",
  "priority": "normal",
  "summary": "..."
}

Eğer "rfq_response" ise:
{
  "type": "rfq_response",
  "dealRefId": ${dealRefId ?? "null"},
  "summary": "..."
}

Eğer "ignored" ise:
{
  "type": "ignored"
}

priority değerleri: "low", "normal", "high", "urgent"
vendorName olarak bilinen satıcılardan birini kullan, yoksa ham metni kullan.
`;

  try {
    const result = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { temperature: 0.1 },
    });
    const text = result.text?.trim() ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { type: "ignored" };
    return JSON.parse(jsonMatch[0]) as EmailClassification;
  } catch (err) {
    logger.error({ err }, "Email classification failed");
    return { type: "ignored" };
  }
}

export async function parseRfqResponseEmail(params: {
  subject: string;
  bodyText: string;
  currency?: string;
}): Promise<ParsedRfqResponse> {
  const client = getClient();
  if (!client) return { lines: [], currency: params.currency ?? "TRY" };

  const prompt = `
Sen bir satış uzmanısın. Distribütörden veya satıcıdan gelen fiyat teklifi e-postasını analiz et.

E-posta Konusu: ${params.subject}
E-posta İçeriği:
${params.bodyText.slice(0, 3000)}

Görevin: E-postadaki ürün kalemlerini çıkar ve aşağıdaki JSON formatında ver (SADECE JSON):

{
  "lines": [
    {
      "sku": "FG-100F",
      "description": "Fortinet FortiGate 100F",
      "quantity": 2,
      "unitCost": 15000.00,
      "currency": "TRY"
    }
  ],
  "validUntil": "2024-03-31",
  "currency": "TRY",
  "notes": "Varsa özel notlar"
}

Notlar:
- SKU bulamazsan null bırak
- Fiyat birimini döviz sembolünden çıkarmaya çalış ($, €, ₺ vb.)
- Tarih formatı: YYYY-MM-DD
- Fiyat bulamazsan 0 kullan
- E-postada kalem yoksa lines dizisini boş bırak
`;

  try {
    const result = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { temperature: 0.1 },
    });
    const text = result.text?.trim() ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { lines: [], currency: params.currency ?? "TRY" };
    return JSON.parse(jsonMatch[0]) as ParsedRfqResponse;
  } catch (err) {
    logger.error({ err }, "RFQ response parsing failed");
    return { lines: [], currency: params.currency ?? "TRY" };
  }
}

export async function generateRfqEmailBody(params: {
  dealId: number;
  customerCompany: string;
  productKeywords: string;
  originalRequest: string;
  vendorName: string;
  distributorName: string;
}): Promise<string> {
  return `Sayın ${params.distributorName} Ekibi,

Müşterimiz ${params.customerCompany} için ${params.vendorName} ürünleri kapsamında fiyat teklifi talep ediyoruz.

Müşteri Talebi:
${params.productKeywords}

---
Orijinal Talep:
${params.originalRequest.slice(0, 500)}

---
Aşağıdaki bilgileri içeren teklifinizi bekliyoruz:
- SKU / Ürün Kodu
- Ürün Açıklaması
- Adet
- Birim Fiyat (KDV hariç)
- Geçerlilik Süresi
- Varsa lisans/destek süreleri

Bu teklif referans kodumuz: [ISR-REF:DEAL-${params.dealId}]
Lütfen yanıtınızın konusuna bu referans kodunu eklemeyi unutmayın.

Teşekkürler,
CyberStep.io Satış Ekibi`;
}
