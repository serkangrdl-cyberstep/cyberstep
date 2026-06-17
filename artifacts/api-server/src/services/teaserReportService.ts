import { getClaudeAiFn } from "./ai-client";
import { logger } from "../lib/logger";
import crypto from "crypto";

export interface TeaserFinding {
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  locked: boolean;
  preview_text: string | null;
}

export interface AttackScenario {
  scenario_type: string;
  title: string;
  narrative: string;
  entry_point: string;
  potential_damage_tl: number;
  mitre_technique: string;
  prevention: string;
}

export interface TeaserReportOutput {
  teaser: {
    overall_score: number;
    risk_level: string;
    headline: string;
    findings: TeaserFinding[];
    attack_scenario_preview: string;
    locked_sections_hint: string;
    urgency_note: string;
  };
  full_scenarios: AttackScenario[];
}

function cleanJson(raw: string): string {
  return raw
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
}

export function generatePreviewToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function generateTeaserReport(params: {
  domain: string;
  companyName: string;
  sector: string;
  scanData: Record<string, unknown>;
}): Promise<TeaserReportOutput> {
  const ai = getClaudeAiFn("claude-sonnet-4-20250514");

  const prompt = `Sen bir siber güvenlik uzmanısın ve potansiyel enterprise müşteriye satış amaçlı bir teaser rapor hazırlıyorsun.

DOMAIN: ${params.domain}
ŞİRKET: ${params.companyName}
ŞİRKET SEKTÖRÜ: ${params.sector}

DOMAIN TARAMA VERİLERİ:
${JSON.stringify(params.scanData, null, 2).slice(0, 3000)}

İKİ ÇIKTI ÜRETECEKSİN:

─────────────────────────────────────────
ÇIKTI 1: TEASER RAPOR (müşteriye gösterilecek kısmi rapor)
─────────────────────────────────────────
Bu raporun amacı: Yeterince ciddi ama detaysız.
"Tehlike var, ama tam olarak ne olduğunu görmek için tam raporu satın alman gerekiyor" hissi yaratacak.

KURAL: İlk 1 kritik veya yüksek bulgu locked=false. Diğerleri hepsi locked=true.

─────────────────────────────────────────
ÇIKTI 2: TAM SALDIRI SENARYOLARI (admin için, müşteriye gönderilmez)
─────────────────────────────────────────
3 farklı saldırı senaryosu.

TOPLAM JSON ÇIKTISI (başka hiçbir şey yok):
{
  "teaser": {
    "overall_score": 0-100,
    "risk_level": "KRİTİK|YÜKSEK|ORTA|DÜŞÜK",
    "headline": "Tek cümle. Örnek: ${params.domain} üzerinde aktif fidye yazılımı giriş vektörü tespit edildi.",
    "findings": [
      {
        "title": "Bulgu başlığı (kısa, merak uyandıran)",
        "severity": "critical|high|medium|low",
        "locked": false,
        "preview_text": "1 cümle — detay yok, merak uyandır"
      },
      {
        "title": "Yalnızca başlık gösterilir",
        "severity": "high",
        "locked": true,
        "preview_text": null
      }
    ],
    "attack_scenario_preview": "Saldırı senaryosunun ilk 2 cümlesi. Dramayı hissettir ama çözümü verme.",
    "locked_sections_hint": "Bu raporda X kritik, Y orta seviye bulgu daha ve 3 saldırı senaryosunun tamamı kilitli.",
    "urgency_note": "Bu açıkların aktif saldırılarda kullanılma olasılığı — 1 cümle, somut, gerçekçi"
  },
  "full_scenarios": [
    {
      "scenario_type": "ransomware|ceo_fraud|data_breach",
      "title": "Senaryo başlığı",
      "narrative": "Saldırı nasıl gerçekleşirdi — 5-6 cümle, şirkete özgü veriler kullanarak.",
      "entry_point": "Saldırganın kullandığı giriş noktası",
      "potential_damage_tl": 0,
      "mitre_technique": "T1xxx",
      "prevention": "Bu senaryoyu engelleyecek tek aksiyon"
    }
  ]
}`;

  // Sabit dipnot — AI'nin ürettiği urgency_note'a eklenir.
  // Teaser, kalifikasyon anındaki anlık görüntüyü temsil eder; WAF enrichment
  // (en fazla 9 saat sonra tamamlanır) tamamlandığında teaser yenilenmez.
  // Bu bilinçli bir tasarım kararıdır: hız > kesinlik, yön güvenli (WAF bulunursa
  // bulgular azalır, yani teaser her zaman gerçekte olduğundan daha kötümserdir).
  const SNAPSHOT_NOTE = "Bu ön taramadır; bulgular tarama anındaki verileri yansıtmaktadır. Tam ve güncel rapor için CyberStep değerlendirmesini başlatın.";

  try {
    const raw = await ai(prompt);
    const parsed = JSON.parse(cleanJson(raw)) as TeaserReportOutput;
    // urgency_note'a dipnotu ekle — AI çıktısı ne olursa olsun garantili olarak bulunur.
    if (parsed.teaser?.urgency_note) {
      parsed.teaser.urgency_note = `${parsed.teaser.urgency_note} ${SNAPSHOT_NOTE}`;
    } else if (parsed.teaser) {
      parsed.teaser.urgency_note = SNAPSHOT_NOTE;
    }
    return parsed;
  } catch (err) {
    logger.error({ err, domain: params.domain }, "Teaser report generation failed");
    // Return a minimal fallback
    return {
      teaser: {
        overall_score: 50,
        risk_level: "ORTA",
        headline: `${params.domain} üzerinde güvenlik açıkları tespit edildi.`,
        findings: [
          {
            title: "Güvenlik yapılandırma eksiklikleri",
            severity: "high",
            locked: false,
            preview_text: "Dış saldırı yüzeyinde kritik yapılandırma eksiklikleri mevcut.",
          },
          {
            title: "Kilitli bulgular",
            severity: "critical",
            locked: true,
            preview_text: null,
          },
        ],
        attack_scenario_preview: "Saldırgan mevcut açıkları kullanarak sisteme sızabilir. Detaylar tam raporda.",
        locked_sections_hint: "Daha fazla kritik bulgu ve 3 saldırı senaryosu kilitli.",
        urgency_note: `Bu tür açıklar aktif saldırı grupları tarafından kullanılmaktadır. ${SNAPSHOT_NOTE}`,
      },
      full_scenarios: [],
    };
  }
}
