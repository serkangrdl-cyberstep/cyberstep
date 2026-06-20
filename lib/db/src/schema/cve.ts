import {
  pgTable, serial, varchar, text, integer, boolean,
  timestamp, jsonb, unique, index, numeric, date,
} from "drizzle-orm/pg-core";
import { customersTable } from "./customers";
import { leadCandidatesTable } from "./lead-discovery";

export const cveTrackerTable = pgTable("cve_tracker", {
  id: serial("id").primaryKey(),
  cveId: varchar("cve_id", { length: 30 }).unique().notNull(),
  cvssScore: numeric("cvss_score", { precision: 3, scale: 1 }),
  cvssVector: varchar("cvss_vector", { length: 100 }),
  severity: varchar("severity", { length: 20 }),
  title: varchar("title", { length: 500 }),
  description: text("description"),
  affectedProducts: jsonb("affected_products"),
  nvdPublishedAt: timestamp("nvd_published_at"),
  detectedAt: timestamp("detected_at").defaultNow(),
  patchAvailable: boolean("patch_available").default(false),
  patchUrl: varchar("patch_url", { length: 500 }),
  patchBecameAvailableAt: timestamp("patch_became_available_at"),
  exploitPublic: boolean("exploit_public").default(false),
  cisaKev: boolean("cisa_kev").default(false),

  trScanStartedAt: timestamp("tr_scan_started_at"),
  trScanCompletedAt: timestamp("tr_scan_completed_at"),
  trAffectedDomains: integer("tr_affected_domains").default(0),
  trCriticalDomains: integer("tr_critical_domains").default(0),
  trSectorsAffected: jsonb("tr_sectors_affected"),
  trTopCities: jsonb("tr_top_cities"),

  trAnalysis: text("tr_analysis"),
  linkedinPost: text("linkedin_post"),
  xThread: jsonb("x_thread"),
  emailSubject: varchar("email_subject", { length: 255 }),
  emailHtml: text("email_html"),
  pressNote: text("press_note"),

  status: varchar("status", { length: 20 }).default("detected"),
  skipReason: varchar("skip_reason", { length: 100 }),
  publishedAtLinkedin: timestamp("published_at_linkedin"),
  publishedAtX: timestamp("published_at_x"),
  notificationsSent: integer("notifications_sent").default(0),
  isEmerging: boolean("is_emerging").default(false),
  severityLabel: text("severity_label"),
  alertSentAt: timestamp("alert_sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("idx_cve_tracker_status").on(t.status),
  index("idx_cve_tracker_detected").on(t.detectedAt),
]);

export const emergingThreatAlertsTable = pgTable("emerging_threat_alerts", {
  id: serial("id").primaryKey(),
  cveId: varchar("cve_id", { length: 30 }).references(() => cveTrackerTable.cveId),
  customerId: integer("customer_id").references(() => customersTable.id),
  technologyMatched: varchar("technology_matched", { length: 150 }),
  sentAt: timestamp("sent_at"),
  emailStatus: varchar("email_status", { length: 20 }).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("idx_eta_status").on(t.emailStatus),
  index("idx_eta_cve").on(t.cveId),
]);

export const cveDomainMatchesTable = pgTable("cve_domain_matches", {
  id: serial("id").primaryKey(),
  cveId: varchar("cve_id", { length: 30 }).references(() => cveTrackerTable.cveId),
  domain: varchar("domain", { length: 255 }),
  customerId: integer("customer_id").references(() => customersTable.id),
  leadCandidateId: integer("lead_candidate_id").references(() => leadCandidatesTable.id),
  matchedProduct: varchar("matched_product", { length: 150 }),
  matchedVersion: varchar("matched_version", { length: 50 }),
  confidence: integer("confidence"),
  matchNote: text("match_note"),
  isPatched: boolean("is_patched").default(false),
  patchedAt: timestamp("patched_at"),
  notificationSent: boolean("notification_sent").default(false),
  notificationSentAt: timestamp("notification_sent_at"),
  notificationType: varchar("notification_type", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  unique("cve_domain_uq").on(t.cveId, t.domain),
  index("idx_cve_domain_cve_id").on(t.cveId),
  index("idx_cve_domain_notified").on(t.notificationSent),
]);

export const cveIntelligenceTable = pgTable("cve_intelligence", {
  id: serial("id").primaryKey(),
  cveId: varchar("cve_id", { length: 30 }).unique().notNull(),
  epssScore: numeric("epss_score", { precision: 5, scale: 4 }),
  epssPercentile: numeric("epss_percentile", { precision: 5, scale: 4 }),
  epssUpdatedAt: timestamp("epss_updated_at"),
  isKev: boolean("is_kev").notNull().default(false),
  kevDateAdded: date("kev_date_added"),
  kevDueDate: date("kev_due_date"),
  kevRansomwareUse: boolean("kev_ransomware_use").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("idx_cve_intelligence_kev").on(t.isKev),
]);

export type CveTracker = typeof cveTrackerTable.$inferSelect;
export type CveDomainMatch = typeof cveDomainMatchesTable.$inferSelect;
export type CveIntelligence = typeof cveIntelligenceTable.$inferSelect;
