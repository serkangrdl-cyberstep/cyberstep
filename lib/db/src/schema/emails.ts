import { pgTable, serial, text, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Email Templates ──────────────────────────────────────────────────────────
export const emailTemplatesTable = pgTable("email_templates", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("custom"), // deal | assessment | custom
  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  bodyText: text("body_text"),
  // Variables list for UI hints e.g. ["companyName","contactName"]
  variables: jsonb("variables").$type<string[]>().default([]),
  isDefault: boolean("is_default").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertEmailTemplateSchema = createInsertSchema(emailTemplatesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type EmailTemplate = typeof emailTemplatesTable.$inferSelect;

// ─── Email Send Log ───────────────────────────────────────────────────────────
export const emailSendsTable = pgTable("email_sends", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  templateId: integer("template_id"),            // null if ad-hoc
  toEmail: text("to_email").notNull(),
  toName: text("to_name"),
  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  status: text("status").notNull().default("sent"), // sent | failed | queued
  relatedType: text("related_type"),               // deal | assessment | custom
  relatedId: integer("related_id"),
  error: text("error"),
  sentAt: timestamp("sent_at").defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertEmailSendSchema = createInsertSchema(emailSendsTable).omit({ id: true, createdAt: true });
export type InsertEmailSend = z.infer<typeof insertEmailSendSchema>;
export type EmailSend = typeof emailSendsTable.$inferSelect;
