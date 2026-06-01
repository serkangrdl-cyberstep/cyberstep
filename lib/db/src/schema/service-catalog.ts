import { pgTable, serial, text, varchar, numeric, boolean, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const serviceCatalogTable = pgTable("service_catalog", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  label: text("label").notNull(),
  shortDescription: text("short_description").notNull(),
  longDescription: text("long_description").notNull().default(""),
  features: jsonb("features").notNull().default([]),
  howItWorks: jsonb("how_it_works").notNull().default([]),
  faq: jsonb("faq").notNull().default([]),
  monthlyPriceTl: numeric("monthly_price_tl", { precision: 10, scale: 2 }).notNull(),
  setupFeeTl: numeric("setup_fee_tl", { precision: 10, scale: 2 }).notNull().default("0"),
  category: text("category").notNull().default("monitoring"),
  icon: text("icon").notNull().default("Shield"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  // Plan A — genişletilmiş alanlar
  serviceType: varchar("service_type", { length: 20 }).default("monthly"),
  priceTl: numeric("price_tl", { precision: 12, scale: 2 }),
  priceTlAnnual: numeric("price_tl_annual", { precision: 12, scale: 2 }),
  usageUnit: varchar("usage_unit", { length: 50 }),
  setupTimeHours: integer("setup_time_hours").default(0),
  deliveryTimeHours: integer("delivery_time_hours").default(0),
  slaResponseMinutes: integer("sla_response_minutes"),
  requirements: jsonb("requirements").default([]),
  targetAudience: text("target_audience").array().default([]),
  isSelfService: boolean("is_self_service").default(true),
  requiresAdminApproval: boolean("requires_admin_approval").default(false),
});

export type ServiceCatalog = typeof serviceCatalogTable.$inferSelect;
export const insertServiceCatalogSchema = createInsertSchema(serviceCatalogTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertServiceCatalog = z.infer<typeof insertServiceCatalogSchema>;
