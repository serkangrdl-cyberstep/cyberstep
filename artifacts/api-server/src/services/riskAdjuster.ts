// ─── WAF Bağlamında CVE Risk Ayarlayıcı ──────────────────────────────────────
// cveSummary dizisindeki her CVE'yi WAF varlığına ve güven seviyesine göre değerlendirir.
// - WAF yok → değişmez
// - WAF var + bypass mümkün → not ekle, risk düşürme yok
// - WAF var, low confidence → not ekle, risk düşürme yok ("WAF olası ama doğrulanamadı")
// - WAF var, medium confidence → azaltmayı yarıya indir (×0.80 / ×0.825)
// - WAF var, high confidence + bypass yok → tam azaltma (×0.60 / ×0.65)
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

// WAF azaltma oranları — güven seviyesine göre kademelendirme
const WAF_REDUCTION: Record<"high" | "medium", Record<"critical" | "high", { by: number; note: string }>> = {
  high: {
    critical: { by: 0.40, note: "WAF imzaları CVE istismarını kısmen engeller (yüksek güven)" },
    high:     { by: 0.35, note: "WAF imzaları CVE istismarını kısmen engeller (yüksek güven)" },
  },
  medium: {
    critical: { by: 0.20, note: "WAF sinyali orta güvende — azaltma yarı uygulandı" },
    high:     { by: 0.175, note: "WAF sinyali orta güvende — azaltma yarı uygulandı" },
  },
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
  wafConfidenceLevel?: "high" | "medium" | "low" | null;
}): AdjustedCve[] {
  const { cveSummary, wafDetected, wafProvider, bypassPossible, wafConfidenceLevel } = params;

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

    // Low confidence → azaltma yok, sadece uyarı notu
    if (!wafConfidenceLevel || wafConfidenceLevel === "low") {
      return {
        ...cve,
        wafMitigated: false,
        wafMitigationNote:
          `${label} WAF sinyali düşük güvende — doğrulanamadı. CVSS ${cve.cvssScore} olduğu gibi gösteriliyor. Bağımsız doğrulama önerilir.`,
      };
    }

    // CVSS 7.0+ → güven seviyesine göre kademeli WAF azaltması
    if (cve.cvssScore >= 7.0) {
      const criticality = scoreToCriticality(cve.cvssScore);
      const tier = wafConfidenceLevel === "high" ? "high" : "medium";
      const reduction = WAF_REDUCTION[tier][criticality === "critical" ? "critical" : "high"];
      const adjusted = parseFloat((cve.cvssScore * (1 - reduction.by)).toFixed(1));
      return {
        ...cve,
        adjustedCvssScore: adjusted,
        wafMitigated: true,
        wafMitigationNote:
          `${label} WAF aktif (${wafConfidenceLevel === "high" ? "yüksek" : "orta"} güven) — ${reduction.note}. ` +
          `Pratik risk: CVSS ${cve.cvssScore} → ${adjusted}. Kaynak açık yamalanmadan WAF güvenilir değildir.`,
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
