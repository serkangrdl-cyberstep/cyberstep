import { pgTable, serial, integer, varchar, timestamp, boolean, text, decimal, date } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";
import { jsonb } from "drizzle-orm/pg-core";

export const customerHealthScoresTable = pgTable("customer_health_scores", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id, { onDelete: "cascade" }),
  calculatedAt: timestamp("calculated_at").notNull().defaultNow(),
  engagementScore: integer("engagement_score").notNull().default(0),
  actionScore: integer("action_score").notNull().default(50),
  scanScore: integer("scan_score").notNull().default(0),
  alertScore: integer("alert_score").notNull().default(0),
  valueScore: integer("value_score").notNull().default(30),
  healthScore: integer("health_score").notNull().default(0),
  healthTier: varchar("health_tier", { length: 20 }).notNull().default("at_risk"),
  churnProbability: decimal("churn_probability", { precision: 5, scale: 2 }).notNull().default("50"),
  churnRiskFactors: text("churn_risk_factors").array().notNull().default([]),
  predictedChurnDate: date("predicted_churn_date"),
  interventionTriggered: boolean("intervention_triggered").notNull().default(false),
  interventionType: varchar("intervention_type", { length: 50 }),
  interventionSentAt: timestamp("intervention_sent_at"),
});

export const customerActivityEventsTable = pgTable("customer_activity_events", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id, { onDelete: "cascade" }),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  occurredAt: timestamp("occurred_at").notNull().defaultNow(),
  metadata: jsonb("metadata"),
});

export const healthInterventionsTable = pgTable("health_interventions", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id, { onDelete: "cascade" }),
  interventionType: varchar("intervention_type", { length: 50 }).notNull(),
  triggeredAt: timestamp("triggered_at").notNull().defaultNow(),
  healthScoreAtTrigger: integer("health_score_at_trigger"),
  response: varchar("response", { length: 20 }),
  respondedAt: timestamp("responded_at"),
});

export type CustomerHealthScore = typeof customerHealthScoresTable.$inferSelect;
export type CustomerActivityEvent = typeof customerActivityEventsTable.$inferSelect;
export type HealthIntervention = typeof healthInterventionsTable.$inferSelect;
