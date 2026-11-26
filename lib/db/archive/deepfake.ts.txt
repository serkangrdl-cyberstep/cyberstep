import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const deepfakeAssessmentsTable = pgTable("deepfake_assessments", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id"),

  companyName: text("company_name").notNull(),
  domain: text("domain").notNull(),
  contactEmail: text("contact_email"),
  sector: text("sector"),

  executivesAnalyzed: jsonb("executives_analyzed"),

  overallVoiceCloneRisk: text("overall_voice_clone_risk"),
  overallDeepfakeRisk: text("overall_deepfake_risk"),
  overallRiskScore: integer("overall_risk_score"),

  reportJson: jsonb("report_json"),

  paymentStatus: text("payment_status").default("unpaid"),
  priceTl: integer("price_tl").default(1490),

  status: text("status").default("collecting"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertDeepfakeAssessmentSchema = createInsertSchema(deepfakeAssessmentsTable).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type DeepfakeAssessment = typeof deepfakeAssessmentsTable.$inferSelect;
export type InsertDeepfakeAssessment = z.infer<typeof insertDeepfakeAssessmentSchema>;
