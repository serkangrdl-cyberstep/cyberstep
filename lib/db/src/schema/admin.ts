import { pgTable, serial, text, timestamp, boolean, jsonb, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const adminUsersTable = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  totpSecret: text("totp_secret"),
  totpEnabled: boolean("totp_enabled").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at"),
});

export const siteSettingsTable = pgTable("site_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const pricingPlansTable = pgTable("pricing_plans", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("TRY"),
  description: text("description").notNull().default(""),
  features: jsonb("features").$type<string[]>().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  assessmentId: integer("assessment_id"),
  planSlug: text("plan_slug").notNull(),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("TRY"),
  iyzicoPaymentId: text("iyzico_payment_id"),
  iyzicoToken: text("iyzico_token"),
  status: text("status").notNull().default("pending"),
  kdvAmount: numeric("kdv_amount", { precision: 10, scale: 2 }),
  netAmount: numeric("net_amount", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAdminUserSchema = createInsertSchema(adminUsersTable).omit({ id: true, createdAt: true });
export const insertSiteSettingSchema = createInsertSchema(siteSettingsTable).omit({ id: true });
export const insertPricingPlanSchema = createInsertSchema(pricingPlansTable).omit({ id: true });
export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type AdminUser = typeof adminUsersTable.$inferSelect;
export type SiteSetting = typeof siteSettingsTable.$inferSelect;
export type PricingPlan = typeof pricingPlansTable.$inferSelect;
export type Payment = typeof paymentsTable.$inferSelect;
