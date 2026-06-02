import {
  pgTable, serial, integer, varchar, text, boolean,
  timestamp, jsonb, index,
} from "drizzle-orm/pg-core";

export const discoveryRunsTable = pgTable("discovery_runs", {
  id: serial("id").primaryKey(),
  source: varchar("source", { length: 50 }).notNull(),
  runParams: jsonb("run_params"),
  status: varchar("status", { length: 20 }).notNull().default("running"),
  totalFound: integer("total_found").notNull().default(0),
  totalAdded: integer("total_added").notNull().default(0),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
}, (t) => [
  index("idx_discovery_runs_source").on(t.source),
]);

export const leadCandidatesTable = pgTable("lead_candidates", {
  id: serial("id").primaryKey(),
  domain: varchar("domain", { length: 255 }).unique().notNull(),
  companyName: varchar("company_name", { length: 255 }),
  sector: varchar("sector", { length: 100 }),
  city: varchar("city", { length: 100 }),
  source: varchar("source", { length: 50 }).notNull(),
  sourceData: jsonb("source_data"),
  hasFortigate: boolean("has_fortigate").notNull().default(false),
  scanStatus: varchar("scan_status", { length: 30 }).notNull().default("pending"),
  scanId: integer("scan_id"),
  riskScore: integer("risk_score"),
  criticalFindings: integer("critical_findings").notNull().default(0),
  findingHighlights: text("finding_highlights").array(),
  isQualified: boolean("is_qualified").notNull().default(false),
  contactName: varchar("contact_name", { length: 255 }),
  contactTitle: varchar("contact_title", { length: 255 }),
  contactEmail: varchar("contact_email", { length: 255 }),
  contactEmailConfidence: integer("contact_email_confidence"),
  contactSource: varchar("contact_source", { length: 50 }),
  teaserSubject: varchar("teaser_subject", { length: 500 }),
  teaserBody: text("teaser_body"),
  teaserGeneratedAt: timestamp("teaser_generated_at"),
  teaserSentAt: timestamp("teaser_sent_at"),
  isrLeadId: integer("isr_lead_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("idx_lead_candidates_status").on(t.scanStatus),
  index("idx_lead_candidates_qualified").on(t.isQualified),
]);

export const subdomainScoringRulesTable = pgTable("subdomain_scoring_rules", {
  id: serial("id").primaryKey(),
  pattern: varchar("pattern", { length: 100 }).unique().notNull(),
  corporateScore: integer("corporate_score").notNull(),
  subdomainType: varchar("subdomain_type", { length: 50 }),
  description: varchar("description", { length: 255 }),
  isActive: boolean("is_active").notNull().default(true),
});

export type DiscoveryRun = typeof discoveryRunsTable.$inferSelect;
export type LeadCandidate = typeof leadCandidatesTable.$inferSelect;
export type SubdomainScoringRule = typeof subdomainScoringRulesTable.$inferSelect;
