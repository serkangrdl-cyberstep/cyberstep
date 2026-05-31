import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const redTeamReportsTable = pgTable("red_team_reports", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id"),

  companyName: text("company_name").notNull(),
  domain: text("domain").notNull(),
  contactEmail: text("contact_email"),
  sector: text("sector"),

  phishingSimId: integer("phishing_sim_id"),
  osintData: jsonb("osint_data"),

  digitalFootprint: jsonb("digital_footprint"),
  attackVectors: jsonb("attack_vectors"),
  exposedBusinessInfo: jsonb("exposed_business_info"),

  reportJson: jsonb("report_json"),

  paymentStatus: text("payment_status").default("unpaid"),
  priceTl: integer("price_tl").default(2490),

  status: text("status").default("collecting"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertRedTeamReportSchema = createInsertSchema(redTeamReportsTable).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type RedTeamReport = typeof redTeamReportsTable.$inferSelect;
export type InsertRedTeamReport = z.infer<typeof insertRedTeamReportSchema>;
