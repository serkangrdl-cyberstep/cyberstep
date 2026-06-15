import { pgTable, serial, integer, varchar, jsonb, timestamp } from "drizzle-orm/pg-core";

export const internalScansTable = pgTable("internal_scans", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id"),
  scanType: varchar("scan_type", { length: 50 }),
  scanVersion: varchar("scan_version", { length: 20 }),
  hostname: varchar("hostname", { length: 200 }),
  internalScore: integer("internal_score"),
  scoreBreakdown: jsonb("score_breakdown").$type<Record<string, number>>(),
  rawData: jsonb("raw_data"),
  findingsCount: integer("findings_count"),
  scannedAt: timestamp("scanned_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type InternalScan = typeof internalScansTable.$inferSelect;
export type InsertInternalScan = typeof internalScansTable.$inferInsert;
