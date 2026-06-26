import fs from "fs";
import path from "path";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { collectCustomerReportData } from "./reportDataCollector";
import { generateExecutivePdf } from "./executivePdfGenerator";

function getReportMonth(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function getPeriodBounds(month: string): { start: Date; end: Date } {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(y!, m! - 1, 1);
  const end   = new Date(y!, m!, 0); // last day of month
  return { start, end };
}

export async function generateMonthlyReports(
  targetCustomerId?: number,
): Promise<{ generated: number; errors: number }> {
  const reportMonth = getReportMonth();
  const { start, end } = getPeriodBounds(reportMonth);

  // Fetch customers
  let query = `
    SELECT id, email, company_name
    FROM customers
    WHERE subscription_status IN ('active', 'trial')
  `;
  if (targetCustomerId != null) query += ` AND id = ${targetCustomerId}`;

  const custRows = await db.execute(sql.raw(query));
  type CustRow = { id: number; email: string; company_name: string | null };
  const customers = custRows.rows as CustRow[];

  let generated = 0;
  let errors    = 0;

  for (const cust of customers) {
    try {
      // Skip if already generated this month
      const exists = await db.execute(sql`
        SELECT id FROM executive_reports
        WHERE customer_id = ${cust.id}
          AND report_month = ${reportMonth}
        LIMIT 1
      `);
      if ((exists.rows as unknown[]).length > 0) {
        logger.info({ customerId: cust.id, reportMonth }, "Executive report already exists, skipping");
        continue;
      }

      // Collect data
      const data = await collectCustomerReportData(cust.id, start, end);

      // Upsert report record
      const inserted = await db.execute(sql`
        INSERT INTO executive_reports (
          customer_id, report_period_start, report_period_end, report_month,
          risk_score_current, risk_score_previous, risk_score_change,
          critical_cve_count, high_cve_count, cve_resolved_count,
          total_domains_monitored, new_domains_detected, subdomains_discovered,
          blacklisted_count, ssl_expiring_count, mail_issues_count,
          brand_variants_active, brand_suspicious_count,
          high_risk_ports_count, generated_at
        ) VALUES (
          ${cust.id},
          ${start.toISOString().slice(0, 10)},
          ${end.toISOString().slice(0, 10)},
          ${reportMonth},
          ${data.riskScoreCurrent},
          ${data.riskScorePrevious},
          ${data.riskScoreChange},
          ${data.criticalCveCount},
          ${data.highCveCount},
          0,
          ${data.totalDomainsMonitored},
          0,
          ${data.subdomainsDiscovered},
          ${data.blacklistedCount},
          ${data.sslExpiringCount},
          ${data.mailIssuesCount},
          ${data.brandVariantsActive},
          ${data.brandSuspiciousCount},
          ${data.highRiskPortsCount},
          NOW()
        )
        ON CONFLICT (customer_id, report_month)
        DO UPDATE SET
          risk_score_current   = EXCLUDED.risk_score_current,
          risk_score_change    = EXCLUDED.risk_score_change,
          critical_cve_count   = EXCLUDED.critical_cve_count,
          high_cve_count       = EXCLUDED.high_cve_count,
          blacklisted_count    = EXCLUDED.blacklisted_count,
          ssl_expiring_count   = EXCLUDED.ssl_expiring_count,
          mail_issues_count    = EXCLUDED.mail_issues_count,
          brand_suspicious_count = EXCLUDED.brand_suspicious_count,
          high_risk_ports_count  = EXCLUDED.high_risk_ports_count,
          generated_at         = NOW()
        RETURNING id
      `);
      const reportId = (inserted.rows[0] as { id: number } | undefined)?.id;

      // Generate PDF
      const pdfBuf = await generateExecutivePdf(data, reportMonth);

      // Save PDF to disk
      const pdfDir = path.join(process.cwd(), "public", "reports", "executive", String(cust.id));
      fs.mkdirSync(pdfDir, { recursive: true });
      const pdfFile = path.join(pdfDir, `${reportMonth}.pdf`);
      fs.writeFileSync(pdfFile, pdfBuf);
      const pdfPath = `/reports/executive/${cust.id}/${reportMonth}.pdf`;

      // Update pdf_path
      if (reportId != null) {
        await db.execute(sql`
          UPDATE executive_reports
          SET pdf_path = ${pdfPath}
          WHERE id = ${reportId}
        `);
      }

      logger.info({ customerId: cust.id, reportMonth, pdfPath }, "Executive report generated");
      generated++;
    } catch (err) {
      logger.error({ err, customerId: cust.id, reportMonth }, "Executive report generation failed");
      errors++;
    }
  }

  return { generated, errors };
}
