import { pgTable, serial, text, timestamp, boolean, integer, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Plans ────────────────────────────────────────────────────────────────────
// free: 1 user, 10 assessments, no ISR
// starter: 5 users, 100 assessments, ISR included, Replit Gemini
// pro: unlimited, ISR, custom AI provider

export const tenantsTable = pgTable("tenants", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  plan: text("plan").notNull().default("free"), // free | starter | pro
  // Limits (null = unlimited)
  maxUsers: integer("max_users").notNull().default(1),
  maxAssessments: integer("max_assessments").notNull().default(10),
  isrEnabled: boolean("isr_enabled").notNull().default(false),
  // Branding
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color"),
  // AI config per tenant
  aiProvider: text("ai_provider").notNull().default("gemini-replit"), // gemini-replit | gemini | openai | anthropic
  aiApiKey: text("ai_api_key"), // stored encrypted (base64 for now, swap with vault later)
  aiModel: text("ai_model"), // e.g. gpt-4o, gemini-2.5-flash, claude-3-5-sonnet
  // Quote / ISR settings
  quoteTerms: text("quote_terms"), // default terms appended to quotes
  quoteValidDays: integer("quote_valid_days").notNull().default(30),
  quoteFooter: text("quote_footer"),
  // IMAP settings per tenant
  imapHost: text("imap_host"),
  imapUser: text("imap_user"),
  imapPass: text("imap_pass"), // encrypted
  smtpHost: text("smtp_host"),
  smtpUser: text("smtp_user"),
  smtpPass: text("smtp_pass"), // encrypted
  smtpPort: integer("smtp_port").notNull().default(587),
  // Metadata
  isActive: boolean("is_active").notNull().default(true),
  settings: jsonb("settings").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const tenantUsersTable = pgTable("tenant_users", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  adminUserId: integer("admin_user_id").notNull(),
  role: text("role").notNull().default("member"), // owner | admin | member
  invitedByAdminUserId: integer("invited_by_admin_user_id"),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("tenant_users_tenant_admin_uq").on(table.tenantId, table.adminUserId),
]);

export const insertTenantSchema = createInsertSchema(tenantsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTenantUserSchema = createInsertSchema(tenantUsersTable).omit({ id: true, joinedAt: true });

export type Tenant = typeof tenantsTable.$inferSelect;
export type TenantUser = typeof tenantUsersTable.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type InsertTenantUser = z.infer<typeof insertTenantUserSchema>;
