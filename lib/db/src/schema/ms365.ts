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



export type Ms365Integration = typeof ms365IntegrationsTable.$inferSelect;
