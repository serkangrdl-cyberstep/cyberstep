import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customersTable } from "./customers";
import { leadCandidatesTable } from "./lead-discovery";

export const customerTechStackTable = pgTable("customer_tech_stack", {
  id: serial("id").primaryKey(),
  domain: varchar("domain", { length: 255 }).notNull(),
  customerId: integer("customer_id").references(() => customersTable.id),
  leadCandidateId: integer("lead_candidate_id").references(() => leadCandidatesTable.id),
  category: varchar("category", { length: 50 }).notNull(),
  vendor: varchar("vendor", { length: 100 }),
  product: varchar("product", { length: 150 }),
  version: varchar("version", { length: 50 }),
  confidence: integer("confidence").default(50),
  detectedVia: varchar("detected_via", { length: 50 }),
  evidence: jsonb("evidence"),
  securityRisk: varchar("security_risk", { length: 20 }),
  securityNote: text("security_note"),
  salesSignal: varchar("sales_signal", { length: 30 }),
  firstSeenAt: timestamp("first_seen_at").defaultNow(),
  lastVerifiedAt: timestamp("last_verified_at").defaultNow(),
  isActive: boolean("is_active").default(true),
}, (t) => [
  unique().on(t.domain, t.category, t.vendor, t.product),
  index("idx_tech_stack_domain").on(t.domain),
  index("idx_tech_stack_category").on(t.category, t.vendor),
]);

export const customerSecurityMaturityTable = pgTable("customer_security_maturity", {
  id: serial("id").primaryKey(),
  domain: varchar("domain", { length: 255 }).unique().notNull(),
  customerId: integer("customer_id").references(() => customersTable.id),
  leadCandidateId: integer("lead_candidate_id").references(() => leadCandidatesTable.id),
  maturityScore: integer("maturity_score"),
  maturityLevel: varchar("maturity_level", { length: 20 }),
  scoreEmailSecurity: integer("score_email_security"),
  scoreWebSecurity: integer("score_web_security"),
  scoreInfrastructure: integer("score_infrastructure"),
  scoreVisibility: integer("score_visibility"),
  recommendedService: varchar("recommended_service", { length: 100 }),
  recommendationReason: text("recommendation_reason"),
  companySegment: varchar("company_segment", { length: 30 }),
  segmentSignals: text("segment_signals").array(),
  calculatedAt: timestamp("calculated_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCustomerTechStackSchema = createInsertSchema(customerTechStackTable).omit({ id: true, firstSeenAt: true });
export const insertCustomerSecurityMaturitySchema = createInsertSchema(customerSecurityMaturityTable).omit({ id: true, calculatedAt: true });

export type CustomerTechStack = typeof customerTechStackTable.$inferSelect;
export type CustomerSecurityMaturity = typeof customerSecurityMaturityTable.$inferSelect;
export type InsertCustomerTechStack = z.infer<typeof insertCustomerTechStackSchema>;
export type InsertCustomerSecurityMaturity = z.infer<typeof insertCustomerSecurityMaturitySchema>;

export interface TechStackItem {
  category: string;
  vendor: string;
  product: string;
  version?: string;
  confidence: number;
  detectedVia: string;
  evidence?: Record<string, unknown>;
  securityRisk?: "critical" | "high" | "medium" | "low" | "none";
  securityNote?: string;
  salesSignal?: string;
}

export interface MaturityResult {
  maturityScore: number;
  maturityLevel: "low" | "medium" | "high" | "enterprise";
  scoreEmail: number;
  scoreWeb: number;
  scoreInfra: number;
  scoreVisibility: number;
  companySegment: string;
  segmentSignals: string[];
  recommendedService: string;
  recommendationReason: string;
}
