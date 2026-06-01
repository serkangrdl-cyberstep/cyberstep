import { pgTable, serial, integer, varchar, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";
import { socCasesTable } from "./soc";

export const observabilityIntegrationsTable = pgTable("observability_integrations", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  provider: varchar("provider", { length: 30 }).notNull(),
  displayName: varchar("display_name", { length: 100 }),
  webhookToken: varchar("webhook_token", { length: 64 }).unique(),
  apiKeyEncrypted: text("api_key_encrypted"),
  apiEndpoint: varchar("api_endpoint", { length: 500 }),
  config: jsonb("config").$type<Record<string, unknown>>().default({}),
  eventTypes: text("event_types").array().default([]),
  isActive: boolean("is_active").default(true),
  lastEventAt: timestamp("last_event_at"),
  eventCount: integer("event_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const observabilityEventsTable = pgTable("observability_events", {
  id: serial("id").primaryKey(),
  integrationId: integer("integration_id").notNull().references(() => observabilityIntegrationsTable.id),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  provider: varchar("provider", { length: 30 }).notNull(),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  severity: varchar("severity", { length: 20 }),
  title: varchar("title", { length: 500 }),
  description: text("description"),
  affectedService: varchar("affected_service", { length: 255 }),
  affectedHost: varchar("affected_host", { length: 255 }),
  sourceIp: varchar("source_ip", { length: 50 }),
  rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>(),
  processed: boolean("processed").default(false),
  correlatedSocCaseId: integer("correlated_soc_case_id").references(() => socCasesTable.id),
  receivedAt: timestamp("received_at").defaultNow(),
});

export type ObservabilityIntegration = typeof observabilityIntegrationsTable.$inferSelect;
export type ObservabilityEvent = typeof observabilityEventsTable.$inferSelect;
