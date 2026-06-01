import { pgTable, serial, text, numeric, boolean, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
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
});

export type ServiceCatalog = typeof serviceCatalogTable.$inferSelect;
export const insertServiceCatalogSchema = createInsertSchema(serviceCatalogTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertServiceCatalog = z.infer<typeof insertServiceCatalogSchema>;
