import { pgTable, serial, integer, text, boolean, date, timestamp, decimal, jsonb, varchar } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";

// ─── Enterprise Prospects ────────────────────────────────────────────────────
export const enterpriseProspectsTable = pgTable("enterprise_prospects", {
  id: serial("id").primaryKey(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  domain: varchar("domain", { length: 255 }).notNull(),
  sector: varchar("sector", { length: 100 }),
  employeeCount: varchar("employee_count", { length: 50 }),
  city: varchar("city", { length: 100 }),
  contactName: varchar("contact_name", { length: 255 }),
  contactTitle: varchar("contact_title", { length: 100 }),
  contactEmail: varchar("contact_email", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 50 }),
  linkedinUrl: varchar("linkedin_url", { length: 500 }),
  source: varchar("source", { length: 50 }).default("manual"),
  assignedTo: varchar("assigned_to", { length: 100 }),
  status: varchar("status", { length: 30 }).default("new"),
  notes: text("notes"),
  lostReason: varchar("lost_reason", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
});
export type EnterpriseProspect = typeof enterpriseProspectsTable.$inferSelect;

// ─── Teaser Reports ──────────────────────────────────────────────────────────
export const teaserReportsTable = pgTable("teaser_reports", {
  id: serial("id").primaryKey(),
  prospectId: integer("prospect_id").references(() => enterpriseProspectsTable.id),
  domainScanData: jsonb("domain_scan_data"),
  attackScenarios: jsonb("attack_scenarios"),
  overallRiskScore: integer("overall_risk_score"),
  riskLevel: varchar("risk_level", { length: 20 }),
  criticalCount: integer("critical_count").default(0),
  highCount: integer("high_count").default(0),
  mediumCount: integer("medium_count").default(0),
  lowCount: integer("low_count").default(0),
  teaserHeadline: text("teaser_headline"),
  teaserFindings: jsonb("teaser_findings"),
  teaserScenarioPreview: text("teaser_scenario_preview"),
  lockedSectionsHint: text("locked_sections_hint"),
  urgencyNote: text("urgency_note"),
  previewToken: varchar("preview_token", { length: 64 }).unique().notNull(),
  emailSentAt: timestamp("email_sent_at"),
  emailOpenedAt: timestamp("email_opened_at"),
  previewViewedAt: timestamp("preview_viewed_at"),
  ctaClickedAt: timestamp("cta_clicked_at"),
  ctaContactName: varchar("cta_contact_name", { length: 255 }),
  ctaContactEmail: varchar("cta_contact_email", { length: 255 }),
  ctaContactPhone: varchar("cta_contact_phone", { length: 50 }),
  ctaMessage: text("cta_message"),
  followup1SentAt: timestamp("followup_1_sent_at"),
  followup2SentAt: timestamp("followup_2_sent_at"),
  approvedBy: varchar("approved_by", { length: 100 }),
  approvedAt: timestamp("approved_at"),
  status: varchar("status", { length: 20 }).default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type TeaserReport = typeof teaserReportsTable.$inferSelect;

// ─── Enterprise Contracts ────────────────────────────────────────────────────
export const enterpriseContractsTable = pgTable("enterprise_contracts", {
  id: serial("id").primaryKey(),
  prospectId: integer("prospect_id").references(() => enterpriseProspectsTable.id),
  customerId: integer("customer_id").references(() => customersTable.id),
  contractNumber: varchar("contract_number", { length: 30 }).unique().notNull(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  companyTaxId: varchar("company_tax_id", { length: 50 }),
  companyTaxOffice: varchar("company_tax_office", { length: 100 }),
  companyAddress: text("company_address"),
  billingContactName: varchar("billing_contact_name", { length: 255 }),
  billingContactEmail: varchar("billing_contact_email", { length: 255 }),
  contractType: varchar("contract_type", { length: 30 }).default("annual"),
  billingCycle: varchar("billing_cycle", { length: 20 }).default("annual"),
  paymentMethod: varchar("payment_method", { length: 30 }).default("bank_transfer"),
  paymentTerms: integer("payment_terms").default(30),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  totalAmountTl: decimal("total_amount_tl", { precision: 12, scale: 2 }),
  discountPct: integer("discount_pct").default(0),
  discountReason: varchar("discount_reason", { length: 255 }),
  status: varchar("status", { length: 30 }).default("draft"),
  sentAt: timestamp("sent_at"),
  signedAt: timestamp("signed_at"),
  signedBy: varchar("signed_by", { length: 255 }),
  activatedAt: timestamp("activated_at"),
  activatedBy: varchar("activated_by", { length: 100 }),
  contractPdfPath: varchar("contract_pdf_path", { length: 500 }),
  signedPdfPath: varchar("signed_pdf_path", { length: 500 }),
  internalNotes: text("internal_notes"),
  createdBy: varchar("created_by", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type EnterpriseContract = typeof enterpriseContractsTable.$inferSelect;

// ─── Enterprise Contract Services ───────────────────────────────────────────
export const enterpriseContractServicesTable = pgTable("enterprise_contract_services", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").references(() => enterpriseContractsTable.id),
  serviceSlug: varchar("service_slug", { length: 100 }).notNull(),
  serviceName: varchar("service_name", { length: 255 }).notNull(),
  unitPriceTl: decimal("unit_price_tl", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").default(1),
  lineTotalTl: decimal("line_total_tl", { precision: 10, scale: 2 }).notNull(),
  isActive: boolean("is_active").default(false),
  activatedAt: timestamp("activated_at"),
  expiresAt: timestamp("expires_at"),
  usageLimit: integer("usage_limit"),
  usageCount: integer("usage_count").default(0),
  notes: varchar("notes", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type EnterpriseContractService = typeof enterpriseContractServicesTable.$inferSelect;

// ─── Enterprise Invoices ─────────────────────────────────────────────────────
export const enterpriseInvoicesTable = pgTable("enterprise_invoices", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").references(() => enterpriseContractsTable.id),
  customerId: integer("customer_id").references(() => customersTable.id),
  invoiceNumber: varchar("invoice_number", { length: 30 }).unique().notNull(),
  periodStart: date("period_start"),
  periodEnd: date("period_end"),
  subtotalTl: decimal("subtotal_tl", { precision: 12, scale: 2 }),
  vatRate: integer("vat_rate").default(20),
  vatAmountTl: decimal("vat_amount_tl", { precision: 12, scale: 2 }),
  totalTl: decimal("total_tl", { precision: 12, scale: 2 }),
  dueDate: date("due_date"),
  paidAt: timestamp("paid_at"),
  paidAmountTl: decimal("paid_amount_tl", { precision: 12, scale: 2 }),
  status: varchar("status", { length: 20 }).default("pending"),
  pdfPath: varchar("pdf_path", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type EnterpriseInvoice = typeof enterpriseInvoicesTable.$inferSelect;
