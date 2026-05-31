import { pgTable, serial, integer, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

export const phishingSimulationsTable = pgTable("phishing_simulations", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id"),
  companyName: text("company_name").notNull(),
  domain: text("domain").notNull(),
  contactEmail: text("contact_email"),
  sector: text("sector"),
  employeeCount: text("employee_count"),
  osintData: jsonb("osint_data"),
  scenarios: jsonb("scenarios"),
  status: text("status").default("collecting"),
  paymentStatus: text("payment_status").default("unpaid"),
  priceTl: integer("price_tl").default(1990),
  reportJson: jsonb("report_json"),
  pdfPath: text("pdf_path"),
  consentAccepted: boolean("consent_accepted").default(false),
  consentText: text("consent_text"),
  consentAcceptedAt: timestamp("consent_accepted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  viewedAt: timestamp("viewed_at"),
});
export type PhishingSimulation = typeof phishingSimulationsTable.$inferSelect;

export const phishingSimOsintSourcesTable = pgTable("phishing_sim_osint_sources", {
  id: serial("id").primaryKey(),
  simulationId: integer("simulation_id").notNull(),
  sourceType: text("source_type"),
  sourceUrl: text("source_url"),
  dataFound: text("data_found"),
  riskContribution: text("risk_contribution"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type PhishingSimOsintSource = typeof phishingSimOsintSourcesTable.$inferSelect;
