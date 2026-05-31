import { getClaudeAiFn } from "./ai-client";
import { logger } from "../lib/logger";

export interface LeadScoreResult {
  score: number;
  factors: Record<string, number | string>;
}

function cleanJson(raw: string): string {
  return raw
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
}

export async function scoreLeadWithAI(
  domain: string,
  companyName: string | null,
  scanData: Record<string, unknown>
): Promise<LeadScoreResult> {
  try {
    const ai = getClaudeAiFn();
    const prompt = `Bir siber güvenlik satış temsilcisi için potansiyel müşteri değerlendirmesi yap.

Şirket: ${companyName ?? domain}
Domain: ${domain}
Tarama verisi özeti:
${JSON.stringify(scanData, null, 2).slice(0, 2000)}

Aşağıdaki faktörlere göre 0-100 arası bir lead skoru üret:
- risk_score (20 puan): Risk skoru yüksekse → siber güvenlik ihtiyacı yüksek
- critical_count (20 puan): Kritik bulgu sayısı
- company_size_signal (15 puan): Şirket büyüklüğü sinyali
- urgency_signal (20 puan): Aciliyet sinyali (aktif saldırı, bilinen açıklar)
- conversion_potential (25 puan): Dönüşüm potansiyeli

JSON formatında döndür (başka hiçbir şey yok):
{
  "score": 0-100,
  "factors": {
    "risk_score": <0-20>,
    "critical_count": <0-20>,
    "company_size_signal": <0-15>,
    "urgency_signal": <0-20>,
    "conversion_potential": <0-25>,
    "reasoning": "kısa açıklama"
  }
}`;

    const raw = await ai(prompt);
    const parsed = JSON.parse(cleanJson(raw)) as LeadScoreResult;
    return parsed;
  } catch (err) {
    logger.error({ err, domain }, "Lead scoring failed — using default score");
    return {
      score: 30,
      factors: { reasoning: "Otomatik puanlama başarısız" },
    };
  }
}
