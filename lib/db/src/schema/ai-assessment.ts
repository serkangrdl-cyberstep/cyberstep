import { pgTable, text, serial, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";


export const aiAssessmentsTable = pgTable("ai_assessments", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  sector: text("sector").notNull(),
  employeeCount: text("employee_count").notNull(),
  status: text("status").notNull().default("in_progress"),
  declaredToolIds: jsonb("declared_tool_ids"),
  rawScore: integer("raw_score"),
  maxScore: integer("max_score"),
  percentage: integer("percentage"),
  riskLevel: text("risk_level"),
  area1Score: integer("area1_score"),
  area2Score: integer("area2_score"),
  area3Score: integer("area3_score"),
  area4Score: integer("area4_score"),
  reportJson: jsonb("report_json"),
  policyDocument: text("policy_document"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  reportGeneratedAt: timestamp("report_generated_at"),
  reportGenerationStartedAt: timestamp("report_generation_started_at"),
});


export type AiAssessment = typeof aiAssessmentsTable.$inferSelect;
