import {
  pgTable, serial, integer, varchar, text, boolean, timestamp,
  jsonb, decimal, bigserial, index,
} from "drizzle-orm/pg-core";
import { customersTable } from "./customers";
import { socCasesTable } from "./soc";
import { fabricEventsTable } from "./fortinet";

export const nocIntegrationsTable = pgTable("noc_integrations", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customersTable.id).unique(),
  nocTier: varchar("noc_tier", { length: 20 }).default("lite"),
  snmpToken: varchar("snmp_token", { length: 64 }).unique(),
  snmpTrapEnabled: boolean("snmp_trap_enabled").default(false),
  snmpLastReceivedAt: timestamp("snmp_last_received_at"),
  snmpTrapCount: integer("snmp_trap_count").default(0),
  netflowToken: varchar("netflow_token", { length: 64 }).unique(),
  netflowEnabled: boolean("netflow_enabled").default(false),
  netflowLastReceivedAt: timestamp("netflow_last_received_at"),
  fortigateHost: varchar("fortigate_host", { length: 255 }),
  fortigateTokenEncrypted: text("fortigate_token_encrypted"),
  fortigatePollingEnabled: boolean("fortigate_polling_enabled").default(false),
  fortigatePollIntervalMinutes: integer("fortigate_poll_interval_minutes").default(5),
  fortigateLastPolledAt: timestamp("fortigate_last_polled_at"),
  monitoredDevices: jsonb("monitored_devices").default([]),
  monitoredServices: jsonb("monitored_services").default([]),
  bandwidthWarningPct: integer("bandwidth_warning_pct").default(70),
  bandwidthCriticalPct: integer("bandwidth_critical_pct").default(90),
  packetLossWarningPct: decimal("packet_loss_warning_pct", { precision: 5, scale: 2 }).default("2.0"),
  packetLossCriticalPct: decimal("packet_loss_critical_pct", { precision: 5, scale: 2 }).default("10.0"),
  latencyWarningMs: integer("latency_warning_ms").default(100),
  latencyCriticalMs: integer("latency_critical_ms").default(300),
  availabilitySlaPct: decimal("availability_sla_pct", { precision: 5, scale: 2 }).default("99.5"),
  baselineLearning: boolean("baseline_learning").default(true),
  baselineCompletedAt: timestamp("baseline_completed_at"),
  baselineData: jsonb("baseline_data").default({}),
  setupStep: integer("setup_step").default(0),
  setupCompletedAt: timestamp("setup_completed_at"),
  totalEvents: integer("total_events").default(0),
  totalAlerts: integer("total_alerts").default(0),
  uptimeThisMonthPct: decimal("uptime_this_month_pct", { precision: 5, scale: 2 }).default("100.0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const nocCasesTable = pgTable("noc_cases", {
  id: serial("id").primaryKey(),
  caseNumber: varchar("case_number", { length: 30 }).unique().notNull(),
  customerId: integer("customer_id").references(() => customersTable.id),
  caseType: varchar("case_type", { length: 30 }).notNull().default("anomaly"),
  severity: varchar("severity", { length: 20 }).notNull().default("medium"),
  priority: integer("priority").default(3),
  title: varchar("title", { length: 500 }),
  description: text("description"),
  rootCauseAnalysis: text("root_cause_analysis"),
  affectedDevices: text("affected_devices").array(),
  affectedServices: text("affected_services").array(),
  status: varchar("status", { length: 30 }).default("open"),
  relatedSocCaseId: integer("related_soc_case_id").references(() => socCasesTable.id),
  isSecurityRelated: boolean("is_security_related").default(false),
  slaMinutes: integer("sla_minutes"),
  slaDeadline: timestamp("sla_deadline"),
  slaBreached: boolean("sla_breached").default(false),
  responseTimeMinutes: integer("response_time_minutes"),
  resolutionTimeMinutes: integer("resolution_time_minutes"),
  actionsTaken: jsonb("actions_taken").default([]),
  customerNotifiedAt: timestamp("customer_notified_at"),
  resolvedAt: timestamp("resolved_at"),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("idx_noc_cases_customer").on(t.customerId, t.status),
]);

export const nocEventsTable = pgTable("noc_events", {
  id: serial("id").primaryKey(),
  integrationId: integer("integration_id").references(() => nocIntegrationsTable.id),
  customerId: integer("customer_id").references(() => customersTable.id),
  source: varchar("source", { length: 30 }).notNull(),
  deviceIp: varchar("device_ip", { length: 50 }),
  deviceName: varchar("device_name", { length: 255 }),
  deviceType: varchar("device_type", { length: 50 }),
  interfaceName: varchar("interface_name", { length: 100 }),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  severity: varchar("severity", { length: 20 }).notNull().default("medium"),
  metricName: varchar("metric_name", { length: 100 }),
  metricValue: decimal("metric_value", { precision: 12, scale: 4 }),
  metricUnit: varchar("metric_unit", { length: 20 }),
  metricThreshold: decimal("metric_threshold", { precision: 12, scale: 4 }),
  title: varchar("title", { length: 500 }),
  description: text("description"),
  processed: boolean("processed").default(false),
  processedAt: timestamp("processed_at"),
  claudeAnalysis: jsonb("claude_analysis"),
  correlatedSocEventId: integer("correlated_soc_event_id").references(() => fabricEventsTable.id),
  alertSent: boolean("alert_sent").default(false),
  nocCaseId: integer("noc_case_id").references(() => nocCasesTable.id),
  rawData: jsonb("raw_data"),
  occurredAt: timestamp("occurred_at").notNull(),
  receivedAt: timestamp("received_at").defaultNow(),
}, (t) => [
  index("idx_noc_events_unprocessed").on(t.processed, t.receivedAt),
  index("idx_noc_events_customer").on(t.customerId, t.occurredAt),
]);

export const nocMetricsTable = pgTable("noc_metrics", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  integrationId: integer("integration_id").references(() => nocIntegrationsTable.id),
  customerId: integer("customer_id").references(() => customersTable.id),
  deviceIp: varchar("device_ip", { length: 50 }),
  interfaceName: varchar("interface_name", { length: 100 }),
  metricType: varchar("metric_type", { length: 50 }),
  value: decimal("value", { precision: 12, scale: 4 }),
  unit: varchar("unit", { length: 20 }),
  recordedAt: timestamp("recorded_at").notNull(),
}, (t) => [
  index("idx_noc_metrics_lookup").on(t.customerId, t.deviceIp, t.metricType, t.recordedAt),
]);

export const nocAvailabilityTable = pgTable("noc_availability", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  integrationId: integer("integration_id").references(() => nocIntegrationsTable.id),
  customerId: integer("customer_id").references(() => customersTable.id),
  targetType: varchar("target_type", { length: 20 }),
  targetIdentifier: varchar("target_identifier", { length: 255 }),
  isUp: boolean("is_up").notNull(),
  checkLatencyMs: integer("check_latency_ms"),
  checkedAt: timestamp("checked_at").notNull(),
}, (t) => [
  index("idx_noc_avail_lookup").on(t.customerId, t.targetIdentifier, t.checkedAt),
]);

export type NocIntegration = typeof nocIntegrationsTable.$inferSelect;
export type NocCase = typeof nocCasesTable.$inferSelect;
export type NocEvent = typeof nocEventsTable.$inferSelect;
export type NocMetric = typeof nocMetricsTable.$inferSelect;
