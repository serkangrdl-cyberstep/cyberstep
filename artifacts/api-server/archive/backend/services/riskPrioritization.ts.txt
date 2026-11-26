export interface RiskScoreParams {
  cvssScore: number;
  epssScore: number;
  businessImpact: string;
  isExternallyReachable: boolean;
  hasActiveExploit: boolean;
  threatActorTargeting: boolean;
}

export function calculateUnifiedRiskScore(params: RiskScoreParams): number {
  const businessWeight: Record<string, number> = {
    critical: 1.0,
    high: 0.8,
    medium: 0.5,
    low: 0.3,
  };

  const bw = businessWeight[params.businessImpact] ?? 0.5;

  const baseScore =
    (params.cvssScore / 10) * 0.25 +
    params.epssScore * 0.35 +
    bw * 0.25 +
    (params.isExternallyReachable ? 0.1 : 0) +
    (params.hasActiveExploit ? 0.05 : 0) +
    (params.threatActorTargeting ? 0.05 : 0);

  return Math.min(100, Math.round(baseScore * 100));
}

export function getSLADays(severity: string): number {
  const map: Record<string, number> = { critical: 7, high: 14, medium: 30, low: 90 };
  return map[severity] ?? 30;
}

export function getSLADeadline(severity: string): Date {
  const days = getSLADays(severity);
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

// Bulgu tipinden MITRE tekniğine mapping
export const FINDING_TO_MITRE_MAP: Record<string, { technique: string; tactic: string }> = {
  no_dmarc:          { technique: "T1566", tactic: "Initial Access" },
  no_spf:            { technique: "T1566", tactic: "Initial Access" },
  ssl_expired:       { technique: "T1557", tactic: "Credential Access" },
  open_rdp_port:     { technique: "T1021.001", tactic: "Lateral Movement" },
  open_ssh_port:     { technique: "T1021.004", tactic: "Lateral Movement" },
  blacklisted:       { technique: "T1583", tactic: "Resource Development" },
  leaked_credential: { technique: "T1078", tactic: "Persistence" },
  public_s3_bucket:  { technique: "T1530", tactic: "Collection" },
  open_security_group: { technique: "T1190", tactic: "Initial Access" },
  mfa_not_enabled:   { technique: "T1078", tactic: "Persistence" },
  aws_access_key:    { technique: "T1552.005", tactic: "Credential Access" },
  github_token:      { technique: "T1552.001", tactic: "Credential Access" },
  private_key:       { technique: "T1552.004", tactic: "Credential Access" },
};
