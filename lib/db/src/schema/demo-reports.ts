import { pgTable, serial, varchar, integer, boolean, timestamp, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const demoReportsTable = pgTable("demo_reports", {
  id: serial("id").primaryKey(),
  reportType: varchar("report_type", { length: 50 }).notNull().unique(),
  sourceDomain: varchar("source_domain", { length: 255 }),
  sourceScanId: integer("source_scan_id"),
  demoDomain: varchar("demo_domain", { length: 50 }).default("abc.com.tr"),
  demoCompany: varchar("demo_company", { length: 100 }).default("Örnek A.Ş."),
  demoSector: varchar("demo_sector", { length: 100 }).default("Teknoloji"),
  pdfPath: varchar("pdf_path", { length: 500 }),
  pdfUrl: varchar("pdf_url", { length: 500 }),
  originalScore: integer("original_score"),
  displayScore: integer("display_score"),
  isActive: boolean("is_active").notNull().default(true),
  downloadCount: integer("download_count").notNull().default(0),
  leadCaptures: integer("lead_captures").notNull().default(0),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const demoLeadsTable = pgTable("demo_leads", {
  id: serial("id").primaryKey(),
  reportType: varchar("report_type", { length: 50 }),
  reportId: integer("report_id").references(() => demoReportsTable.id),
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  company: text("company"),
  phone: varchar("phone", { length: 50 }),
  source: varchar("source", { length: 100 }).default("demo_page"),
  welcomedEmailSent: boolean("welcomed_email_sent").notNull().default(false),
  addedToIsr: boolean("added_to_isr").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type DemoReport = typeof demoReportsTable.$inferSelect;
export type DemoLead = typeof demoLeadsTable.$inferSelect;
export const insertDemoReportSchema = createInsertSchema(demoReportsTable).omit({ id: true, generatedAt: true, updatedAt: true });
export type InsertDemoReport = z.infer<typeof insertDemoReportSchema>;
export const insertDemoLeadSchema = createInsertSchema(demoLeadsTable).omit({ id: true, createdAt: true });
export type InsertDemoLead = z.infer<typeof insertDemoLeadSchema>;
