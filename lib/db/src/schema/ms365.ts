import { pgTable, serial, integer, varchar, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";
import { socCasesTable } from "./soc";

export const ms365IntegrationsTable = pgTable("ms365_integrations", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  azureTenantId: varchar("azure_tenant_id", { length: 100 }).notNull(),
  clientId: varchar("client_id", { length: 100 }),
  accessTokenEnc: text("access_token_enc"),
  refreshTokenEnc: text("refresh_token_enc"),
  tokenExpiresAt: timestamp("token_expires_at"),
  scopes: text("scopes").array().default([]),
  status: varchar("status", { length: 20 }).default("active"),
  lastSyncAt: timestamp("last_sync_at"),
  syncError: text("sync_error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const ms365SigninLogsTable = pgTable("ms365_signin_logs", {
  id: serial("id").primaryKey(),
  integrationId: integer("integration_id").notNull().references(() => ms365IntegrationsTable.id),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  userPrincipalName: varchar("user_principal_name", { length: 255 }),
  ipAddress: varchar("ip_address", { length: 50 }),
  location: jsonb("location").$type<{ city?: string; countryOrRegion?: string; state?: string }>(),
  riskLevel: varchar("risk_level", { length: 20 }),
  riskDetail: text("risk_detail"),
  riskState: varchar("risk_state", { length: 30 }),
  eventTime: timestamp("event_time"),
  correlatedSocCaseId: integer("correlated_soc_case_id").references(() => socCasesTable.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const ms365EmailAlertsTable = pgTable("ms365_email_alerts", {
  id: serial("id").primaryKey(),
  integrationId: integer("integration_id").notNull().references(() => ms365IntegrationsTable.id),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  alertId: varchar("alert_id", { length: 200 }),
  title: varchar("title", { length: 500 }),
  severity: varchar("severity", { length: 20 }),
  category: varchar("category", { length: 100 }),
  description: text("description"),
  affectedUser: varchar("affected_user", { length: 255 }),
  rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>(),
  correlatedSocCaseId: integer("correlated_soc_case_id").references(() => socCasesTable.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Ms365Integration = typeof ms365IntegrationsTable.$inferSelect;
export type Ms365SigninLog = typeof ms365SigninLogsTable.$inferSelect;
export type Ms365EmailAlert = typeof ms365EmailAlertsTable.$inferSelect;
