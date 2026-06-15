import { anthropic } from "@workspace/integrations-anthropic-ai";
import { buildSecurityContext } from "./buildSecurityContext";
import { logger } from "../logger";

export interface ActionItem {
  priority: number;
  title: string;
  description: string;
  effort: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  timeline: string;
  responsible: string;
  category: string;
}

export interface CostItem {
  action: string;
  estimated_cost_tl: string;
  cost_type: "one_time" | "monthly" | "annual";
  notes: string;
}

export interface BenchmarkData {
  sector_average_score: number;
  company_score: number;
  percentile: number;
  common_gaps: string[];
}

export interface SecurityReportOutput {
  executiveSummary: string;
  criticalActions: ActionItem[];
  mediumTermActions: ActionItem[];
  longTermActions: ActionItem[];
  costEstimates: CostItem[];
  benchmarkData: BenchmarkData;
  inputTokens?: number;
  outputTokens?: number;
}

export async function generateSecurityReport(
  customerId: number,
  _internalScanId: number,
): Promise<SecurityReportOutput> {
  const context = await buildSecurityContext(customerId);

  const systemPrompt = `Sen CyberStep'in kıdemli güvenlik danışmanısın (vCISO seviyesi).
Türkiye'deki KOBİ ve orta ölçekli şirketlere siber güvenlik danışmanlığı yapıyorsun.
Türk iş ortamını, KVKK mevzuatını ve yerel IT altyapısını iyi biliyorsun.
Önerilerin uygulanabilir, önceliklendirilmiş ve maliyet bilinçli olmalı.
KURAL: Her zaman JSON formatında yanıt ver. Başka metin ekleme.`;

  const userPrompt = `Aşağıdaki güvenlik verilerine dayanarak kapsamlı güvenlik raporu hazırla.

${context}

Şu JSON yapısında yanıt ver:
{
  "executive_summary": "3-4 paragraf. CEO'ya sunulabilir dil. Teknik terim kullanma. Mevcut durum, temel riskler ve önerilen yön.",

  "critical_actions": [
    {
      "priority": 1,
      "title": "Kısa aksiyon başlığı",
      "description": "Ne yapılacak, nasıl yapılacak, neden önemli",
      "effort": "low",
      "impact": "high",
      "timeline": "Bu hafta içinde",
      "responsible": "IT Yöneticisi",
      "category": "identity"
    }
  ],

  "medium_term_actions": [
    {
      "priority": 1,
      "title": "...",
      "description": "...",
      "effort": "medium",
      "impact": "high",
      "timeline": "30-60 gün içinde",
      "responsible": "...",
      "category": "..."
    }
  ],

  "long_term_actions": [
    {
      "priority": 1,
      "title": "...",
      "description": "...",
      "effort": "high",
      "impact": "high",
      "timeline": "6-12 ay içinde",
      "responsible": "...",
      "category": "..."
    }
  ],

  "cost_estimates": [
    {
      "action": "Hangi aksiyon için",
      "estimated_cost_tl": "Ücretsiz veya ₺X.XXX - ₺X.XXX",
      "cost_type": "one_time",
      "notes": "Açıklama veya alternatif çözüm"
    }
  ],

  "benchmark_data": {
    "sector_average_score": 55,
    "company_score": 62,
    "percentile": 60,
    "common_gaps": [
      "Sektörde en sık görülen eksiklik 1",
      "Sektörde en sık görülen eksiklik 2",
      "Sektörde en sık görülen eksiklik 3"
    ]
  }
}

Kritik aksiyonlar: maksimum 5 madde, en yüksek etkili olanlar.
Orta vadeli: maksimum 6 madde.
Uzun vadeli: maksimum 4 madde.
Maliyet tahmini: her kritik aksiyon için en az bir tahmini maliyet.
Tüm Türkçe yaz.`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 3000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const usage = response.usage;
  const text = response.content[0]?.type === "text" ? response.content[0].text : "";

  const clean = text.replace(/```json|```/g, "").trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(clean) as Record<string, unknown>;
  } catch (err) {
    logger.error({ err, text: text.slice(0, 300) }, "AI report JSON parse hatası");
    throw new Error("Rapor formatı geçersiz — tekrar deneyin");
  }

  return {
    executiveSummary: (parsed["executive_summary"] as string) ?? "",
    criticalActions: (parsed["critical_actions"] as ActionItem[]) ?? [],
    mediumTermActions: (parsed["medium_term_actions"] as ActionItem[]) ?? [],
    longTermActions: (parsed["long_term_actions"] as ActionItem[]) ?? [],
    costEstimates: (parsed["cost_estimates"] as CostItem[]) ?? [],
    benchmarkData: (parsed["benchmark_data"] as BenchmarkData) ?? {
      sector_average_score: 55,
      company_score: 0,
      percentile: 50,
      common_gaps: [],
    },
    inputTokens: usage?.input_tokens,
    outputTokens: usage?.output_tokens,
  };
}
