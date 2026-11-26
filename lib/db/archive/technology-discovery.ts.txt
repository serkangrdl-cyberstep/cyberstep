import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";

export interface TechRegisterItem {
  category: string;
  vendor: string;
  product: string;
  model?: string;
  version?: string;
  haEnabled?: boolean;
  location?: string;
  notes?: string;
  confidenceSource: "customer_survey" | "domain_scan" | "shodan" | "ssl_banner";
  confidenceScore: number;
}

export interface SurveySection {
  selectedProducts: string[];
  freeText?: string;
  versions?: Record<string, string>;
  models?: Record<string, string>;
  notes?: string;
  completedAt: string;
}

export interface PrefillData {
  emailProvider?: string;
  wafProvider?: string;
  cdnProvider?: string;
  sslIssuer?: string;
  shadowItServices?: Array<{ name: string; category: string }>;
  mxRecords?: string[];
}

export const techDiscoveryRequestsTable = pgTable("technology_discovery_requests", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customersTable.id),
  token: text("token").notNull().unique(),

  email: text("email").notNull(),
  contactName: text("contact_name").notNull(),
  companyName: text("company_name").notNull(),
  phone: text("phone"),
  sector: text("sector"),

  // NDA
  ndaAcceptedAt: timestamp("nda_accepted_at"),
  ndaIp: text("nda_ip"),
  ndaUserAgent: text("nda_user_agent"),
  partnerSharingConsent: boolean("partner_sharing_consent").default(false),

  // Survey — JSONB keyed by section key
  surveyAnswers: jsonb("survey_answers").$type<Record<string, SurveySection>>().default({}),
  surveyStartedAt: timestamp("survey_started_at"),
  surveyCompletedAt: timestamp("survey_completed_at"),

  // Workshop
  workshopScheduledAt: timestamp("workshop_scheduled_at"),
  workshopCompletedAt: timestamp("workshop_completed_at"),
  workshopNotes: text("workshop_notes"),
  assignedPartner: text("assigned_partner"),

  // CMDB output
  techRegister: jsonb("tech_register").$type<TechRegisterItem[]>(),
  cmdbCreatedAt: timestamp("cmdb_created_at"),
  riskRoadmap: text("risk_roadmap"),

  // Pre-fill from domain scan
  prefillDomain: text("prefill_domain"),
  prefillData: jsonb("prefill_data").$type<PrefillData>(),

  status: text("status")
    .$type<"pending_nda" | "survey_in_progress" | "survey_complete" | "workshop_scheduled" | "workshop_complete" | "cmdb_created">()
    .default("pending_nda"),

  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type TechDiscoveryRequest = typeof techDiscoveryRequestsTable.$inferSelect;
