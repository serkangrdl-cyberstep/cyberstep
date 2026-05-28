import { pgTable, serial, text, timestamp, boolean, integer, numeric, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Vendors (Fortinet, Cisco, Palo Alto...) ─────────────────────────────────
export const isrVendorsTable = pgTable("isr_vendors", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  name: text("name").notNull(),
  displayName: text("display_name").notNull(),
  logoUrl: text("logo_url"),
  salesRepName: text("sales_rep_name"),
  salesRepEmail: text("sales_rep_email"),
  dealRegUrl: text("deal_reg_url"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Distributors (per vendor) ───────────────────────────────────────────────
export const isrDistributorsTable = pgTable("isr_distributors", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  vendorId: integer("vendor_id").notNull().references(() => isrVendorsTable.id),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  contactEmail: text("contact_email").notNull(),
  phone: text("phone"),
  notes: text("notes"),
  additionalContacts: jsonb("additional_contacts").notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Deals (main opportunity record) ────────────────────────────────────────
export const isrDealsTable = pgTable("isr_deals", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  // Customer info (from incoming email)
  customerName: text("customer_name"),
  customerEmail: text("customer_email").notNull(),
  customerCompany: text("customer_company"),
  customerPhone: text("customer_phone"),
  // Deal info
  vendorId: integer("vendor_id").references(() => isrVendorsTable.id),
  vendorName: text("vendor_name"),
  productKeywords: text("product_keywords"),
  originalSubject: text("original_subject"),
  originalBody: text("original_body"),
  aiSummary: text("ai_summary"),
  status: text("status").notNull().default("new"),
  // new | rfq_sent | quoted | approved | sent | won | lost | cancelled
  assignedRepEmail: text("assigned_rep_email"),
  priority: text("priority").notNull().default("normal"), // low | normal | high | urgent
  notes: text("notes"),
  emailMessageId: text("email_message_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── RFQs (requests for quote sent to distributors/vendor) ──────────────────
export const isrRfqsTable = pgTable("isr_rfqs", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull().references(() => isrDealsTable.id),
  distributorId: integer("distributor_id").references(() => isrDistributorsTable.id),
  sentToEmail: text("sent_to_email").notNull(),
  sentToName: text("sent_to_name"),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull().default("sent"), // sent | responded | expired
  emailMessageId: text("email_message_id"),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
  respondedAt: timestamp("responded_at"),
});

// ─── RFQ Responses (incoming quote from distributor) ─────────────────────────
export const isrRfqResponsesTable = pgTable("isr_rfq_responses", {
  id: serial("id").primaryKey(),
  rfqId: integer("rfq_id").notNull().references(() => isrRfqsTable.id),
  dealId: integer("deal_id").notNull().references(() => isrDealsTable.id),
  fromEmail: text("from_email").notNull(),
  subject: text("subject"),
  body: text("body"),
  aiParsed: jsonb("ai_parsed"),
  currency: text("currency").notNull().default("TRY"),
  validUntil: text("valid_until"),
  notes: text("notes"),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
});

// ─── Quote Lines (SKU / qty / price) ─────────────────────────────────────────
export const isrQuoteLinesTable = pgTable("isr_quote_lines", {
  id: serial("id").primaryKey(),
  rfqResponseId: integer("rfq_response_id").references(() => isrRfqResponsesTable.id),
  quoteId: integer("quote_id"),
  sku: text("sku"),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitCost: numeric("unit_cost", { precision: 18, scale: 4 }),
  unitPrice: numeric("unit_price", { precision: 18, scale: 4 }),
  discount: numeric("discount", { precision: 5, scale: 2 }).default("0"),
  lineTotal: numeric("line_total", { precision: 18, scale: 4 }),
  currency: text("currency").notNull().default("TRY"),
  isCustom: boolean("is_custom").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ─── Quotes (customer-facing prepared quote) ──────────────────────────────────
export const isrQuotesTable = pgTable("isr_quotes", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull().references(() => isrDealsTable.id),
  quoteNumber: text("quote_number").notNull(),
  currency: text("currency").notNull().default("TRY"),
  subtotal: numeric("subtotal", { precision: 18, scale: 4 }),
  kdvRate: numeric("kdv_rate", { precision: 5, scale: 2 }).default("20"),
  kdvAmount: numeric("kdv_amount", { precision: 18, scale: 4 }),
  total: numeric("total", { precision: 18, scale: 4 }),
  validDays: integer("valid_days").notNull().default(30),
  notes: text("notes"),
  terms: text("terms"),
  status: text("status").notNull().default("draft"), // draft | pending_approval | approved | sent | expired | rejected
  approvedByEmail: text("approved_by_email"),
  approvedAt: timestamp("approved_at"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Margin Rules ─────────────────────────────────────────────────────────────
export const isrMarginRulesTable = pgTable("isr_margin_rules", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  vendorId: integer("vendor_id").references(() => isrVendorsTable.id),
  name: text("name").notNull(),
  minMarginPct: numeric("min_margin_pct", { precision: 5, scale: 2 }).notNull().default("15"),
  targetMarginPct: numeric("target_margin_pct", { precision: 5, scale: 2 }).notNull().default("25"),
  maxDiscountPct: numeric("max_discount_pct", { precision: 5, scale: 2 }).notNull().default("10"),
  autoApproveBelow: numeric("auto_approve_below", { precision: 18, scale: 4 }),
  requireApprovalAbove: numeric("require_approval_above", { precision: 18, scale: 4 }),
  isDefault: boolean("is_default").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Email Inbox Log ──────────────────────────────────────────────────────────
export const isrEmailInboxTable = pgTable("isr_email_inbox", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  messageId: text("message_id").notNull().unique(),
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name"),
  toEmail: text("to_email"),
  subject: text("subject"),
  bodyText: text("body_text"),
  bodyHtml: text("body_html"),
  processedAs: text("processed_as"), // new_deal | rfq_response | ignored
  dealId: integer("deal_id").references(() => isrDealsTable.id),
  rfqId: integer("rfq_id").references(() => isrRfqsTable.id),
  receivedAt: timestamp("received_at").notNull(),
  processedAt: timestamp("processed_at").notNull().defaultNow(),
});

// ─── Insert schemas ───────────────────────────────────────────────────────────
export const insertIsrVendorSchema = createInsertSchema(isrVendorsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertIsrDistributorSchema = createInsertSchema(isrDistributorsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertIsrDealSchema = createInsertSchema(isrDealsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertIsrMarginRuleSchema = createInsertSchema(isrMarginRulesTable).omit({ id: true, createdAt: true, updatedAt: true });

export type IsrVendor = typeof isrVendorsTable.$inferSelect;
export type IsrDistributor = typeof isrDistributorsTable.$inferSelect;
export type IsrDeal = typeof isrDealsTable.$inferSelect;
export type IsrRfq = typeof isrRfqsTable.$inferSelect;
export type IsrRfqResponse = typeof isrRfqResponsesTable.$inferSelect;
export type IsrQuoteLine = typeof isrQuoteLinesTable.$inferSelect;
export type IsrQuote = typeof isrQuotesTable.$inferSelect;
export type IsrMarginRule = typeof isrMarginRulesTable.$inferSelect;
export type IsrEmailInbox = typeof isrEmailInboxTable.$inferSelect;
export type InsertIsrVendor = z.infer<typeof insertIsrVendorSchema>;
export type InsertIsrDistributor = z.infer<typeof insertIsrDistributorSchema>;
export type InsertIsrDeal = z.infer<typeof insertIsrDealSchema>;
export type InsertIsrMarginRule = z.infer<typeof insertIsrMarginRuleSchema>;
