import { pgTable, text, serial, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const assessmentTypeEnum = pgEnum("assessment_type", ["mini", "full"]);
export const assessmentStatusEnum = pgEnum("assessment_status", ["in_progress", "completed", "report_ready"]);
export const answerEnum = pgEnum("answer_type", ["evet", "kismen", "bilmiyorum", "hayir"]);

export const assessmentsTable = pgTable("assessments", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  sector: text("sector").notNull(),
  employeeCount: text("employee_count").notNull(),
  assessmentType: assessmentTypeEnum("assessment_type").notNull().default("mini"),
  status: assessmentStatusEnum("status").notNull().default("in_progress"),
  totalScore: integer("total_score"),
  maxScore: integer("max_score"),
  riskLevel: text("risk_level"),
  redAlarmCount: integer("red_alarm_count"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertAssessmentSchema = createInsertSchema(assessmentsTable).omit({ id: true, createdAt: true });
export type InsertAssessment = z.infer<typeof insertAssessmentSchema>;
export type Assessment = typeof assessmentsTable.$inferSelect;
