import { pgTable, serial, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const annualReportsTable = pgTable("annual_reports", {
  id: serial("id").primaryKey(),
  domain: text("domain").notNull(),
  companyName: text("company_name"),
  year: integer("year").notNull(),
  yearEndScore: integer("year_end_score").notNull(),
  yearEndGrade: text("year_end_grade"),
  prevYearScore: integer("prev_year_score"),
  scoreDelta: integer("score_delta"),
  totalScans: integer("total_scans").notNull().default(0),
  closedFindings: integer("closed_findings").notNull().default(0),
  surfaceReduction: integer("surface_reduction").notNull().default(0),
  avgCriticalCloseDays: integer("avg_critical_close_days"),
  monthlyScores: jsonb("monthly_scores").$type<number[]>(),
  topAchievement: text("top_achievement"),
  sectorPercentile: integer("sector_percentile"),
  svgContent: text("svg_content"),
  pdfUrl: text("pdf_url"),
  emailSentAt: timestamp("email_sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AnnualReport = typeof annualReportsTable.$inferSelect;
export type InsertAnnualReport = typeof annualReportsTable.$inferInsert;
