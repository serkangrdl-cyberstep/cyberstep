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


export const insertCustomerTechStackSchema = createInsertSchema(customerTechStackTable).omit({ id: true, firstSeenAt: true });

export type CustomerTechStack = typeof customerTechStackTable.$inferSelect;
export type InsertCustomerTechStack = z.infer<typeof insertCustomerTechStackSchema>;

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
