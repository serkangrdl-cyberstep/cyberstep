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
  aiScoreRetryCount: integer("ai_score_retry_count").default(0),
  aiScoreLastRetryAt: timestamp("ai_score_last_retry_at"),
  contacts: jsonb("contacts"),
  importedAt: timestamp("imported_at"),
  importedToCustomerId: integer("imported_to_customer_id"),
  skippedReason: varchar("skipped_reason", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  scannedAt: timestamp("scanned_at"),
});
export type LeadScanQueue = typeof leadScanQueueTable.$inferSelect;

// ─── Contact Enrichment Log ──────────────────────────────────────────────────

// ─── Sales Team ──────────────────────────────────────────────────────────────

// ─── Lead Campaigns ──────────────────────────────────────────────────────────
