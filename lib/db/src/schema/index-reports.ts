import { pgTable, serial, varchar, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const indexReportsTable = pgTable("index_reports", {
  id: serial("id").primaryKey(),
  reportMonth: varchar("report_month", { length: 7 }).unique().notNull(),

  periodStart: varchar("period_start", { length: 10 }).notNull(),
  periodEnd: varchar("period_end", { length: 10 }).notNull(),

  totalDomainsScanned: integer("total_domains_scanned").default(0),
  qualifyingDomains: integer("qualifying_domains").default(0),
  avgSecurityScore: text("avg_security_score"),
  scoreDistribution: jsonb("score_distribution").$type<Record<string, number>>(),

  dmarcMissingPct: text("dmarc_missing_pct"),
  dmarcNonePct: text("dmarc_none_pct"),
  dmarcQuarantinePct: text("dmarc_quarantine_pct"),
  dmarcRejectPct: text("dmarc_reject_pct"),
  spfMissingPct: text("spf_missing_pct"),
  dkimMissingPct: text("dkim_missing_pct"),

  sslValidPct: text("ssl_valid_pct"),
  sslExpiring30dPct: text("ssl_expiring_30d_pct"),
  sslExpiredPct: text("ssl_expired_pct"),

  mysqlExposedPct: text("mysql_exposed_pct"),
  ftpExposedPct: text("ftp_exposed_pct"),
  rdpExposedPct: text("rdp_exposed_pct"),
  anyHighRiskPortPct: text("any_high_risk_port_pct"),

  domainsWithCvePct: text("domains_with_cve_pct"),
  domainsWithCriticalCvePct: text("domains_with_critical_cve_pct"),

  wordpressUsagePct: text("wordpress_usage_pct"),
  cdnUsagePct: text("cdn_usage_pct"),

  sectorStats: jsonb("sector_stats").$type<Array<{ sector: string; count: number; avgScore: number; pct: number }>>(),
  cityStats: jsonb("city_stats").$type<Array<{ city: string; count: number; avgScore: number }>>(),
  hostingStats: jsonb("hosting_stats").$type<Array<{ provider: string; count: number; pct: number }>>(),

  blacklistedPct: text("blacklisted_pct"),

  executiveSummary: text("executive_summary"),
  keyFindings: jsonb("key_findings").$type<Array<{ finding: string; data: string; severity: string; cyberstep_note: string }>>(),
  recommendations: jsonb("recommendations"),
  trendAnalysis: text("trend_analysis"),
  globalContext: text("global_context"),

  status: text("status").default("draft"),
  publishedAt: timestamp("published_at"),
  publishedBy: text("published_by"),

  generatedAt: timestamp("generated_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type IndexReport = typeof indexReportsTable.$inferSelect;
