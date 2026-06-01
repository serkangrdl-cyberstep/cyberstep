import { pgTable, serial, integer, varchar, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";

export const customerServiceConfigsTable = pgTable("customer_service_configs", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  serviceSlug: varchar("service_slug", { length: 100 }).notNull(),
  config: jsonb("config").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  uniqueIndex("idx_ssc_customer_slug").on(t.customerId, t.serviceSlug),
]);

export type CustomerServiceConfig = typeof customerServiceConfigsTable.$inferSelect;
