import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar, decimal, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { isrCustomersTable } from "./isr";

export const marketConfigsTable = pgTable("market_configs", {
  id: serial("id").primaryKey(),
  countryCode: varchar("country_code", { length: 5 }).unique().notNull(),
  countryNameLocal: varchar("country_name_local", { length: 100 }),
  languageCode: varchar("language_code", { length: 10 }),
  tlds: text("tlds").array(),
  currencyCode: varchar("currency_code", { length: 5 }),
  currencySymbol: varchar("currency_symbol", { length: 5 }),
  primaryRegulation: varchar("primary_regulation", { length: 100 }),
  regulationYear: integer("regulation_year"),
  regulationNote: text("regulation_note"),
  sectorLabels: jsonb("sector_labels").$type<Record<string, string>>(),
  linkedinPageId: varchar("linkedin_page_id", { length: 100 }),
  minDomainsForReport: integer("min_domains_for_report").default(100),
  isActive: boolean("is_active").default(true),
  launchedAt: date("launched_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const intelligenceReportsTable = pgTable("intelligence_reports", {
  id: serial("id").primaryKey(),
  countryCode: varchar("country_code", { length: 5 }).references(() => marketConfigsTable.countryCode),
  reportMonth: integer("report_month").notNull(),
  reportYear: integer("report_year").notNull(),
  reportSlug: varchar("report_slug", { length: 100 }).unique(),
  status: varchar("status", { length: 20 }).default("generating"),
  domainsAnalyzed: integer("domains_analyzed"),
  dateRangeStart: date("date_range_start"),
  dateRangeEnd: date("date_range_end"),
  dataSources: text("data_sources").array(),
  avgRiskScore: decimal("avg_risk_score", { precision: 5, scale: 2 }),
  criticalFindingsCount: integer("critical_findings_count"),
  pctNoDmarc: decimal("pct_no_dmarc", { precision: 5, scale: 2 }),
  pctNoWaf: decimal("pct_no_waf", { precision: 5, scale: 2 }),
  pctOutdatedCms: decimal("pct_outdated_cms", { precision: 5, scale: 2 }),
  pctOpenCriticalPort: decimal("pct_open_critical_port", { precision: 5, scale: 2 }),
  pctDarkWebLeak: decimal("pct_dark_web_leak", { precision: 5, scale: 2 }),
  mostUsedWaf: varchar("most_used_waf", { length: 100 }),
  mostUsedMailProvider: varchar("most_used_mail_provider", { length: 100 }),
  worstSector: varchar("worst_sector", { length: 50 }),
  bestSector: varchar("best_sector", { length: 50 }),
  monthOverMonthChange: decimal("month_over_month_change", { precision: 5, scale: 2 }),
  executiveSummary: text("executive_summary"),
  keyFindings: jsonb("key_findings"),
  sectorAnalysis: jsonb("sector_analysis"),
  recommendations: text("recommendations"),
  regulationContext: text("regulation_context"),
  linkedinPostShort: text("linkedin_post_short"),
  linkedinCarousel: jsonb("linkedin_carousel"),
  pdfUrl: varchar("pdf_url", { length: 500 }),
  blogPostContent: text("blog_post_content"),
  emailSubject: varchar("email_subject", { length: 255 }),
  emailPreview: text("email_preview"),
  emailHtml: text("email_html"),
  pressRelease: text("press_release"),
  publishedAt: timestamp("published_at"),
  linkedinPostedAt: timestamp("linkedin_posted_at"),
  linkedinPostUrl: varchar("linkedin_post_url", { length: 500 }),
  emailSentAt: timestamp("email_sent_at"),
  emailRecipients: integer("email_recipients"),
  totalDownloads: integer("total_downloads").default(0),
  totalLeadsCaptured: integer("total_leads_captured").default(0),
  generatedBy: varchar("generated_by", { length: 50 }).default("auto"),
  reviewedBy: varchar("reviewed_by", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const reportSectorDetailsTable = pgTable("report_sector_details", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id").references(() => intelligenceReportsTable.id, { onDelete: "cascade" }),
  countryCode: varchar("country_code", { length: 5 }),
  sector: varchar("sector", { length: 50 }),
  domainCount: integer("domain_count"),
  avgRiskScore: decimal("avg_risk_score", { precision: 5, scale: 2 }),
  pctNoDmarc: decimal("pct_no_dmarc", { precision: 5, scale: 2 }),
  pctNoWaf: decimal("pct_no_waf", { precision: 5, scale: 2 }),
  pctOutdatedCms: decimal("pct_outdated_cms", { precision: 5, scale: 2 }),
  pctOpenPort: decimal("pct_open_port", { precision: 5, scale: 2 }),
  pctDarkWeb: decimal("pct_dark_web", { precision: 5, scale: 2 }),
  mostCommonWaf: varchar("most_common_waf", { length: 100 }),
  mostCommonMail: varchar("most_common_mail", { length: 100 }),
  mostCommonCms: varchar("most_common_cms", { length: 100 }),
  maturityLevel: varchar("maturity_level", { length: 20 }),
  yoyChange: decimal("yoy_change", { precision: 5, scale: 2 }),
  sectorRank: integer("sector_rank"),
  narrative: text("narrative"),
});

export const reportCityDetailsTable = pgTable("report_city_details", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id").references(() => intelligenceReportsTable.id, { onDelete: "cascade" }),
  countryCode: varchar("country_code", { length: 5 }),
  city: varchar("city", { length: 100 }),
  domainCount: integer("domain_count"),
  avgRiskScore: decimal("avg_risk_score", { precision: 5, scale: 2 }),
  riskRank: integer("risk_rank"),
});

export const reportTechTrendsTable = pgTable("report_tech_trends", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id").references(() => intelligenceReportsTable.id, { onDelete: "cascade" }),
  countryCode: varchar("country_code", { length: 5 }),
  category: varchar("category", { length: 50 }),
  vendor: varchar("vendor", { length: 100 }),
  domainCount: integer("domain_count"),
  marketSharePct: decimal("market_share_pct", { precision: 5, scale: 2 }),
  momChange: decimal("mom_change", { precision: 5, scale: 2 }),
});

export const reportLeadsTable = pgTable("report_leads", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id").references(() => intelligenceReportsTable.id),
  countryCode: varchar("country_code", { length: 5 }),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }),
  company: varchar("company", { length: 255 }),
  title: varchar("title", { length: 255 }),
  downloadedAt: timestamp("downloaded_at").defaultNow(),
  convertedToIsr: boolean("converted_to_isr").default(false),
  isrCustomerId: integer("isr_customer_id").references(() => isrCustomersTable.id),
});

export const insertIntelligenceReportSchema = createInsertSchema(intelligenceReportsTable).omit({ id: true, createdAt: true });
export const insertReportLeadSchema = createInsertSchema(reportLeadsTable).omit({ id: true, downloadedAt: true });
export const insertMarketConfigSchema = createInsertSchema(marketConfigsTable).omit({ id: true, createdAt: true });

export type MarketConfig = typeof marketConfigsTable.$inferSelect;
export type IntelligenceReport = typeof intelligenceReportsTable.$inferSelect;
export type ReportSectorDetail = typeof reportSectorDetailsTable.$inferSelect;
export type ReportLead = typeof reportLeadsTable.$inferSelect;
export type InsertIntelligenceReport = z.infer<typeof insertIntelligenceReportSchema>;
export type InsertReportLead = z.infer<typeof insertReportLeadSchema>;
