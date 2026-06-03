import { pgTable, serial, text, varchar, integer, timestamp } from "drizzle-orm/pg-core";

export const platformOutageLogTable = pgTable("platform_outage_log", {
  id: serial("id").primaryKey(),
  monitor: varchar("monitor", { length: 200 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("down"),
  reason: text("reason"),
  startedAt: timestamp("started_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const dataRetentionPolicyTable = pgTable("data_retention_policy", {
  tableName: varchar("table_name", { length: 100 }).primaryKey(),
  retentionDays: integer("retention_days").notNull(),
  action: varchar("action", { length: 20 }).notNull().default("delete"),
  lastCleanedAt: timestamp("last_cleaned_at"),
});

export type PlatformOutageLog = typeof platformOutageLogTable.$inferSelect;
export type DataRetentionPolicy = typeof dataRetentionPolicyTable.$inferSelect;
