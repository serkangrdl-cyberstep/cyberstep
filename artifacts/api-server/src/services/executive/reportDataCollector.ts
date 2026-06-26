import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import {
  calculateCustomerRiskScore,
  type CustomerScanSummary,
} from "./riskScoreCalculator";

export interface ExecutiveReportData {
  customerId: number;
  customerEmail: string;
  companyName: string | null;
  primaryDomain: string | null;

  // CVE
  criticalCveCount: number;
  highCveCount: number;

  // Attack surface
  totalDomainsMonitored: number;
  subdomainsDiscovered: number;

  // Reputation
  blacklistedCount: number;
  sslExpiringCount: number;  // <= 30 days
  sslInvalidCount: number;
  mailIssuesCount: number;

  // Brand
  brandVariantsActive: number;
  brandSuspiciousCount: number;

  // Port exposure
  highRiskPortsCount: number;

  // Scores
  riskScoreCurrent: number;
  riskScorePrevious: number | null;
  riskScoreChange: number | null;
}

const HIGH_RISK_PORTS = new Set([22, 3389, 23, 5900]);

export async function collectCustomerReportData(
  customerId: number,
  _periodStart: Date,
  _periodEnd: Date,
): Promise<ExecutiveReportData> {

  // 1. Get customer basic info
  const custRows = await db.execute(sql`
    SELECT email, full_name, company_name
    FROM customers
    WHERE id = ${customerId}
    LIMIT 1
  `);
  const cust = custRows.rows[0] as {
    email: string;
    full_name: string;
    company_name: string | null;
  } | undefined;

  const customerEmail = cust?.email ?? "";
  const companyName   = cust?.company_name ?? null;

  // 2. Get most recent domain scan for this customer (via email)
  const scanRows = await db.execute(sql`
    SELECT
      domain,
      cve_summary,
      blacklist_score,
      ssl_days_remaining,
      ssl_is_valid,
      mail_reputation_score,
      shodan_open_ports,
      ct_subdomain_count
    FROM domain_scans
    WHERE email = ${customerEmail}
      AND created_at > NOW() - INTERVAL '90 days'
    ORDER BY created_at DESC
    LIMIT 20
  `);

  type ScanRow = {
    domain: string;
    cve_summary: Array<{ cvssScore?: number }> | null;
    blacklist_score: number | null;
    ssl_days_remaining: number | null;
    ssl_is_valid: boolean | null;
    mail_reputation_score: number | null;
    shodan_open_ports: Array<{ port: number }> | null;
    ct_subdomain_count: number | null;
  };
  const scans = scanRows.rows as ScanRow[];

  const primaryDomain = scans[0]?.domain ?? null;

  // Aggregate CVE stats across all recent scans
  let criticalCveCount = 0;
  let highCveCount = 0;
  let blacklistedCount = 0;
  let sslExpiringCount = 0;
  let sslInvalidCount = 0;
  let mailIssuesCount = 0;
  let highRiskPortsCount = 0;
  let subdomainsDiscovered = 0;

  for (const scan of scans) {
    // CVE counts
    const cves = scan.cve_summary ?? [];
    criticalCveCount += cves.filter(c => (c.cvssScore ?? 0) >= 9.0).length;
    highCveCount     += cves.filter(c => (c.cvssScore ?? 0) >= 7.0 && (c.cvssScore ?? 0) < 9.0).length;

    // Blacklist
    if (scan.blacklist_score !== null && scan.blacklist_score < 100) blacklistedCount++;

    // SSL
    if (scan.ssl_is_valid === false) sslInvalidCount++;
    else if (scan.ssl_days_remaining !== null && scan.ssl_days_remaining <= 30) sslExpiringCount++;

    // Mail
    if (scan.mail_reputation_score !== null && scan.mail_reputation_score < 50) mailIssuesCount++;

    // High risk ports
    const ports = scan.shodan_open_ports ?? [];
    highRiskPortsCount += ports.filter(p => HIGH_RISK_PORTS.has(p.port)).length;

    // Subdomains
    subdomainsDiscovered += scan.ct_subdomain_count ?? 0;
  }

  // 3. Brand monitor stats
  const bmRows = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE is_active = true)     AS variants_active,
      COUNT(*) FILTER (WHERE is_suspicious = true) AS suspicious_count
    FROM brand_monitors
    WHERE customer_id = ${customerId}
  `);
  const bm = bmRows.rows[0] as {
    variants_active: string;
    suspicious_count: string;
  } | undefined;

  const brandVariantsActive  = parseInt(bm?.variants_active  ?? "0", 10);
  const brandSuspiciousCount = parseInt(bm?.suspicious_count ?? "0", 10);

  // 4. Previous month risk score from executive_reports
  const prevRows = await db.execute(sql`
    SELECT risk_score_current
    FROM executive_reports
    WHERE customer_id = ${customerId}
    ORDER BY report_month DESC
    LIMIT 1
  `);
  const prevScore = (prevRows.rows[0] as { risk_score_current: number | null } | undefined)?.risk_score_current ?? null;

  // 5. Calculate current risk score
  const scanSummary: CustomerScanSummary = {
    criticalCveCount,
    highCveCount,
    blacklistedDomainCount: blacklistedCount,
    sslInvalidCount,
    sslExpiringSoonCount: Math.min(sslInvalidCount, 0) + (scans.filter(s => s.ssl_days_remaining !== null && s.ssl_days_remaining <= 7).length),
    mailIssueCount: mailIssuesCount,
    brandSuspiciousCount,
    highRiskPortCount: highRiskPortsCount,
  };

  const riskScoreCurrent = await calculateCustomerRiskScore(customerId, scanSummary);
  const riskScoreChange = prevScore !== null ? riskScoreCurrent - prevScore : null;

  return {
    customerId,
    customerEmail,
    companyName,
    primaryDomain,
    criticalCveCount,
    highCveCount,
    totalDomainsMonitored: scans.length,
    subdomainsDiscovered,
    blacklistedCount,
    sslExpiringCount,
    sslInvalidCount,
    mailIssuesCount,
    brandVariantsActive,
    brandSuspiciousCount,
    highRiskPortsCount,
    riskScoreCurrent,
    riskScorePrevious: prevScore,
    riskScoreChange,
  };
}
