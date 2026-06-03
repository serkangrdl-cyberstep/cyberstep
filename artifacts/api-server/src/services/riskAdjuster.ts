// ─── WAF Bağlamında CVE Risk Ayarlayıcı ──────────────────────────────────────
// cveSummary dizisindeki her CVE'yi WAF varlığına göre değerlendirir.
// - WAF yok → değişmez
// - WAF var + bypass mümkün → not ekle, risk düşürme
// - WAF var + bypass yok → CVSS azalt, wafMitigated = true
// - Servis WAF-bağımsız ise (SSL, e-posta) → not ekle, risk değişmez

import { WAF_DISPLAY_NAMES } from "./wafDetector";

export interface AdjustedCve {
  service: string;
  cveId: string;
  description: string;
  cvssScore: number;
  adjustedCvssScore?: number;
  wafMitigated?: boolean;
  wafMitigationNote?: string;
}

// WAF azaltma oranları (bulgu türüne göre)
const WAF_REDUCTION: Record<string, { by: number; note: string }> = {
  critical: { by: 0.40, note: "WAF imzaları CVE istismarını kısmen engeller" },
  high:     { by: 0.35, note: "WAF imzaları CVE istismarını kısmen engeller" },
};

// WAF'ın etkisi olmayan servis kategorileri (e-posta, SSL vb.)
const WAF_IRRELEVANT_KEYWORDS = [
  "ssl", "tls", "smtp", "imap", "pop3", "mail", "dmarc", "spf", "dkim",
  "certificate", "sertifika",
];

function isWafIrrelevant(service: string): boolean {
  const lower = service.toLowerCase();
  return WAF_IRRELEVANT_KEYWORDS.some(kw => lower.includes(kw));
}

function scoreToCriticality(score: number): "critical" | "high" | "medium" | "low" {
  if (score >= 9.0) return "critical";
  if (score >= 7.0) return "high";
  if (score >= 4.0) return "medium";
  return "low";
}

export function adjustCvesForWAF(params: {
  cveSummary: Array<{ service: string; cveId: string; description: string; cvssScore: number }>;
  wafDetected: boolean;
  wafProvider: string | null;
  bypassPossible: boolean;
  headersAddedByWAF: string[];
}): AdjustedCve[] {
  const { cveSummary, wafDetected, wafProvider, bypassPossible } = params;

  // WAF yoksa hiçbir şey değişmez
  if (!wafDetected || !wafProvider) return cveSummary;

  const label = WAF_DISPLAY_NAMES[wafProvider] ?? wafProvider;

  return cveSummary.map((cve): AdjustedCve => {
    // WAF-bağımsız servisler — not ekle, risk değiştirme
    if (isWafIrrelevant(cve.service)) {
      return {
        ...cve,
        wafMitigated: false,
        wafMitigationNote: `${label} WAF bu bulguyu etkilemez — bağımsız düzeltme zorunludur.`,
      };
    }

    // Bypass mümkünse WAF sayılmaz
    if (bypassPossible) {
      return {
        ...cve,
        wafMitigated: false,
        wafMitigationNote:
          `${label} WAF aktif ancak kaynak sunucuya direkt IP erişimi mümkün — WAF bypass riski yüksek. Risk azaltımı uygulanmadı.`,
      };
    }

    // CVSS 7.0+ → WAF azaltması uygula
    if (cve.cvssScore >= 7.0) {
      const criticality = scoreToCriticality(cve.cvssScore);
      const reduction = WAF_REDUCTION[criticality === "critical" ? "critical" : "high"];
      const adjusted = parseFloat((cve.cvssScore * (1 - reduction.by)).toFixed(1));
      return {
        ...cve,
        adjustedCvssScore: adjusted,
        wafMitigated: true,
        wafMitigationNote:
          `${label} WAF aktif — ${reduction.note}. Pratik risk: CVSS ${cve.cvssScore} → ${adjusted}. ` +
          `Kaynak açık yamalanmadan WAF güvenilir değildir.`,
      };
    }

    // Düşük CVSS — sadece not ekle
    return {
      ...cve,
      wafMitigated: false,
      wafMitigationNote: `${label} WAF bu bulguyu kısmen hafifletir. Yama önerilir.`,
    };
  });
}
