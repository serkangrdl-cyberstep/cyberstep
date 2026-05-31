import { pgTable, serial, text, integer, boolean, timestamp, jsonb, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── SOC Cases ────────────────────────────────────────────────────────────────

export const socCasesTable = pgTable("soc_cases", {
  id: serial("id").primaryKey(),
  caseNumber: text("case_number").notNull().unique(), // CS-SOC-2026-00892
  customerId: integer("customer_id").notNull(),

  triggerEventIds: jsonb("trigger_event_ids").$type<number[]>().notNull().default([]),

  severity: text("severity").$type<"critical" | "high" | "medium" | "low">().notNull().default("medium"),
  escalationLevel: integer("escalation_level").notNull().default(0), // 0..4
  category: text("category").notNull().default("other"),
  title: text("title").notNull(),
  description: text("description"),
  attackNarrative: text("attack_narrative"), // Turkish "patron dili"
  affectedAssets: jsonb("affected_assets").$type<string[]>().notNull().default([]),
  mitreTechniques: jsonb("mitre_techniques").$type<Array<{ id: string; name: string }>>().notNull().default([]),

  status: text("status").$type<"open" | "investigating" | "resolved" | "closed" | "false_positive">().notNull().default("open"),
  assignedTo: text("assigned_to").notNull().default("auto"), // "auto" | analyst name

  // SLA
  slaTier: text("sla_tier"), // e.g. "critical_15m"
  slaDeadline: timestamp("sla_deadline"),
  slaBreached: boolean("sla_breached").notNull().default(false),
  slaBreachedAt: timestamp("sla_breached_at"),

  // Lifecycle timestamps
  customerNotifiedAt: timestamp("customer_notified_at"),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolvedAt: timestamp("resolved_at"),
  closedAt: timestamp("closed_at"),
  closeReason: text("close_reason"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── SOC Playbooks ────────────────────────────────────────────────────────────

export type PlaybookStep = {
  step: number;
  type: "action" | "notify" | "create_case" | "enrich" | "scan" | "verify";
  action?: string; // for type=action, e.g. block_ip
  params?: Record<string, unknown>;
  channels?: string[]; // for notify
  priority?: string;
  async?: boolean;
  delay_minutes?: number;
  on_true?: string;
};

export const socPlaybooksTable = pgTable("soc_playbooks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  triggerCategories: jsonb("trigger_categories").$type<string[]>().notNull().default([]),
  triggerSeverity: jsonb("trigger_severity").$type<string[]>().notNull().default([]),
  steps: jsonb("steps").$type<PlaybookStep[]>().notNull().default([]),
  autoExecute: boolean("auto_execute").notNull().default(true),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── SOC Activity Log ─────────────────────────────────────────────────────────

export const socActivityLogTable = pgTable("soc_activity_log", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").notNull(),
  actorType: text("actor_type").$type<"system" | "ai" | "analyst" | "customer">().notNull().default("system"),
  actorName: text("actor_name"),
  actionType: text("action_type").notNull(), // created, triaged, escalated, blocked, notified, note, closed ...
  description: text("description"),
  details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── SOC SLA Config ───────────────────────────────────────────────────────────

export const socSlaConfigTable = pgTable("soc_sla_config", {
  id: serial("id").primaryKey(),
  tier: text("tier").$type<"lite" | "standart" | "pro">().notNull(),
  severity: text("severity").$type<"critical" | "high" | "medium" | "low">().notNull(),
  responseMinutes: integer("response_minutes").notNull(),
  resolutionMinutes: integer("resolution_minutes").notNull(),
});

// ─── AI Usage Log (cost tracking) ─────────────────────────────────────────────

export const aiUsageLogTable = pgTable("ai_usage_log", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id"),
  caseId: integer("case_id"),
  model: text("model").notNull(),
  tier: integer("tier").notNull().default(0), // 0 rule, 1 haiku, 2 sonnet, 3 extended
  useCase: text("use_case").notNull().default("triage"),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  costUsd: doublePrecision("cost_usd").notNull().default(0),
  cached: boolean("cached").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── SOC IP Whitelist (per-customer known-good IPs) ───────────────────────────

export const socIpWhitelistTable = pgTable("soc_ip_whitelist", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  ip: text("ip").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Insert schemas + types ───────────────────────────────────────────────────

export const insertSocCaseSchema = createInsertSchema(socCasesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSocPlaybookSchema = createInsertSchema(socPlaybooksTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSocActivitySchema = createInsertSchema(socActivityLogTable).omit({ id: true, createdAt: true });
export const insertAiUsageSchema = createInsertSchema(aiUsageLogTable).omit({ id: true, createdAt: true });
export const insertSocIpWhitelistSchema = createInsertSchema(socIpWhitelistTable).omit({ id: true, createdAt: true });

export type SocCase = typeof socCasesTable.$inferSelect;
export type InsertSocCase = z.infer<typeof insertSocCaseSchema>;
export type SocPlaybook = typeof socPlaybooksTable.$inferSelect;
export type InsertSocPlaybook = z.infer<typeof insertSocPlaybookSchema>;
export type SocActivity = typeof socActivityLogTable.$inferSelect;
export type SocSlaConfig = typeof socSlaConfigTable.$inferSelect;
export type AiUsageLog = typeof aiUsageLogTable.$inferSelect;
export type SocIpWhitelist = typeof socIpWhitelistTable.$inferSelect;
