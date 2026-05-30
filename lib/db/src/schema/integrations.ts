import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const INTEGRATION_TYPES = [
  "jira",
  "forti_manager",
  "qradar",
  "forti_siem",
  "crowdstrike",
  "trend_micro",
] as const;
export type IntegrationType = typeof INTEGRATION_TYPES[number];

export const customerIntegrationsTable = pgTable("customer_integrations", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id"),
  type: text("type").$type<IntegrationType>().notNull(),
  name: text("name").notNull(),
  config: jsonb("config").$type<Record<string, string>>().notNull().default({}),
  active: boolean("active").notNull().default(true),
  lastSyncAt: timestamp("last_sync_at"),
  lastSyncStatus: text("last_sync_status").$type<"success" | "error">(),
  lastSyncError: text("last_sync_error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const integrationEventsTable = pgTable("integration_events", {
  id: serial("id").primaryKey(),
  integrationId: integer("integration_id"),
  eventType: text("event_type").notNull(),
  status: text("status").$type<"success" | "error" | "pending">().notNull(),
  summary: text("summary"),
  itemsPushed: integer("items_pushed").default(0),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertIntegrationSchema = createInsertSchema(customerIntegrationsTable).omit({ id: true, createdAt: true });
export type InsertIntegration = z.infer<typeof insertIntegrationSchema>;
export type CustomerIntegration = typeof customerIntegrationsTable.$inferSelect;
export type IntegrationEvent = typeof integrationEventsTable.$inferSelect;
