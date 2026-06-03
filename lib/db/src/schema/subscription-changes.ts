import { pgTable, serial, integer, varchar, text, date, numeric, timestamp } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";

export const subscriptionChangesTable = pgTable("subscription_changes", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customersTable.id),
  changeType: varchar("change_type", { length: 30 }).notNull(),
  fromPlan: varchar("from_plan", { length: 50 }),
  toPlan: varchar("to_plan", { length: 50 }),
  reason: text("reason"),
  effectiveDate: date("effective_date"),
  performedBy: varchar("performed_by", { length: 50 }).default("customer"),
  proratedAmount: numeric("prorated_amount", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export type SubscriptionChange = typeof subscriptionChangesTable.$inferSelect;
