import { pgTable, serial, integer, boolean, timestamp, varchar, numeric, text, index } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";
import { serviceCatalogTable } from "./service-catalog";

export const customerServicesTable = pgTable("customer_services", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customersTable.id),
  serviceCatalogId: integer("service_catalog_id").references(() => serviceCatalogTable.id),
  status: varchar("status", { length: 20 }).default("pending"),
  activatedAt: timestamp("activated_at"),
  expiresAt: timestamp("expires_at"),
  usageCount: integer("usage_count").default(0),
  usageLimit: integer("usage_limit"),
  amountPaidTl: numeric("amount_paid_tl", { precision: 12, scale: 2 }),
  autoRenew: boolean("auto_renew").default(true),
  nextRenewalAt: timestamp("next_renewal_at"),
  renewalAttemptCount: integer("renewal_attempt_count").default(0),
  lastRenewalFailedAt: timestamp("last_renewal_failed_at"),
  activatedBy: varchar("activated_by", { length: 50 }).default("self"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("idx_cs_customer").on(t.customerId),
  index("idx_cs_status").on(t.status),
]);

export type CustomerService = typeof customerServicesTable.$inferSelect;
