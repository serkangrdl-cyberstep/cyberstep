import { pgTable, serial, text, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";

export const consultingServicesTable = pgTable("consulting_services", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull().default("Shield"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const techPartnersTable = pgTable("tech_partners", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  logoUrl: text("logo_url").notNull(),
  websiteUrl: text("website_url"),
  salesRepName: text("sales_rep_name"),
  salesRepEmail: text("sales_rep_email"),
  additionalContacts: jsonb("additional_contacts").notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const whiteLabelPartnersTable = pgTable("white_label_partners", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").notNull().default("#10b981"),
  contactEmail: text("contact_email"),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type ConsultingService = typeof consultingServicesTable.$inferSelect;
export type TechPartner = typeof techPartnersTable.$inferSelect;
export type WhiteLabelPartner = typeof whiteLabelPartnersTable.$inferSelect;
