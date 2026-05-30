import { pgTable, text, serial, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";

export const aiToolsRegistryTable = pgTable("ai_tools_registry", {
  id: serial("id").primaryKey(),
  toolName: text("tool_name").notNull(),
  provider: text("provider"),
  category: text("category"),
  tier: text("tier"),
  riskLevel: text("risk_level"),
  dataRetentionDays: integer("data_retention_days"),
  trainsOnUserData: boolean("trains_on_user_data"),
  trainsOptoutAvailable: boolean("trains_optout_available"),
  kvkkCompatible: boolean("kvkk_compatible"),
  dpaAvailable: boolean("dpa_available"),
  riskSummary: text("risk_summary"),
  recommendation: text("recommendation"),
  officialPrivacyUrl: text("official_privacy_url"),
  lastReviewed: text("last_reviewed"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

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
});

export const aiAssessmentAnswersTable = pgTable("ai_assessment_answers", {
  id: serial("id").primaryKey(),
  aiAssessmentId: integer("ai_assessment_id").notNull(),
  questionNumber: integer("question_number").notNull(),
  answer: text("answer").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AiToolsRegistry = typeof aiToolsRegistryTable.$inferSelect;
export type AiAssessment = typeof aiAssessmentsTable.$inferSelect;
export type AiAssessmentAnswer = typeof aiAssessmentAnswersTable.$inferSelect;
