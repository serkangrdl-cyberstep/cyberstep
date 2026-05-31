import { pgTable, serial, integer, text, varchar, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";

export const cloudConnectionsTable = pgTable("cloud_connections", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  provider: varchar("provider", { length: 20 }).notNull(),
  accountId: varchar("account_id", { length: 100 }),
  accountName: varchar("account_name", { length: 255 }),
  accessType: varchar("access_type", { length: 30 }).default("read_only"),
  credentialsEncrypted: text("credentials_encrypted"),
  regions: jsonb("regions").$type<string[]>().default([]),
  lastScannedAt: timestamp("last_scanned_at"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cloudFindingsTable = pgTable("cloud_findings", {
  id: serial("id").primaryKey(),
  connectionId: integer("connection_id").notNull().references(() => cloudConnectionsTable.id),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  provider: varchar("provider", { length: 20 }),
  region: varchar("region", { length: 50 }),
  resourceType: varchar("resource_type", { length: 50 }),
  resourceId: varchar("resource_id", { length: 500 }),
  resourceName: varchar("resource_name", { length: 255 }),
  findingType: varchar("finding_type", { length: 100 }),
  severity: varchar("severity", { length: 20 }),
  title: varchar("title", { length: 500 }),
  description: text("description"),
  remediationSteps: text("remediation_steps"),
  isFixed: boolean("is_fixed").default(false),
  firstSeenAt: timestamp("first_seen_at").defaultNow(),
  lastSeenAt: timestamp("last_seen_at").defaultNow(),
});

export type CloudConnection = typeof cloudConnectionsTable.$inferSelect;
export type InsertCloudConnection = typeof cloudConnectionsTable.$inferInsert;
export type CloudFinding = typeof cloudFindingsTable.$inferSelect;
