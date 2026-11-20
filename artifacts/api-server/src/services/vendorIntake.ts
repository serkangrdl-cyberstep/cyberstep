/** Tedarikçi ön sınıflandırması: 6 evet/hayır sorusu → risk alanları → önerilen en düşük kritiklik. */
export const RISK_DOMAINS = ["data", "cyber", "operational", "compliance", "ai", "fourthParty"] as const;
export type RiskDomain = (typeof RISK_DOMAINS)[number];
export type RiskDomains = Record<RiskDomain, boolean>;
export type Criticality = "kritik" | "onemli" | "standart";

export const INTAKE_QUESTIONS: Array<{ key: RiskDomain; label: string; question: string }> = [
  { key: "data", label: "Veri", question: "Tedarikçi müşteri, çalışan veya gizli iş verinize erişiyor mu?" },
  { key: "cyber", label: "Siber", question: "Tedarikçi sisteminize bağlanıyor mu (API, bulut, kimlik, ağ)?" },
  { key: "operational", label: "Operasyon", question: "Tedarikçi kritik bir iş sürecini destekliyor mu?" },
  { key: "compliance", label: "Uyum", question: "Tedarikçi mevzuat uyumunuzu (KVKK, BDDK, sektör düzenlemeleri) etkiliyor mu?" },
  { key: "ai", label: "Yapay zekâ", question: "Tedarikçi hizmetinde yapay zekâ kullanıyor mu?" },
  { key: "fourthParty", label: "Dördüncü taraf", question: "Tedarikçi verinizi alt hizmet sağlayıcılarla paylaşıyor olabilir mi?" },
];

/** Bilinmeyen anahtarları atar; geçersizse null. */
export function parseRiskDomains(raw: unknown): RiskDomains | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const out = {} as RiskDomains;
  for (const k of RISK_DOMAINS) out[k] = o[k] === true;
  return out;
}

/** Kural: operasyonel + (veri veya siber) ya da ≥4 alan → kritik; operasyonel veya (veri+siber) ya da ≥2 alan → önemli; aksi halde standart. */
export function suggestCriticality(d: RiskDomains | null): Criticality {
  if (!d) return "standart";
  const n = RISK_DOMAINS.filter((k) => d[k]).length;
  if ((d.operational && (d.data || d.cyber)) || n >= 4) return "kritik";
  if (d.operational || (d.data && d.cyber) || n >= 2) return "onemli";
  return "standart";
}

const RANK: Record<Criticality, number> = { standart: 0, onemli: 1, kritik: 2 };
/** Kullanıcının seçimi önerinin altındaysa öneriye yükseltilir; hiçbir zaman düşürülmez. */
export function effectiveCriticality(chosen: Criticality, d: RiskDomains | null): Criticality {
  const s = suggestCriticality(d);
  return RANK[s] > RANK[chosen] ? s : chosen;
}
