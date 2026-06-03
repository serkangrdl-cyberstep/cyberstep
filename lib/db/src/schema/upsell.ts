import { pgTable, serial, integer, varchar, timestamp } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";

export const upsellLogTable = pgTable("upsell_log", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customersTable.id),
  ruleId: varchar("rule_id", { length: 50 }).notNull(),
  sentAt: timestamp("sent_at").defaultNow(),
});

export type UpsellLog = typeof upsellLogTable.$inferSelect;
