import { pgTable, serial, varchar, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const cyberRiskReportsTable = pgTable("cyber_risk_reports", {
  id: serial("id").primaryKey(),
  periodType: varchar("period_type", { length: 20 }).notNull(),
  periodLabel: varchar("period_label", { length: 20 }).notNull(),
  sector: varchar("sector", { length: 100 }),
  status: varchar("status", { length: 30 }).notNull().default("draft"),
  reportData: jsonb("report_data"),
  pdfUrl: text("pdf_url"),
  webSlug: varchar("web_slug", { length: 100 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  publishedAt: timestamp("published_at"),
  reviewedBy: varchar("reviewed_by", { length: 100 }),
  reviewNotes: text("review_notes"),
});

export const reportMetricsSnapshotTable = pgTable("report_metrics_snapshot", {
  id: serial("id").primaryKey(),
  periodType: varchar("period_type", { length: 20 }).notNull(),
  periodLabel: varchar("period_label", { length: 20 }).notNull(),
  sector: varchar("sector", { length: 100 }),
  metrics: jsonb("metrics").notNull(),
  deltaVsPrevious: jsonb("delta_vs_previous"),
  collectedAt: timestamp("collected_at").notNull().defaultNow(),
});

export type CyberRiskReport = typeof cyberRiskReportsTable.$inferSelect;
export type ReportMetricsSnapshot = typeof reportMetricsSnapshotTable.$inferSelect;
