import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar, decimal, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { isrCustomersTable } from "./isr";


export const intelligenceReportsTable = pgTable("intelligence_reports", {
  id: serial("id").primaryKey(),
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





export const insertIntelligenceReportSchema = createInsertSchema(intelligenceReportsTable).omit({ id: true, createdAt: true });

export type IntelligenceReport = typeof intelligenceReportsTable.$inferSelect;
export type InsertIntelligenceReport = z.infer<typeof insertIntelligenceReportSchema>;
