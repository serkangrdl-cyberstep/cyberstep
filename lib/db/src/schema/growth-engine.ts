import { pgTable, serial, varchar, text, integer, boolean, timestamp, jsonb, date, decimal } from "drizzle-orm/pg-core";

// ─── Growth Trigger Log ───────────────────────────────────────────────────────
export const growthTriggersTable = pgTable("growth_triggers", {
  id: serial("id").primaryKey(),
  triggerType: varchar("trigger_type", { length: 50 }).notNull(),
  // ssl_expiry | new_cve | sector_breach | kvk_penalty |
  // score_drop | port_change | supplier_chain | ekap_tender |
  // new_company | benchmark_dl | competitor_check

  domain: varchar("domain", { length: 255 }),
  companyName: varchar("company_name", { length: 255 }),
  customerId: integer("customer_id"),

  triggerData: jsonb("trigger_data"),
  // SSL: {expiry_date, days_remaining}
  // CVE: {cve_id, cvss, affected_tech, epss_score}
  // Sector breach: {news_title, news_url, sector}
  // KVK: {decision_number, penalty_tl, sector}
  // Score drop: {old_score, new_score, diff}
  // Port change: {new_ports, port_names}

  emailTo: varchar("email_to", { length: 255 }),
  emailSubject: text("email_subject"),
  emailSentAt: timestamp("email_sent_at"),
  emailOpenedAt: timestamp("email_opened_at"),
  emailClickedAt: timestamp("email_clicked_at"),
  replyReceivedAt: timestamp("reply_received_at"),

  leadCreated: boolean("lead_created").default(false),
  isrDealId: integer("isr_deal_id"),

  suppressUntil: timestamp("suppress_until"),

  status: varchar("status", { length: 20 }).default("pending"),
  // pending | sent | converted | suppressed | failed

  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type GrowthTrigger = typeof growthTriggersTable.$inferSelect;

// ─── Competitor Checks ────────────────────────────────────────────────────────
export const competitorChecksTable = pgTable("competitor_checks", {
  id: serial("id").primaryKey(),
  ownDomain: varchar("own_domain", { length: 255 }).notNull(),
  competitorDomain: varchar("competitor_domain", { length: 255 }).notNull(),
  ownScore: integer("own_score"),
  competitorScore: integer("competitor_score"),
  ownRiskLevel: varchar("own_risk_level", { length: 30 }),
  competitorRiskLevel: varchar("competitor_risk_level", { length: 30 }),
  visitorEmail: varchar("visitor_email", { length: 255 }),
  visitorCompany: varchar("visitor_company", { length: 255 }),
  leadCreated: boolean("lead_created").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type CompetitorCheck = typeof competitorChecksTable.$inferSelect;

// ─── Benchmark Downloads ──────────────────────────────────────────────────────
export const benchmarkDownloadsTable = pgTable("benchmark_downloads", {
  id: serial("id").primaryKey(),
  sector: varchar("sector", { length: 100 }).notNull(),
  reportPeriod: varchar("report_period", { length: 20 }),
  visitorName: varchar("visitor_name", { length: 255 }),
  visitorEmail: varchar("visitor_email", { length: 255 }).notNull(),
  visitorCompany: varchar("visitor_company", { length: 255 }),
  visitorDomain: varchar("visitor_domain", { length: 255 }),
  leadCreated: boolean("lead_created").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type BenchmarkDownload = typeof benchmarkDownloadsTable.$inferSelect;

// ─── Sector Newsletter Subscribers ───────────────────────────────────────────
export const sectorNewsletterSubscribersTable = pgTable("sector_newsletter_subscribers", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  companyName: varchar("company_name", { length: 255 }),
  domain: varchar("domain", { length: 255 }),
  sectors: text("sectors").array(),
  subscribedAt: timestamp("subscribed_at").defaultNow().notNull(),
  lastSentAt: timestamp("last_sent_at"),
  leadCreated: boolean("lead_created").default(false),
  unsubscribedAt: timestamp("unsubscribed_at"),
});
export type SectorNewsletterSubscriber = typeof sectorNewsletterSubscribersTable.$inferSelect;

// ─── EKAP Tenders ─────────────────────────────────────────────────────────────
export const ekapTendersTable = pgTable("ekap_tenders", {
  id: serial("id").primaryKey(),
  tenderNumber: varchar("tender_number", { length: 100 }).unique(),
  contractingAuthority: varchar("contracting_authority", { length: 500 }),
  winnerCompany: varchar("winner_company", { length: 500 }),
  winnerDomain: varchar("winner_domain", { length: 255 }),
  tenderSubject: text("tender_subject"),
  tenderAmountTl: decimal("tender_amount_tl", { precision: 15, scale: 2 }),
  awardDate: date("award_date"),
  categories: text("categories").array(),
  leadCreated: boolean("lead_created").default(false),
  processedAt: timestamp("processed_at").defaultNow().notNull(),
});
export type EkapTender = typeof ekapTendersTable.$inferSelect;

// ─── New Companies Registry (MERSİS) ─────────────────────────────────────────
export const newCompaniesRegistryTable = pgTable("new_companies_registry", {
  id: serial("id").primaryKey(),
  mersisNumber: varchar("mersis_number", { length: 50 }).unique(),
  companyName: varchar("company_name", { length: 500 }).notNull(),
  city: varchar("city", { length: 100 }),
  sector: varchar("sector", { length: 100 }),
  establishmentDate: date("establishment_date"),
  domain: varchar("domain", { length: 255 }),
  leadCreated: boolean("lead_created").default(false),
  discoveredAt: timestamp("discovered_at").defaultNow().notNull(),
});
export type NewCompanyRegistry = typeof newCompaniesRegistryTable.$inferSelect;

// ─── Growth Engine Settings ───────────────────────────────────────────────────
export const growthEngineSettingsTable = pgTable("growth_engine_settings", {
  id: serial("id").primaryKey(),
  triggerType: varchar("trigger_type", { length: 50 }).notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  suppressDays: integer("suppress_days").notNull().default(30),
  maxDailyLimit: integer("max_daily_limit").notNull().default(50),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type GrowthEngineSetting = typeof growthEngineSettingsTable.$inferSelect;
