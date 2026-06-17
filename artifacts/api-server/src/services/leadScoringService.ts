import { getClaudeAiFn } from "./ai-client";
import { logger } from "../lib/logger";

// ─── Domain eleme filtresi ────────────────────────────────────────────────────

const EXCLUDED_TLDS = [
  ".gov.tr", ".edu.tr", ".k12.tr", ".mil.tr", ".pol.tr",
];

const EXCLUDED_EXACT_DOMAINS = new Set([
  "tobb.org.tr", "tusiad.org", "tesk.org.tr",
  "halkbank.com.tr", "ziraatbank.com.tr",
  "vakifbank.com.tr", "isbank.com.tr",
  "garanti.com.tr", "akbank.com",
]);

const EXCLUDED_ASN_KEYWORDS = [
  "odalar ve borsalar", "bakanlık", "bakanlik", "bakanligi",
  "üniversite", "universite", "university", "hükümeti", "hukumeti",
  "devlet", "kamu",
];

export function shouldExcludeFromPipeline(
  domain: string,
  shodanOrg: string | null,
): { exclude: boolean; reason: string } {
  const d = domain.toLowerCase();

  for (const tld of EXCLUDED_TLDS) {
    if (d.endsWith(tld)) return { exclude: true, reason: `Kamu TLD: ${tld}` };
  }

  if (EXCLUDED_EXACT_DOMAINS.has(d)) {
    return { exclude: true, reason: "Hariç tutulan domain" };
  }

  const orgLower = (shodanOrg ?? "").toLowerCase();
  for (const kw of EXCLUDED_ASN_KEYWORDS) {
    if (orgLower.includes(kw)) return { exclude: true, reason: `Kurum tipi: ${kw}` };
  }

  return { exclude: false, reason: "" };
}

// ─── CVE breakdown hesaplayıcı ────────────────────────────────────────────────

export interface CVEBreakdown {
  total: number;
  critical: number;
  high: number;
  medium: number;
  informational: number;
  cisaKev: number;
}

export function computeCVEBreakdown(
  cveSummary: Array<{ cvssScore: number; cveId?: string }>,
  cisaKevIds: string[] = [],
): CVEBreakdown {
  const kevSet = new Set(cisaKevIds.map(id => id.toUpperCase()));
  let critical = 0, high = 0, medium = 0, informational = 0, cisaKev = 0;

  for (const cve of cveSummary) {
    const score = cve.cvssScore ?? 0;
    if (score >= 9.0) critical++;
    else if (score >= 7.0) high++;
    else if (score >= 4.0) medium++;
    else informational++;

    if (cve.cveId && kevSet.has(cve.cveId.toUpperCase())) cisaKev++;
  }

  return { total: cveSummary.length, critical, high, medium, informational, cisaKev };
}

export type AiScoreStatus = "scored" | "failed" | "timeout" | "rate_limited";

export interface LeadScoreResult {
  score: number | null;
  status: AiScoreStatus;
  factors: Record<string, number | string>;
}

function cleanJson(raw: string): string {
  return raw
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
}

function classifyError(err: unknown): AiScoreStatus {
  const msg = String(err).toLowerCase();
  if (msg.includes("timeout") || msg.includes("etimedout") || msg.includes("econnreset")) return "timeout";
  if (msg.includes("429") || msg.includes("rate limit") || msg.includes("too many requests")) return "rate_limited";
  return "failed";
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
    const parsed = JSON.parse(cleanJson(raw)) as { score: number; factors: Record<string, number | string> };
    return { score: parsed.score, status: "scored", factors: parsed.factors };
  } catch (err) {
    const status = classifyError(err);
    logger.error({ err, domain, status }, "Lead scoring failed");
    return {
      score: null,
      status,
      factors: { reasoning: `Otomatik puanlama başarısız (${status})` },
    };
  }
}
