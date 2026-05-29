import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const partnersTable = pgTable("partners", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id"),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  website: text("website"),
  categories: text("categories").array().default([]),
  tier: text("tier").notNull().default("silver"),
  status: text("status").notNull().default("pending"),
  monthlyFee: integer("monthly_fee").default(0),
  subscriptionStatus: text("subscription_status").default("trial"),
  passwordHash: text("password_hash"),
  description: text("description"),
  totalProjectsCompleted: integer("total_projects_completed").default(0),
  totalRevenue: integer("total_revenue").default(0),
  rating: integer("rating"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  approvedAt: timestamp("approved_at"),
});

export const insertPartnerSchema = createInsertSchema(partnersTable).omit({ id: true, createdAt: true });
export type InsertPartner = z.infer<typeof insertPartnerSchema>;
export type Partner = typeof partnersTable.$inferSelect;
