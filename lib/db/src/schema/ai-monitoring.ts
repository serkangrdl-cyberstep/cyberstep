import { pgTable, serial, integer, text, boolean, date, timestamp } from "drizzle-orm/pg-core";

export const aiToolPolicySnapshotsTable = pgTable("ai_tool_policy_snapshots", {
  id: serial("id").primaryKey(),
  toolId: integer("tool_id").notNull(),
  snapshotDate: date("snapshot_date").notNull(),
  dataRetentionDays: integer("data_retention_days"),
  trainsOnUserData: boolean("trains_on_user_data"),
  kvkkCompatible: boolean("kvkk_compatible"),
  dpaAvailable: boolean("dpa_available"),
  riskLevel: text("risk_level"),
  riskSummary: text("risk_summary"),
  recommendation: text("recommendation"),
  isChanged: boolean("is_changed").default(false),
  changeSummary: text("change_summary"),
  changeSeverity: text("change_severity"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type AiToolPolicySnapshot = typeof aiToolPolicySnapshotsTable.$inferSelect;

export const aiMonitoringSubscriptionsTable = pgTable("ai_monitoring_subscriptions", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  monitoredToolIds: integer("monitored_tool_ids").array(),
  aiAssessmentId: integer("ai_assessment_id"),
  status: text("status").default("active"),
  startedAt: timestamp("started_at").defaultNow(),
  nextBillingDate: date("next_billing_date"),
  priceTl: integer("price_tl").default(490),
  notifyEmail: boolean("notify_email").default(true),
  alertOnCritical: boolean("alert_on_critical").default(true),
  alertOnImportant: boolean("alert_on_important").default(true),
  alertOnMinor: boolean("alert_on_minor").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type AiMonitoringSubscription = typeof aiMonitoringSubscriptionsTable.$inferSelect;

export const aiMonitoringAlertsTable = pgTable("ai_monitoring_alerts", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id"),
  customerId: integer("customer_id"),
  toolId: integer("tool_id"),
  snapshotId: integer("snapshot_id"),
  alertType: text("alert_type"),
  severity: text("severity"),
  title: text("title"),
  summary: text("summary"),
  recommendation: text("recommendation"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type AiMonitoringAlert = typeof aiMonitoringAlertsTable.$inferSelect;
