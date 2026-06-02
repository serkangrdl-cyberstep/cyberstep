import { pgTable, serial, integer, varchar, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";
import { customerServicesTable } from "./customer-services";

export const customerServiceOnboardingTable = pgTable("customer_service_onboarding", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id, { onDelete: "cascade" }),
  subscriptionId: integer("subscription_id").references(() => customerServicesTable.id, { onDelete: "set null" }),
  serviceSlug: varchar("service_slug", { length: 100 }).notNull(),
  stepKey: varchar("step_key", { length: 100 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  completedBy: varchar("completed_by", { length: 200 }),
  completedAt: timestamp("completed_at"),
  failedAt: timestamp("failed_at"),
  failureReason: text("failure_reason"),
  retryCount: integer("retry_count").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("idx_svo_customer").on(t.customerId),
  index("idx_svo_slug_step").on(t.serviceSlug, t.stepKey),
  uniqueIndex("idx_svo_unique").on(t.customerId, t.serviceSlug, t.stepKey),
]);

export type CustomerServiceOnboarding = typeof customerServiceOnboardingTable.$inferSelect;
