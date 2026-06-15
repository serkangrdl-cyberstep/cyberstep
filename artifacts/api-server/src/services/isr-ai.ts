import { GoogleGenAI } from "@google/genai";
import { logger } from "../lib/logger";

// ─── Replit-managed Gemini client (for ISR email tasks) ───────────────────────
function getClient() {
  const apiKey = process.env["AI_INTEGRATIONS_GEMINI_API_KEY"];
  const baseUrl = process.env["AI_INTEGRATIONS_GEMINI_BASE_URL"];
  if (!apiKey || !baseUrl) return null;
  return new GoogleGenAI({ apiKey, httpOptions: { apiVersion: "", baseUrl } });
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

// ─── parseDealRequest ─────────────────────────────────────────────────────────
export interface ParsedDealRequest {
  customerCompany?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  vendorName?: string;
  productKeywords?: string;
  quantity?: string;
  priority: "low" | "normal" | "high" | "urgent";
  aiSummary: string;
  aiPriorityReason: string;
  isCompetitiveDeal: boolean;
  estimatedCloseWeeks?: number;
}

export async function parseDealRequest(params: {
  requestText: string;
  vendorNames: string[];
  existingCustomers: Array<{ companyName: string; contactName?: string | null }>;
  aiFn?: AiGenerateFn;
}): Promise<ParsedDealRequest> {
  const aiFn = params.aiFn ?? makeDefaultAiFn();
  if (!aiFn) {
    return {
      priority: "normal",
      aiSummary: params.requestText.slice(0, 200),
      aiPriorityReason: "AI yapılandırılmamış",
      isCompetitiveDeal: false,
    };
  }

  const customerList = params.existingCustomers.slice(0, 20)
    .map((c) => `${c.companyName}${c.contactName ? ` (${c.contactName})` : ""}`)
    .join(", ");

  const prompt = `Sen deneyimli bir B2B satış asistanısın. Satış temsilcisinin kısa notunu analiz et.

Satış Temsilcisi Notu:
"${params.requestText}"

Bilinen Vendorlar: ${params.vendorNames.join(", ") || "belirtilmemiş"}
Kayıtlı Müşteriler (referans): ${customerList || "henüz yok"}

Görevi: Notu analiz et ve aşağıdaki JSON formatında (SADECE JSON, markdown olmadan) döndür:

{
  "customerCompany": "Şirket adı (bulunamazsa null)",
  "contactName": "İletişim kişisi adı (bulunamazsa null)",
  "contactEmail": "E-posta (bulunamazsa null)",
  "contactPhone": "Telefon (bulunamazsa null)",
  "vendorName": "Eşleşen vendor adı, bilinen vendorlardan biri veya metinden çıkar (bulunamazsa null)",
  "productKeywords": "Ürün/hizmet özeti — örn: 'FortiGate 100F x50, 1 yıl destek'",
  "quantity": "Miktar — örn: '50 adet' (bulunamazsa null)",
  "priority": "low|normal|high|urgent",
  "aiSummary": "1-2 cümle özet: kim, ne istiyor, önemli not (Türkçe)",
  "aiPriorityReason": "Neden bu öncelik? (Türkçe, kısa)",
  "isCompetitiveDeal": true/false,
  "estimatedCloseWeeks": null
}

Öncelik belirleme kuralları:
- urgent: deadline var, acil, bugün/yarın gibi ifadeler
- high: rakip var, fiyat hassasiyeti, müşteri karar aşamasında
- normal: standart talep
- low: bilgi amaçlı, bütçe yok, erken araştırma`;

  try {
    const text = await aiFn(prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        aiSummary: params.requestText.slice(0, 200),
        priority: "normal",
        aiPriorityReason: "Parse edilemedi",
        isCompetitiveDeal: false,
      };
    }
    const parsed = JSON.parse(jsonMatch[0]) as ParsedDealRequest;
    return {
      ...parsed,
      priority: (["low", "normal", "high", "urgent"].includes(parsed.priority) ? parsed.priority : "normal"),
      aiSummary: parsed.aiSummary ?? params.requestText.slice(0, 200),
      aiPriorityReason: parsed.aiPriorityReason ?? "",
      isCompetitiveDeal: parsed.isCompetitiveDeal ?? false,
    };
  } catch (err) {
    logger.error({ err }, "Deal request parsing failed");
    return {
      aiSummary: params.requestText.slice(0, 200),
      priority: "normal",
      aiPriorityReason: "Parse hatası",
      isCompetitiveDeal: false,
    };
  }
}

// ─── getNextBestAction ────────────────────────────────────────────────────────
export interface NextBestAction {
  title: string;
  description: string;
  urgency: "low" | "normal" | "high" | "urgent";
  category: "follow_up" | "send_offer" | "contact" | "internal" | "close";
}

export async function getNextBestAction(params: {
  deal: {
    status: string;
    priority: string;
    customerCompany?: string | null;
    customerName?: string | null;
    vendorName?: string | null;
    productKeywords?: string | null;
    aiSummary?: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  rfqCount: number;
  quoteCount: number;
  lastActivityDate?: Date | null;
  recentActivities?: Array<{ type: string; title: string; createdAt: Date }>;
  aiFn?: AiGenerateFn;
}): Promise<NextBestAction[]> {
  const aiFn = params.aiFn ?? makeDefaultAiFn();
  if (!aiFn) return [];

  const daysSinceUpdate = Math.floor((Date.now() - params.deal.updatedAt.getTime()) / 86400000);
  const daysSinceCreate = Math.floor((Date.now() - params.deal.createdAt.getTime()) / 86400000);
  const lastActivitySummary = params.recentActivities?.slice(0, 3)
    .map(a => `- ${a.type}: ${a.title} (${Math.floor((Date.now() - a.createdAt.getTime()) / 86400000)} gün önce)`)
    .join("\n") ?? "Henüz aktivite yok";

  const prompt = `Sen bir IT çözüm satış asistanısın. Aşağıdaki deal durumunu analiz et ve satış temsilcisine 3 somut "next best action" öner.

DEAL BİLGİLERİ:
- Müşteri: ${params.deal.customerCompany ?? params.deal.customerName ?? "Bilinmiyor"}
- Vendor: ${params.deal.vendorName ?? "Belirsiz"}
- Durum: ${params.deal.status}
- Öncelik: ${params.deal.priority}
- Ürün/Talep: ${params.deal.productKeywords ?? params.deal.aiSummary ?? "Belirtilmemiş"}
- Son güncelleme: ${daysSinceUpdate} gün önce
- Oluşturulma: ${daysSinceCreate} gün önce
- RFQ sayısı: ${params.rfqCount}
- Teklif sayısı: ${params.quoteCount}
- Son aktiviteler:\n${lastActivitySummary}

Durum açıklamaları: new=yeni talep, rfq_sent=distribütörden fiyat bekleniyor, quoted=teklif hazır müşteriye gönderilmedi, revision_requested=müşteri revizyon istedi, approved=onaylandı, sent=müşteriye gönderildi, won=kazanıldı, lost=kaybedildi

3 aksiyon öner. JSON formatında yanıt ver (başka hiçbir şey yazma):
[
  {
    "title": "Kısa aksiyon başlığı (maks 8 kelime)",
    "description": "Ne yapılmalı ve neden (1-2 cümle)",
    "urgency": "low|normal|high|urgent",
    "category": "follow_up|send_offer|contact|internal|close"
  }
]`;

  try {
    const raw = await aiFn(prompt);
    const jsonStr = raw.match(/\[[\s\S]*\]/)?.[0] ?? "[]";
    const parsed = JSON.parse(jsonStr) as NextBestAction[];
    return parsed.slice(0, 3);
  } catch (err) {
    logger.error({ err }, "Next best action generation failed");
    return [];
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

// ─── ISR Copilot — AI destekli satış rehberi ─────────────────────────────────
export interface CopilotContent {
  musteri_ozeti: string;
  satis_acisi: string;
  aciliyet_faktoru: string;
  onerilen_paket: { isim: string; fiyat: string; neden: string[] };
  gorusmede_sor: Array<{ soru: string; amac: string }>;
  itirazlar: Array<{ itiraz: string; cevap: string }>;
  linkedin_mesaji: string;
  followup_mail_d3: { konu: string; icerik: string };
  followup_mail_d7: { konu: string; icerik: string };
  bir_sonraki_adim: string;
  upsell_zamani: string;
}

export async function generateIsrCopilot(deal: {
  customerCompany: string | null;
  customerName: string | null;
  requestText: string | null;
  aiSummary: string | null;
  originalBody: string | null;
  productKeywords: string | null;
  status: string;
  priority: string;
  vendorName: string | null;
  createdAt: Date;
}): Promise<CopilotContent> {
  const ai = makeDefaultAiFn();
  if (!ai) throw new Error("AI servisi kullanılamıyor");

  const summary = `Şirket: ${deal.customerCompany ?? "Bilinmiyor"}
İletişim: ${deal.customerName ?? "Bilinmiyor"}
Durum: ${deal.status}
Öncelik: ${deal.priority}
Vendor: ${deal.vendorName ?? "Belirtilmemiş"}
Ürün/Anahtar Kelimeler: ${deal.productKeywords ?? "—"}

AI Özet: ${deal.aiSummary ?? "—"}

Talep Metni:
${(deal.requestText ?? deal.originalBody ?? "Bilgi yok").slice(0, 800)}`;

  const prompt = `Sen CyberStep'in ISR (İç Satış Temsilcisi) asistanısın.
Türkiye'deki şirketlere siber güvenlik SaaS ve donanım/yazılım çözümleri satıyorsunuz.

Ürün kataloğu:
- Kalkan Paketi: ₺2.990/ay — Dış saldırı yüzeyi izleme, SSL takibi, aylık rapor
- Zırh Paketi: ₺5.990/ay — Kalkan + gelişmiş tehdit istihbaratı + öncelikli destek
- vCISO Danışmanlık: ₺4.990/ay — Teknik rehberlik, KVKK uyum yol haritası, haftalık görüşme
- AI Saldırı Analizi: ₺4.990 tek seferlik — Derinlemesine güvenlik raporu

ISR teknik değil, satış odaklı. Karmaşık terimler kullanma. Türkçe yaz.

Aşağıdaki lead için ISR satış rehberi hazırla:

${summary}

Oluşturulma: ${deal.createdAt.toLocaleDateString("tr-TR")}

Şu JSON formatında yanıt ver (yalnızca JSON, açıklama ekleme):
{
  "musteri_ozeti": "2-3 cümle, ISR'nin okuyup hemen anlayacağı sade özet",
  "satis_acisi": "Bu müşteri için en güçlü satış açısı (tek paragraf)",
  "aciliyet_faktoru": "Neden şimdi harekete geçmeli (somut, tarih/rakam ile)",
  "onerilen_paket": {
    "isim": "paket adı",
    "fiyat": "₺X/ay",
    "neden": ["1. neden", "2. neden", "3. neden"]
  },
  "gorusmede_sor": [
    {"soru": "soru metni", "amac": "bu soruyu neden soruyoruz"},
    {"soru": "soru metni", "amac": "..."},
    {"soru": "soru metni", "amac": "..."}
  ],
  "itirazlar": [
    {"itiraz": "Fiyat pahalı", "cevap": "..."},
    {"itiraz": "Şu an ihtiyacımız yok", "cevap": "..."},
    {"itiraz": "Başka bir sistemimiz var", "cevap": "..."}
  ],
  "linkedin_mesaji": "150 kelime altı, doğal, satışçı olmayan LinkedIn mesaj taslağı",
  "followup_mail_d3": {
    "konu": "mail konusu",
    "icerik": "mail içeriği (3-4 paragraf, düz metin)"
  },
  "followup_mail_d7": {
    "konu": "mail konusu",
    "icerik": "mail içeriği (daha kısa, daha acil ton)"
  },
  "bir_sonraki_adim": "ISR şu an ne yapmalı (tek net aksiyon)",
  "upsell_zamani": "Hangi koşulda üst pakete geçiş önerilmeli"
}`;

  const text = await ai(prompt);
  const clean = text.replace(/```json|```/g, "").trim();

  const parsed = JSON.parse(clean) as CopilotContent;
  // Ensure neden is always an array
  if (parsed.onerilen_paket && typeof parsed.onerilen_paket.neden === "string") {
    parsed.onerilen_paket.neden = (parsed.onerilen_paket.neden as unknown as string)
      .split(/\n|;/)
      .map((s: string) => s.trim())
      .filter(Boolean);
  }
  return parsed;
}
