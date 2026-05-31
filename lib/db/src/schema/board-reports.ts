import { pgTable, serial, integer, varchar, timestamp, boolean, text, decimal, jsonb } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";

export const boardReportsTable = pgTable("board_reports", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id, { onDelete: "cascade" }),
  reportMonth: integer("report_month").notNull(),
  reportYear: integer("report_year").notNull(),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  approvedAt: timestamp("approved_at"),
  sentToEmails: text("sent_to_emails").array().default([]),
  currentScore: integer("current_score"),
  previousScore: integer("previous_score"),
  scoreChange: integer("score_change"),
  riskLevel: varchar("risk_level", { length: 20 }),
  criticalFindings: integer("critical_findings").default(0),
  highFindings: integer("high_findings").default(0),
  findingsResolved: integer("findings_resolved").default(0),
  findingsNew: integer("findings_new").default(0),
  estimatedRiskTl: integer("estimated_risk_tl"),
  estimatedRiskChangePct: decimal("estimated_risk_change_pct", { precision: 5, scale: 2 }),
  executiveSummary: text("executive_summary"),
  keyAchievements: text("key_achievements").array().default([]),
  keyRisks: jsonb("key_risks"),
  requiredDecisions: text("required_decisions").array().default([]),
  nextMonthPlan: text("next_month_plan"),
  reportJson: jsonb("report_json"),
  autoSendDay: integer("auto_send_day").default(5),
  generationStartedAt: timestamp("generation_started_at"),
});

export const boardReportRecipientsTable = pgTable("board_report_recipients", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 100 }),
  role: varchar("role", { length: 50 }),
  isActive: boolean("is_active").notNull().default(true),
  addedAt: timestamp("added_at").notNull().defaultNow(),
});

export type BoardReport = typeof boardReportsTable.$inferSelect;
export type BoardReportRecipient = typeof boardReportRecipientsTable.$inferSelect;
