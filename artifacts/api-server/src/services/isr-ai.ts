import { GoogleGenAI } from "@google/genai";
import { logger } from "../lib/logger";

// ─── Replit-managed Gemini client (for ISR email tasks) ───────────────────────
function getClient() {
  const apiKey = process.env["AI_INTEGRATIONS_GEMINI_API_KEY"];
  const baseUrl = process.env["AI_INTEGRATIONS_GEMINI_BASE_URL"];
  if (!apiKey || !baseUrl) return null;
  return new GoogleGenAI({ apiKey, httpOptions: { baseUrl } });
}

type AiGenerateFn = (prompt: string) => Promise<string>;

function makeDefaultAiFn(): AiGenerateFn | null {
  const client = getClient();
  if (!client) return null;
  return async (prompt: string) => {
    const result = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { temperature: 0.1 },
    });
    return result.text?.trim() ?? "";
  };
}

// ─── Interfaces ───────────────────────────────────────────────────────────────
export interface EmailClassification {
  type: "new_deal" | "rfq_response" | "quote_revision_request" | "ignored";
  dealRefId?: number;
  customerName?: string;
  customerCompany?: string;
  customerPhone?: string;
  vendorName?: string;
  productKeywords?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  summary?: string;
  // quote_revision_request fields
  requestedDiscountPct?: number;
  revisionNotes?: string;
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

export interface ParsedRevisionRequest {
  requestedDiscountPct?: number;
  removedItems?: string[];
  addedItems?: string[];
  changedItems?: Array<{ description: string; change: string }>;
  notes: string;
  urgency: "low" | "normal" | "high";
}

// ─── classifyEmail ────────────────────────────────────────────────────────────
export async function classifyEmail(params: {
  fromEmail: string;
  fromName: string;
  subject: string;
  bodyText: string;
  vendorNames: string[];
  aiFn?: AiGenerateFn;
}): Promise<EmailClassification> {
  const aiFn = params.aiFn ?? makeDefaultAiFn();
  if (!aiFn) {
    logger.warn("AI not configured — skipping email classification");
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
   - "quote_revision_request": Müşteriden gelen mevcut teklife itiraz, indirim talebi veya içerik değişikliği isteği ([ISR-REF:DEAL-X] varsa ve müşteri tarafından geldiyse)
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

Eğer "quote_revision_request" ise:
{
  "type": "quote_revision_request",
  "dealRefId": ${dealRefId ?? "null"},
  "requestedDiscountPct": 10,
  "revisionNotes": "Müşteri %10 indirim talep ediyor, ürün X'i Y ile değiştirmek istiyor",
  "summary": "..."
}

Eğer "ignored" ise:
{
  "type": "ignored"
}

Notlar:
- priority değerleri: "low", "normal", "high", "urgent"
- vendorName olarak bilinen satıcılardan birini kullan, yoksa ham metni kullan
- quote_revision_request için requestedDiscountPct: indirim yüzdesi bulunamazsa null bırak
- Distribütör/satıcıdan gelen e-posta ve konuda [ISR-REF] varsa "rfq_response"
- Müşteriden gelen e-posta ve konuda [ISR-REF] varsa + indirim/değişiklik talebi varsa "quote_revision_request"
`;

  try {
    const text = await aiFn(prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { type: "ignored" };
    return JSON.parse(jsonMatch[0]) as EmailClassification;
  } catch (err) {
    logger.error({ err }, "Email classification failed");
    return { type: "ignored" };
  }
}

// ─── parseRfqResponseEmail ────────────────────────────────────────────────────
export async function parseRfqResponseEmail(params: {
  subject: string;
  bodyText: string;
  currency?: string;
  aiFn?: AiGenerateFn;
}): Promise<ParsedRfqResponse> {
  const aiFn = params.aiFn ?? makeDefaultAiFn();
  if (!aiFn) return { lines: [], currency: params.currency ?? "TRY" };

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
    const text = await aiFn(prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { lines: [], currency: params.currency ?? "TRY" };
    return JSON.parse(jsonMatch[0]) as ParsedRfqResponse;
  } catch (err) {
    logger.error({ err }, "RFQ response parsing failed");
    return { lines: [], currency: params.currency ?? "TRY" };
  }
}

// ─── parseRevisionRequest ─────────────────────────────────────────────────────
export async function parseRevisionRequest(params: {
  subject: string;
  bodyText: string;
  aiFn?: AiGenerateFn;
}): Promise<ParsedRevisionRequest> {
  const aiFn = params.aiFn ?? makeDefaultAiFn();
  if (!aiFn) return { notes: params.bodyText.slice(0, 500), urgency: "normal" };

  const prompt = `
Sen bir satış uzmanısın. Müşteriden gelen teklif revizyon talebini analiz et.

E-posta Konusu: ${params.subject}
E-posta İçeriği:
${params.bodyText.slice(0, 2000)}

Görevin: Müşterinin ne istediğini JSON formatında çıkar (SADECE JSON):

{
  "requestedDiscountPct": 10,
  "removedItems": ["Ürün A"],
  "addedItems": ["Ürün B"],
  "changedItems": [
    { "description": "Ürün C", "change": "Miktarı 3'ten 5'e çıkar" }
  ],
  "notes": "Müşteri %10 indirim istiyor ve teslimat süresini öğrenmek istiyor",
  "urgency": "normal"
}

Notlar:
- requestedDiscountPct: indirim yüzdesi bulamazsan null
- removedItems / addedItems / changedItems: ilgili değişiklik yoksa boş dizi []
- urgency: "low" | "normal" | "high" (aciliyet ifadesi varsa high)
- notes: kısa özet, Türkçe
`;

  try {
    const text = await aiFn(prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { notes: params.bodyText.slice(0, 500), urgency: "normal" };
    return JSON.parse(jsonMatch[0]) as ParsedRevisionRequest;
  } catch (err) {
    logger.error({ err }, "Revision request parsing failed");
    return { notes: params.bodyText.slice(0, 500), urgency: "normal" };
  }
}

// ─── generateRfqEmailBody ─────────────────────────────────────────────────────
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
