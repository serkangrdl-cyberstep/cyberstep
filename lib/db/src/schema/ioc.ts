import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── IOC Entries ──────────────────────────────────────────────────────────────

export const iocEntriesTable = pgTable("ioc_entries", {
  id: serial("id").primaryKey(),
  value: varchar("value", { length: 500 }).notNull(),
  iocType: varchar("ioc_type", { length: 20 }).notNull(),
  sources: text("sources").array().default([]),
  confidenceScore: integer("confidence_score").default(0),
  confidenceLevel: varchar("confidence_level", { length: 20 }),
  firstSeenAt: timestamp("first_seen_at").defaultNow(),
  lastSeenAt: timestamp("last_seen_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true),
  malwareFamily: varchar("malware_family", { length: 100 }),
  threatType: varchar("threat_type", { length: 100 }),
  tags: text("tags").array(),
});

// ─── Customer IP Whitelist ────────────────────────────────────────────────────

export const customerIpWhitelistTable = pgTable("customer_ip_whitelist", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  ipCidr: varchar("ip_cidr", { length: 50 }).notNull(),
  label: varchar("label", { length: 150 }),
  reason: varchar("reason", { length: 50 }),
  addedBy: varchar("added_by", { length: 100 }),
  isActive: boolean("is_active").default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── IOC Action Log ───────────────────────────────────────────────────────────

export const iocActionLogTable = pgTable("ioc_action_log", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id"),
  iocValue: varchar("ioc_value", { length: 500 }).notNull(),
  iocType: varchar("ioc_type", { length: 20 }),
  iocId: integer("ioc_id"),
  action: varchar("action", { length: 30 }).notNull(),
  confidenceScore: integer("confidence_score"),
  sources: text("sources").array(),
  skipReason: varchar("skip_reason", { length: 100 }),
  performedBy: varchar("performed_by", { length: 50 }).default("auto"),
  fortinetResponse: jsonb("fortinet_response"),
  revertedAt: timestamp("reverted_at"),
  revertReason: varchar("revert_reason", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── System Settings (kill switch + tuning) ───────────────────────────────────

export const systemSettingsTable = pgTable("system_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value").notNull(),
  description: varchar("description", { length: 255 }),
  updatedBy: varchar("updated_by", { length: 100 }),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Schemas + Types ──────────────────────────────────────────────────────────

export const insertIocEntrySchema = createInsertSchema(iocEntriesTable).omit({ id: true, firstSeenAt: true, lastSeenAt: true });
export const insertCustomerIpWhitelistSchema = createInsertSchema(customerIpWhitelistTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertIocActionLogSchema = createInsertSchema(iocActionLogTable).omit({ id: true, createdAt: true });

export type IocEntry = typeof iocEntriesTable.$inferSelect;
export type CustomerIpWhitelist = typeof customerIpWhitelistTable.$inferSelect;
export type IocActionLog = typeof iocActionLogTable.$inferSelect;
export type SystemSetting = typeof systemSettingsTable.$inferSelect;

export type InsertIocEntry = z.infer<typeof insertIocEntrySchema>;
export type InsertCustomerIpWhitelist = z.infer<typeof insertCustomerIpWhitelistSchema>;
