import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const cisoLeadsTable = pgTable("ciso_leads", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  company: text("company").notNull(),
  phone: text("phone"),
  sector: text("sector"),
  employeeCount: text("employee_count"),
  currentCiso: text("current_ciso"),
  message: text("message"),
  tier: text("tier"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCisoLeadSchema = createInsertSchema(cisoLeadsTable).omit({ id: true, createdAt: true });
export type InsertCisoLead = z.infer<typeof insertCisoLeadSchema>;
export type CisoLead = typeof cisoLeadsTable.$inferSelect;
