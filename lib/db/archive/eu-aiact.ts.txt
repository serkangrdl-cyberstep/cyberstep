import { pgTable, serial, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const euAiactAssessmentsTable = pgTable("eu_aiact_assessments", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id"),

  companyName: text("company_name").notNull(),
  contactEmail: text("contact_email"),
  sector: text("sector"),
  employeeCount: text("employee_count"),

  hasEuCustomers: boolean("has_eu_customers"),
  usesAiInProducts: boolean("uses_ai_in_products"),
  aiUseCases: text("ai_use_cases").array(),

  answersJson: jsonb("answers_json"),

  rawScore: integer("raw_score"),
  maxScore: integer("max_score"),
  percentage: integer("percentage"),
  riskCategory: text("risk_category"),

  applicableArticles: text("applicable_articles").array(),
  prohibitedPracticesCheck: boolean("prohibited_practices_check"),
  highRiskSystemDetected: boolean("high_risk_system_detected"),

  reportJson: jsonb("report_json"),

  paymentStatus: text("payment_status").default("unpaid"),
  priceTl: integer("price_tl").default(1990),

  status: text("status").default("in_progress"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertEuAiactAssessmentSchema = createInsertSchema(euAiactAssessmentsTable).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type EuAiactAssessment = typeof euAiactAssessmentsTable.$inferSelect;
export type InsertEuAiactAssessment = z.infer<typeof insertEuAiactAssessmentSchema>;
