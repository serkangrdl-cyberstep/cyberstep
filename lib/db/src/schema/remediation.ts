import { pgTable, serial, integer, text, varchar, timestamp, boolean, numeric } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";

export const remediationTicketsTable = pgTable("remediation_tickets", {
  id: serial("id").primaryKey(),
  ticketNumber: varchar("ticket_number", { length: 30 }).unique().notNull(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  findingId: integer("finding_id"),
  findingTitle: varchar("finding_title", { length: 500 }).notNull(),
  findingSeverity: varchar("finding_severity", { length: 20 }).notNull(),
  findingDescription: text("finding_description"),
  findingType: varchar("finding_type", { length: 100 }),
  affectedAsset: varchar("affected_asset", { length: 255 }),
  cvssScore: numeric("cvss_score", { precision: 3, scale: 1 }),
  epssScore: numeric("epss_score", { precision: 5, scale: 4 }),
  businessImpact: varchar("business_impact", { length: 20 }).default("medium"),
  unifiedRiskScore: numeric("unified_risk_score", { precision: 5, scale: 2 }),
  assignedToName: varchar("assigned_to_name", { length: 255 }),
  assignedToEmail: varchar("assigned_to_email", { length: 255 }),
  assignedAt: timestamp("assigned_at"),
  dueDate: timestamp("due_date"),
  status: varchar("status", { length: 30 }).default("open"),
  resolutionNotes: text("resolution_notes"),
  fixDescription: text("fix_description"),
  verificationScanId: integer("verification_scan_id"),
  verifiedAt: timestamp("verified_at"),
  verifiedBy: varchar("verified_by", { length: 50 }).default("auto"),
  slaDays: integer("sla_days").default(30),
  slaDeadline: timestamp("sla_deadline"),
  slaBreached: boolean("sla_breached").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  closedAt: timestamp("closed_at"),
});

export const remediationCommentsTable = pgTable("remediation_comments", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => remediationTicketsTable.id),
  authorType: varchar("author_type", { length: 20 }),
  authorName: varchar("author_name", { length: 255 }),
  comment: text("comment").notNull(),
  isInternal: boolean("is_internal").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const verificationScanQueueTable = pgTable("verification_scan_queue", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => remediationTicketsTable.id),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  domain: varchar("domain", { length: 255 }),
  findingType: varchar("finding_type", { length: 100 }),
  scheduledAt: timestamp("scheduled_at"),
  executedAt: timestamp("executed_at"),
  scanResult: varchar("scan_result", { length: 30 }),
  status: varchar("status", { length: 20 }).default("pending"),
});

export type RemediationTicket = typeof remediationTicketsTable.$inferSelect;
export type InsertRemediationTicket = typeof remediationTicketsTable.$inferInsert;
export type RemediationComment = typeof remediationCommentsTable.$inferSelect;
export type VerificationScanQueueItem = typeof verificationScanQueueTable.$inferSelect;
