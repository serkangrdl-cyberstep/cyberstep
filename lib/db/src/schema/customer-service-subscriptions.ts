import { pgTable, serial, text, numeric, timestamp, integer, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customersTable } from "./customers";

export const customerServiceSubscriptionsTable = pgTable("customer_service_subscriptions", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customersTable.id, { onDelete: "cascade" }),
  serviceSlug: text("service_slug").notNull(),
  serviceLabel: text("service_label").notNull(),
  status: text("status").notNull().default("active"),
  billingCycle: text("billing_cycle").notNull().default("monthly"),
  contactName: text("contact_name").notNull(),
  companyName: text("company_name").notNull().default(""),
  email: text("email").notNull(),
  phone: text("phone"),
  amountPaid: numeric("amount_paid", { precision: 10, scale: 2 }),
  currency: text("currency").notNull().default("TRY"),
  paymentRef: text("payment_ref"),
  iyzicoConversationId: text("iyzico_conversation_id"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  cancelsAt: timestamp("cancels_at", { withTimezone: true }),
  paymentFailedAt: timestamp("payment_failed_at", { withTimezone: true }),
  paymentFailureReason: text("payment_failure_reason"),
  paymentRetryCount: integer("payment_retry_count").default(0),
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  iyzicoCardUserKey: text("iyzico_card_user_key"),
  iyzicoCardToken: text("iyzico_card_token"),
  reminder30dSentAt: timestamp("reminder30d_sent_at", { withTimezone: true }),
  reminder7dSentAt: timestamp("reminder7d_sent_at", { withTimezone: true }),
  reminder1dSentAt: timestamp("reminder1d_sent_at", { withTimezone: true }),
  renewalToken: text("renewal_token"),
  renewalTokenExpiresAt: timestamp("renewal_token_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("css_customer_service_uq").on(t.customerId, t.serviceSlug),
  check("css_status_chk", sql`${t.status} IN ('active', 'pending', 'cancelled', 'expired', 'trial', 'suspended')`),
]);

export type CustomerServiceSubscription = typeof customerServiceSubscriptionsTable.$inferSelect;
export const insertCustomerServiceSubscriptionSchema = createInsertSchema(customerServiceSubscriptionsTable).omit({ id: true, createdAt: true });
export type InsertCustomerServiceSubscription = z.infer<typeof insertCustomerServiceSubscriptionSchema>;
