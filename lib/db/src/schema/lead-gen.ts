import { pgTable, serial, integer, text, boolean, date, timestamp, decimal, jsonb, varchar } from "drizzle-orm/pg-core";

// ─── Lead Scan Queue ─────────────────────────────────────────────────────────
export const leadScanQueueTable = pgTable("lead_scan_queue", {
  id: serial("id").primaryKey(),
  domain: varchar("domain", { length: 255 }).notNull(),
  companyName: varchar("company_name", { length: 255 }),
  source: varchar("source", { length: 50 }),
  scanStatus: varchar("scan_status", { length: 20 }).default("pending"),
  domainScanData: jsonb("domain_scan_data"),
  riskScore: integer("risk_score"),
  riskLevel: varchar("risk_level", { length: 20 }),
  criticalCount: integer("critical_count").default(0),
  highCount: integer("high_count").default(0),
  leadScore: integer("lead_score"),
  leadScoreFactors: jsonb("lead_score_factors"),
  aiScoreStatus: varchar("ai_score_status", { length: 20 }),
  contacts: jsonb("contacts"),
  importedAt: timestamp("imported_at"),
  importedToCustomerId: integer("imported_to_customer_id"),
  skippedReason: varchar("skipped_reason", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  scannedAt: timestamp("scanned_at"),
});
export type LeadScanQueue = typeof leadScanQueueTable.$inferSelect;

// ─── Contact Enrichment Log ──────────────────────────────────────────────────
export const contactEnrichmentLogTable = pgTable("contact_enrichment_log", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id"),
  domain: varchar("domain", { length: 255 }),
  apolloSearchedAt: timestamp("apollo_searched_at"),
  apolloContactsFound: integer("apollo_contacts_found").default(0),
  apolloData: jsonb("apollo_data"),
  hunterSearchedAt: timestamp("hunter_searched_at"),
  hunterEmailsFound: integer("hunter_emails_found").default(0),
  hunterData: jsonb("hunter_data"),
  linkedinSearchedAt: timestamp("linkedin_searched_at"),
  linkedinNotes: text("linkedin_notes"),
  selectedContactName: varchar("selected_contact_name", { length: 255 }),
  selectedContactTitle: varchar("selected_contact_title", { length: 100 }),
  selectedContactEmail: varchar("selected_contact_email", { length: 255 }),
  selectedContactPhone: varchar("selected_contact_phone", { length: 50 }),
  selectedContactLinkedin: varchar("selected_contact_linkedin", { length: 500 }),
  selectionConfidence: varchar("selection_confidence", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type ContactEnrichmentLog = typeof contactEnrichmentLogTable.$inferSelect;

// ─── Sales Team ──────────────────────────────────────────────────────────────
export const salesTeamTable = pgTable("sales_team", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  title: varchar("title", { length: 100 }),
  phone: varchar("phone", { length: 50 }),
  isActive: boolean("is_active").default(true),
  monthlyTargetTl: decimal("monthly_target_tl", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type SalesTeamMember = typeof salesTeamTable.$inferSelect;

// ─── Lead Campaigns ──────────────────────────────────────────────────────────
export const leadCampaignsTable = pgTable("lead_campaigns", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  targetSectors: text("target_sectors").array(),
  targetEmployeeMin: integer("target_employee_min"),
  targetEmployeeMax: integer("target_employee_max"),
  targetCities: text("target_cities").array(),
  sources: text("sources").array(),
  status: varchar("status", { length: 20 }).default("active"),
  domainsFound: integer("domains_found").default(0),
  domainsScanned: integer("domains_scanned").default(0),
  leadsImported: integer("leads_imported").default(0),
  dealsCreated: integer("deals_created").default(0),
  dealsWon: integer("deals_won").default(0),
  createdBy: varchar("created_by", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});
export type LeadCampaign = typeof leadCampaignsTable.$inferSelect;
