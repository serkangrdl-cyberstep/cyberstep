import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const partnerLeadsTable = pgTable("partner_leads", {
  id: serial("id").primaryKey(),
  leadType: text("lead_type").notNull(), // erp | insurance | threat-intel | score-api
  name: text("name").notNull(),
  email: text("email").notNull(),
  company: text("company").notNull(),
  phone: text("phone"),
  role: text("role"),
  sector: text("sector"),
  employeeCount: text("employee_count"),
  useCase: text("use_case"),
  message: text("message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPartnerLeadSchema = createInsertSchema(partnerLeadsTable).omit({ id: true, createdAt: true });
export type InsertPartnerLead = z.infer<typeof insertPartnerLeadSchema>;
export type PartnerLead = typeof partnerLeadsTable.$inferSelect;
