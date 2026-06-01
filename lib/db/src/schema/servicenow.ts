import { pgTable, serial, integer, boolean, text, timestamp } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";
import { socCasesTable } from "./soc";

export const servicenowConfigsTable = pgTable("servicenow_configs", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  instanceUrl: text("instance_url").notNull(),
  username: text("username").notNull(),
  apiTokenEnc: text("api_token_enc").notNull(),
  active: boolean("active").notNull().default(true),
  assignmentGroup: text("assignment_group"),
  category: text("category").default("Software"),
  lastSyncAt: timestamp("last_sync_at"),
  lastSyncError: text("last_sync_error"),
  lastWebhookAt: timestamp("last_webhook_at"),
  webhookEventCount: integer("webhook_event_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const servicenowIncidentsTable = pgTable("servicenow_incidents", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  socCaseId: integer("soc_case_id").notNull().references(() => socCasesTable.id),
  configId: integer("config_id").notNull().references(() => servicenowConfigsTable.id),
  snSysId: text("sn_sys_id").notNull(),
  snNumber: text("sn_number").notNull(),
  snState: integer("sn_state").notNull().default(1),
  lastSyncedAt: timestamp("last_synced_at").defaultNow(),
  syncError: text("sync_error"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type ServicenowConfig = typeof servicenowConfigsTable.$inferSelect;
export type ServicenowIncident = typeof servicenowIncidentsTable.$inferSelect;
