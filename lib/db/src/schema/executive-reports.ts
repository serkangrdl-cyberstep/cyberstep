import {
  pgTable, serial, integer, varchar, timestamp,
  date, index, unique,
} from "drizzle-orm/pg-core";
import { customersTable } from "./customers";

export const executiveReportsTable = pgTable("executive_reports", {
  id:                 serial("id").primaryKey(),
  customerId:         integer("customer_id").references(() => customersTable.id),

  reportPeriodStart:  date("report_period_start").notNull(),
  reportPeriodEnd:    date("report_period_end").notNull(),
  reportMonth:        varchar("report_month", { length: 7 }).notNull(), // '2026-06'

  // Risk skoru trendi
  riskScoreCurrent:   integer("risk_score_current"),
  riskScorePrevious:  integer("risk_score_previous"),
  riskScoreChange:    integer("risk_score_change"), // pozitif = kötüleşme

  // CVE özeti
  criticalCveCount:   integer("critical_cve_count").default(0),
  highCveCount:       integer("high_cve_count").default(0),
  cveResolvedCount:   integer("cve_resolved_count").default(0),

  // Attack surface
  totalDomainsMonitored: integer("total_domains_monitored").default(0),
  newDomainsDetected:    integer("new_domains_detected").default(0),
  subdomainsDiscovered:  integer("subdomains_discovered").default(0),

  // Reputation
  blacklistedCount:  integer("blacklisted_count").default(0),
  sslExpiringCount:  integer("ssl_expiring_count").default(0),
  mailIssuesCount:   integer("mail_issues_count").default(0),

  // Brand
  brandVariantsActive:  integer("brand_variants_active").default(0),
  brandSuspiciousCount: integer("brand_suspicious_count").default(0),

  // Port exposure
  highRiskPortsCount: integer("high_risk_ports_count").default(0),

  // Rapor meta
  generatedAt: timestamp("generated_at").defaultNow(),
  pdfPath:     varchar("pdf_path", { length: 500 }),
  sentAt:      timestamp("sent_at"),
}, (t) => [
  unique("executive_reports_customer_month_uq").on(t.customerId, t.reportMonth),
  index("idx_executive_reports_customer").on(t.customerId),
]);

export type ExecutiveReport = typeof executiveReportsTable.$inferSelect;
export type NewExecutiveReport = typeof executiveReportsTable.$inferInsert;
