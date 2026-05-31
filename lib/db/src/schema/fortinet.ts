import { pgTable, serial, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Per-customer Fortinet Security Fabric integration ────────────────────────

export const fortinetIntegrationsTable = pgTable("fortinet_integrations", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  name: text("name").notNull().default("Fortinet Security Fabric"),

  // Ingestion tokens (unique per customer)
  webhookToken: text("webhook_token").notNull().unique(),
  syslogToken: text("syslog_token").notNull().unique(),

  // Setup wizard progress: 1..5, 5 = complete
  setupStep: integer("setup_step").notNull().default(1),
  status: text("status").$type<"pending" | "connected" | "error" | "disabled">().notNull().default("pending"),
  demoMode: boolean("demo_mode").notNull().default(false),

  // FortiManager auto-block (optional, customer consent required)
  autoBlockEnabled: boolean("auto_block_enabled").notNull().default(false),
  fmUrl: text("fm_url"),
  fmUsername: text("fm_username"),
  fmPasswordEnc: text("fm_password_enc"), // AES-256-GCM ciphertext
  fmAdom: text("fm_adom").default("root"),
  fmBlockGroup: text("fm_block_group").default("CyberStep-BlockList"),
  fmStatus: text("fm_status").$type<"unconfigured" | "ok" | "error">().notNull().default("unconfigured"),
  fmLastError: text("fm_last_error"),
  fmLastCheckAt: timestamp("fm_last_check_at"),

  // Notifications
  alertEmail: text("alert_email"),

  // Discovered fabric devices (from FortiGate Security Fabric)
  fabricDevices: jsonb("fabric_devices").$type<Array<{ name: string; type: string; serial?: string; ip?: string; version?: string }>>().notNull().default([]),

  // Stats
  eventsReceived: integer("events_received").notNull().default(0),
  correlationsCount: integer("correlations_count").notNull().default(0),
  blocksCount: integer("blocks_count").notNull().default(0),
  lastEventAt: timestamp("last_event_at"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Normalized incoming events ───────────────────────────────────────────────

export const fabricEventsTable = pgTable("fabric_events", {
  id: serial("id").primaryKey(),
  integrationId: integer("integration_id").notNull(),
  customerId: integer("customer_id").notNull(),

  source: text("source").$type<"webhook" | "syslog" | "demo">().notNull(),
  rawFormat: text("raw_format").$type<"fortilog" | "cef" | "json" | "unknown">().notNull().default("unknown"),

  // Normalized fields
  eventType: text("event_type").notNull().default("unknown"), // ips, virus, webfilter, app-ctrl, traffic, auth ...
  severity: text("severity").$type<"critical" | "high" | "medium" | "low" | "info">().notNull().default("info"),
  action: text("action"), // blocked, allowed, detected ...
  srcIp: text("src_ip"),
  dstIp: text("dst_ip"),
  dstPort: integer("dst_port"),
  attackName: text("attack_name"),
  message: text("message"),
  deviceName: text("device_name"),
  deviceTime: timestamp("device_time"),
  raw: jsonb("raw").$type<Record<string, unknown>>().notNull().default({}),

  processed: boolean("processed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── AI correlations ──────────────────────────────────────────────────────────

export const fabricCorrelationsTable = pgTable("fabric_correlations", {
  id: serial("id").primaryKey(),
  integrationId: integer("integration_id").notNull(),
  customerId: integer("customer_id").notNull(),

  title: text("title").notNull(),
  narrative: text("narrative").notNull(), // Turkish "patron dili" attack story
  severity: text("severity").$type<"critical" | "high" | "medium" | "low">().notNull().default("medium"),
  confidence: integer("confidence").notNull().default(50), // 0-100
  killChainStage: text("kill_chain_stage"),
  mitreTactics: jsonb("mitre_tactics").$type<Array<{ id: string; name: string }>>().notNull().default([]),
  recommendedAction: text("recommended_action"),
  suspectIps: jsonb("suspect_ips").$type<string[]>().notNull().default([]),
  eventIds: jsonb("event_ids").$type<number[]>().notNull().default([]),

  autoBlocked: boolean("auto_blocked").notNull().default(false),
  alertSent: boolean("alert_sent").notNull().default(false),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── FortiManager block actions ───────────────────────────────────────────────

export const fortimanagerBlockActionsTable = pgTable("fortimanager_block_actions", {
  id: serial("id").primaryKey(),
  integrationId: integer("integration_id").notNull(),
  customerId: integer("customer_id").notNull(),
  correlationId: integer("correlation_id"),

  ip: text("ip").notNull(),
  reason: text("reason"),
  status: text("status").$type<"pending" | "success" | "error" | "verified" | "removed">().notNull().default("pending"),
  message: text("message"),
  verifiedAt: timestamp("verified_at"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Insert schemas + types ───────────────────────────────────────────────────

export const insertFortinetIntegrationSchema = createInsertSchema(fortinetIntegrationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type FortinetIntegration = typeof fortinetIntegrationsTable.$inferSelect;
export type InsertFortinetIntegration = z.infer<typeof insertFortinetIntegrationSchema>;

export type FabricEvent = typeof fabricEventsTable.$inferSelect;
export type FabricCorrelation = typeof fabricCorrelationsTable.$inferSelect;
export type FortimanagerBlockAction = typeof fortimanagerBlockActionsTable.$inferSelect;
