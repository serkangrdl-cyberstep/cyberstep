import { pgTable, serial, text, timestamp, boolean, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const customersTable = pgTable("customers", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  companyName: text("company_name"),
  totpSecret: text("totp_secret"),
  totpEnabled: boolean("totp_enabled").notNull().default(false),
  subscriptionPlan: text("subscription_plan"),
  subscriptionStatus: text("subscription_status").notNull().default("inactive"),
  passwordResetToken: text("password_reset_token"),
  passwordResetExpiresAt: timestamp("password_reset_expires_at"),
  nextBillingDate: timestamp("next_billing_date"),
  referralCodeUsed: varchar("referral_code_used", { length: 20 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCustomerSchema = createInsertSchema(customersTable).omit({
  id: true, createdAt: true, updatedAt: true,
});

export type Customer = typeof customersTable.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
