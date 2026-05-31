import { pgTable, serial, integer, text, boolean, date, timestamp } from "drizzle-orm/pg-core";

export const aiPolicyDocumentsTable = pgTable("ai_policy_documents", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  version: integer("version").default(1),
  versionLabel: text("version_label"),
  policyText: text("policy_text").notNull(),
  policyHtml: text("policy_html"),
  pdfPath: text("pdf_path"),
  docxPath: text("docx_path"),
  coveredToolIds: integer("covered_tool_ids").array(),
  generatedAt: timestamp("generated_at").defaultNow(),
  generationReason: text("generation_reason"),
  triggeredByToolIds: integer("triggered_by_tool_ids").array(),
  status: text("status").default("draft"),
  approvedAt: timestamp("approved_at"),
  approvedByEmail: text("approved_by_email"),
  changesSummary: text("changes_summary"),
  changedSections: text("changed_sections").array(),
  subscriptionActive: boolean("subscription_active").default(true),
  nextUpdateDate: date("next_update_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type AiPolicyDocument = typeof aiPolicyDocumentsTable.$inferSelect;

export const aiPolicySubscriptionsTable = pgTable("ai_policy_subscriptions", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().unique(),
  status: text("status").default("active"),
  plan: text("plan").default("annual"),
  priceTl: integer("price_tl").default(990),
  billingCycle: text("billing_cycle").default("annual"),
  startedAt: timestamp("started_at").defaultNow(),
  nextBillingDate: date("next_billing_date"),
  autoGenerate: boolean("auto_generate").default(true),
  requireApproval: boolean("require_approval").default(true),
  approvalEmail: text("approval_email"),
  notifyOnUpdate: boolean("notify_on_update").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type AiPolicySubscription = typeof aiPolicySubscriptionsTable.$inferSelect;
