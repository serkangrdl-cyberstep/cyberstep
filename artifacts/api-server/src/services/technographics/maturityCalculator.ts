import type { TechStack, MaturityResult } from "./types";

export function calculateMaturity(stack: TechStack[]): MaturityResult {
  let emailScore = 0;
  let webScore = 0;
  let infraScore = 100;
  let visibilityScore = 0;

  if (stack.find((s) => s.category === "mail_security" && s.vendor === "dmarc")) {
    const dmarc = stack.find((s) => s.vendor === "dmarc");
    if (dmarc?.product.includes("reject")) emailScore += 50;
    else if (dmarc?.product.includes("quarantine")) emailScore += 30;
    else emailScore += 10;
  }
  if (stack.find((s) => s.category === "mail_security" && s.product.toLowerCase().includes("spf"))) emailScore += 25;
  if (stack.find((s) => s.category === "mail_security" && s.product.toLowerCase().includes("dkim"))) emailScore += 25;
  if (stack.find((s) => ["proofpoint", "mimecast", "barracuda"].includes(s.vendor))) emailScore = Math.min(emailScore + 20, 100);

  if (stack.find((s) => s.category === "waf")) webScore += 35;
  if (stack.find((s) => s.category === "cdn")) webScore += 15;
  const missingHeaders = stack.filter((s) => s.category === "missing_header");
  webScore += Math.max(0, 35 - missingHeaders.length * 7);
  if (stack.find((s) => s.category === "tls_version" && s.securityRisk === "high")) webScore -= 20;
  const sslCA = stack.find((s) => s.category === "ssl_ca");
  if (sslCA?.salesSignal === "budget_indicator_high") webScore += 15;
  webScore = Math.max(0, Math.min(100, webScore));

  const criticalPorts = stack.filter((s) => s.category === "open_port" && s.securityRisk === "critical");
  infraScore -= criticalPorts.length * 25;
  const mediumPorts = stack.filter((s) => s.category === "open_port" && s.securityRisk === "medium");
  infraScore -= mediumPorts.length * 10;
  infraScore = Math.max(0, infraScore);

  if (stack.find((s) => s.category === "analytics")) visibilityScore += 30;
  if (stack.find((s) => s.category === "support")) visibilityScore += 25;
  if (stack.find((s) => s.category === "crm")) visibilityScore += 25;
  if (stack.find((s) => s.category === "monitoring")) visibilityScore += 20;

  const overall = Math.round(emailScore * 0.30 + webScore * 0.35 + infraScore * 0.25 + visibilityScore * 0.10);
  const level: MaturityResult["maturityLevel"] = overall >= 80 ? "enterprise" : overall >= 60 ? "high" : overall >= 35 ? "medium" : "low";

  const segment = determineSegment(stack);
  const recommendation = buildRecommendation(stack, overall, segment);

  return { maturityScore: overall, maturityLevel: level, scoreEmail: emailScore, scoreWeb: webScore, scoreInfra: infraScore, scoreVisibility: visibilityScore, companySegment: segment.name, segmentSignals: segment.signals, recommendedService: recommendation.service, recommendationReason: recommendation.reason };
}

function determineSegment(stack: TechStack[]): { name: string; signals: string[] } {
  const signals: string[] = [];
  const isEnterprise = stack.some((s) => s.vendor === "salesforce") || stack.some((s) => s.salesSignal === "budget_indicator_enterprise") || stack.some((s) => ["f5", "akamai", "proofpoint"].includes(s.vendor));
  if (isEnterprise) {
    if (stack.some((s) => s.vendor === "salesforce")) signals.push("Salesforce CRM");
    if (stack.some((s) => s.vendor === "akamai")) signals.push("Akamai CDN");
    return { name: "enterprise", signals };
  }
  const isMidMarket = stack.some((s) => s.salesSignal === "budget_indicator_high") || stack.some((s) => ["zendesk", "hubspot"].includes(s.vendor)) || stack.some((s) => s.vendor === "digicert");
  if (isMidMarket) {
    if (stack.some((s) => s.vendor === "hubspot")) signals.push("HubSpot CRM");
    if (stack.some((s) => s.vendor === "zendesk")) signals.push("Zendesk Support");
    return { name: "mid_market", signals };
  }
  return { name: "sme", signals: ["Let's Encrypt veya küçük CA"] };
}

function buildRecommendation(stack: TechStack[], score: number, segment: { name: string }): { service: string; reason: string } {
  if (stack.some((s) => s.category === "open_port" && s.securityRisk === "critical")) {
    return { service: "full_assessment", reason: "Kritik açık port tespit edildi — acil değerlendirme" };
  }
  if (stack.some((s) => s.vendor === "fortinet")) {
    return { service: "bundle_soc_noc_standart", reason: "FortiGate mevcut — SOC+NOC Fabric entegrasyonu önerilir" };
  }
  if (stack.some((s) => s.vendor === "microsoft" && s.category === "mail")) {
    return { service: "soc_standart", reason: "Microsoft 365 mevcut — M365 log entegrasyonu ile SOC" };
  }
  if (score < 35) {
    return { service: "bundle_starter", reason: "Güvenlik olgunluğu düşük — Başlangıç Paketi önerilir" };
  }
  if (stack.some((s) => s.category === "ecommerce")) {
    return { service: "bundle_full_protection", reason: "E-ticaret sitesi — müşteri verisi ve ödeme güvenliği kritik" };
  }
  return { service: "bundle_full_protection", reason: "Kapsamlı güvenlik değerlendirmesi önerilir" };
}

export function buildPersonalizedISRContext(stack: TechStack[], maturity: MaturityResult): string {
  const lines: string[] = [];
  const mail = stack.find((s) => s.category === "mail");
  if (mail?.vendor === "microsoft") lines.push("Microsoft 365 kullanıcısı — Azure Monitor + M365 SOC entegrasyonu önerilebilir");
  else if (mail?.vendor === "google") lines.push("Google Workspace kullanıcısı — Google Admin log entegrasyonu önerilebilir");
  if (stack.some((s) => s.vendor === "fortinet")) lines.push("FortiGate tespit edildi — Fortinet Fabric SOC entegrasyonu ana argüman");
  const critPorts = stack.filter((s) => s.category === "open_port" && s.securityRisk === "critical");
  if (critPorts.length > 0) lines.push(`KRİTİK: ${critPorts.map((p) => p.product).join(", ")} — e-postada direkt belirt`);
  if (maturity.companySegment === "enterprise") lines.push("Enterprise segment — SOC Pro / Kurumsal paket öner");
  else if (maturity.companySegment === "mid_market") lines.push("Mid-market segment — SOC Standart / Tam Koruma Paketi öner");
  if (stack.some((s) => s.category === "ecommerce")) {
    const platform = stack.find((s) => s.category === "ecommerce");
    lines.push(`E-ticaret: ${platform?.product} — ödeme güvenliği ve müşteri verisi vurgula`);
  }
  return lines.join("\n");
}
