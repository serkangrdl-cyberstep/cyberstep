import { pgTable, serial, integer, varchar, timestamp, boolean, text, jsonb } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";

export const cisoAssistantSubscriptionsTable = pgTable("ciso_assistant_subscriptions", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customersTable.id),
  isActive: boolean("is_active").default(true),
  sector: varchar("sector", { length: 100 }),
  employeeCount: integer("employee_count"),
  hasDedicatedCiso: boolean("has_dedicated_ciso").default(false),
  cisoName: varchar("ciso_name", { length: 255 }),
  cisoEmail: varchar("ciso_email", { length: 255 }),
  boardReportEmail: varchar("board_report_email", { length: 255 }),
  hasIncidentResponsePlan: boolean("has_incident_response_plan").default(false),
  hasSecurityPolicy: boolean("has_security_policy").default(false),
  hasDataInventory: boolean("has_data_inventory").default(false),
  kvkkVerbisRegistered: boolean("kvkk_verbis_registered").default(false),
  policiesGeneratedAt: timestamp("policies_generated_at"),
  policiesCount: integer("policies_count").default(0),
  startedAt: timestamp("started_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const complianceScoresTable = pgTable("compliance_scores", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customersTable.id),
  scoreMonth: varchar("score_month", { length: 7 }).notNull(),
  score7545: integer("score_7545").default(0),
  scoreKvkk: integer("score_kvkk").default(0),
  checklist7545: jsonb("checklist_7545"),
  checklistKvkk: jsonb("checklist_kvkk"),
  calculatedAt: timestamp("calculated_at").defaultNow(),
});

export const securityPoliciesTable = pgTable("security_policies", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customersTable.id),
  policyType: varchar("policy_type", { length: 100 }).notNull(),
  title: varchar("title", { length: 255 }),
  content: text("content"),
  version: integer("version").default(1),
  status: varchar("status", { length: 20 }).default("draft"),
  approvedAt: timestamp("approved_at"),
  generatedAt: timestamp("generated_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const vcisoEarlyAccessTable = pgTable("vciso_early_access", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  company: varchar("company", { length: 255 }),
  title: varchar("title", { length: 255 }),
  employeeCount: varchar("employee_count", { length: 50 }),
  currentCiso: boolean("current_ciso").default(false),
  source: varchar("source", { length: 50 }).default("website"),
  notes: text("notes"),
  notifiedAt: timestamp("notified_at"),
  subscribedAt: timestamp("subscribed_at").defaultNow(),
});

export type CisoAssistantSubscription = typeof cisoAssistantSubscriptionsTable.$inferSelect;
export type ComplianceScore = typeof complianceScoresTable.$inferSelect;
export type SecurityPolicy = typeof securityPoliciesTable.$inferSelect;
export type VcisoEarlyAccess = typeof vcisoEarlyAccessTable.$inferSelect;
