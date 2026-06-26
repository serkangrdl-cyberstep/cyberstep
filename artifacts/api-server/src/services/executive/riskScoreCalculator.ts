export interface CustomerScanSummary {
  criticalCveCount: number;
  highCveCount: number;
  blacklistedDomainCount: number;
  sslInvalidCount: number;
  sslExpiringSoonCount: number; // <= 7 days
  mailIssueCount: number;       // mail_reputation_score < 50
  brandSuspiciousCount: number;
  highRiskPortCount: number;    // ports: 22, 3389, 23, 5900 open
}

export interface RiskLevel {
  label: "Düşük Risk" | "Orta Risk" | "Yüksek Risk" | "Kritik Risk";
  color: "green" | "amber" | "orange" | "red";
}

export function getRiskLevel(score: number): RiskLevel {
  if (score >= 80) return { label: "Düşük Risk",    color: "green"  };
  if (score >= 60) return { label: "Orta Risk",     color: "amber"  };
  if (score >= 40) return { label: "Yüksek Risk",   color: "orange" };
  return              { label: "Kritik Risk",    color: "red"    };
}

export async function calculateCustomerRiskScore(
  _customerId: number,
  scanData: CustomerScanSummary,
): Promise<number> {
  let score = 100;

  // Critical CVE: -8 each, max -40
  score -= Math.min(scanData.criticalCveCount * 8, 40);

  // High CVE: -3 each, max -15
  score -= Math.min(scanData.highCveCount * 3, 15);

  // Blacklisted domain: -10 each, max -20
  score -= Math.min(scanData.blacklistedDomainCount * 10, 20);

  // SSL invalid: -8 flat
  score -= Math.min(scanData.sslInvalidCount * 8, 8);

  // SSL < 7 days: -5 flat
  score -= Math.min(scanData.sslExpiringSoonCount * 5, 5);

  // Mail reputation < 50: -3 each, max -9
  score -= Math.min(scanData.mailIssueCount * 3, 9);

  // Suspicious brand variant: -5 each, max -15
  score -= Math.min(scanData.brandSuspiciousCount * 5, 15);

  // High-risk port open: -4 each, max -12
  score -= Math.min(scanData.highRiskPortCount * 4, 12);

  return Math.max(0, score);
}
