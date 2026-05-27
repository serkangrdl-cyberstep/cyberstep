import { pgTable, serial, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { assessmentsTable } from "./assessments";

export const reportsTable = pgTable("reports", {
  id: serial("id").primaryKey(),
  assessmentId: integer("assessment_id").notNull().references(() => assessmentsTable.id),
  totalScore: integer("total_score").notNull(),
  maxScore: integer("max_score").notNull(),
  scorePercent: integer("score_percent").notNull(),
  riskLevel: text("risk_level").notNull(),
  redAlarmCount: integer("red_alarm_count").notNull(),
  redAlarmQuestions: jsonb("red_alarm_questions").$type<number[]>().notNull().default([]),
  aiAnalysis: text("ai_analysis").notNull().default(""),
  recommendations: jsonb("recommendations").$type<string[]>().notNull().default([]),
  domainScores: jsonb("domain_scores").$type<Array<{domain: string; score: number; maxScore: number; percent: number}>>().notNull().default([]),
  reviewToken: text("review_token"),
  verificationToken: text("verification_token"),
  adminNotes: text("admin_notes"),
  reviewStatus: text("review_status").notNull().default("pending_review"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertReportSchema = createInsertSchema(reportsTable).omit({ id: true, createdAt: true });
export type InsertReport = z.infer<typeof insertReportSchema>;
export type Report = typeof reportsTable.$inferSelect;
