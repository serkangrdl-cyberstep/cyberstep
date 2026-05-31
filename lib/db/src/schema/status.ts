import { pgTable, serial, varchar, text, timestamp, decimal, boolean } from "drizzle-orm/pg-core";

export const statusIncidentsTable = pgTable("status_incidents", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  severity: varchar("severity", { length: 20 }).default("minor"),
  affectedServices: text("affected_services").array(),
  status: varchar("status", { length: 20 }).default("investigating"),
  startedAt: timestamp("started_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
  createdBy: varchar("created_by", { length: 100 }),
});

export const statusServiceHealthTable = pgTable("status_service_health", {
  id: serial("id").primaryKey(),
  serviceName: varchar("service_name", { length: 100 }).unique().notNull(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  currentStatus: varchar("current_status", { length: 20 }).default("operational"),
  uptime30d: decimal("uptime_30d", { precision: 5, scale: 2 }).default("99.99"),
  lastCheckedAt: timestamp("last_checked_at").defaultNow(),
});

export type StatusIncident = typeof statusIncidentsTable.$inferSelect;
export type StatusServiceHealth = typeof statusServiceHealthTable.$inferSelect;
