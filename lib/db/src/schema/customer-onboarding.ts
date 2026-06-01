import { pgTable, serial, integer, boolean, timestamp, varchar } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";

export const customerOnboardingTable = pgTable("customer_onboarding", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customersTable.id).unique(),
  onboardingType: varchar("onboarding_type", { length: 20 }).default("self_service"),
  stepRegistered: boolean("step_registered").default(false),
  stepEmailVerified: boolean("step_email_verified").default(false),
  stepFirstScan: boolean("step_first_scan").default(false),
  stepMiniAssessment: boolean("step_mini_assessment").default(false),
  stepPayment: boolean("step_payment").default(false),
  stepServiceActivated: boolean("step_service_activated").default(false),
  stepIntegrationConfigured: boolean("step_integration_configured").default(false),
  stepFirstReportViewed: boolean("step_first_report_viewed").default(false),
  stepNotificationEnabled: boolean("step_notification_enabled").default(false),
  stepCompleted: boolean("step_completed").default(false),
  registeredAt: timestamp("registered_at"),
  emailVerifiedAt: timestamp("email_verified_at"),
  firstScanAt: timestamp("first_scan_at"),
  paymentAt: timestamp("payment_at"),
  serviceActivatedAt: timestamp("service_activated_at"),
  completedAt: timestamp("completed_at"),
  assignedTo: varchar("assigned_to", { length: 100 }),
  nudge1SentAt: timestamp("nudge_1_sent_at"),
  nudge2SentAt: timestamp("nudge_2_sent_at"),
  nudge3SentAt: timestamp("nudge_3_sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type CustomerOnboarding = typeof customerOnboardingTable.$inferSelect;
