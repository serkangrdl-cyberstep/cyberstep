import { pgTable, serial, integer, boolean, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";
import { socCasesTable } from "./soc";

export const kvkkAssessmentsTable = pgTable("kvkk_assessments", {
  id: serial("id").primaryKey(),
  socCaseId: integer("soc_case_id").notNull().references(() => socCasesTable.id),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  requiresNotification: boolean("requires_notification"),
  aiReasoning: text("ai_reasoning"),
  severityCategory: text("severity_category"),
  affectedDataTypes: jsonb("affected_data_types").$type<string[]>().default([]),
  urgency: text("urgency"),
  letterDraft: text("letter_draft"),
  status: text("status").$type<"pending" | "completed" | "failed">().notNull().default("pending"),
  assessedAt: timestamp("assessed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const kvkkNotificationsTable = pgTable("kvkk_notifications", {
  id: serial("id").primaryKey(),
  assessmentId: integer("assessment_id").notNull().references(() => kvkkAssessmentsTable.id),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  socCaseId: integer("soc_case_id").notNull().references(() => socCasesTable.id),
  status: text("status").$type<"draft" | "sent" | "tracking" | "closed">().notNull().default("draft"),
  btkReferenceNo: text("btk_reference_no"),
  sentAt: timestamp("sent_at"),
  deadline72h: timestamp("deadline_72h").notNull(),
  deadlineWarningEmailAt: timestamp("deadline_warning_email_at"),
  letterContent: text("letter_content"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type KvkkAssessment = typeof kvkkAssessmentsTable.$inferSelect;
export type KvkkNotification = typeof kvkkNotificationsTable.$inferSelect;
