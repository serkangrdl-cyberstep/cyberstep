import { pgTable, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";

export const onboardingProgressTable = pgTable("onboarding_progress", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customersTable.id).unique(),
  domainAdded: boolean("domain_added").default(false),
  domainAddedAt: timestamp("domain_added_at"),
  firstScanCompleted: boolean("first_scan_completed").default(false),
  firstScanAt: timestamp("first_scan_at"),
  firstReportViewed: boolean("first_report_viewed").default(false),
  firstReportAt: timestamp("first_report_at"),
  emailNotificationsEnabled: boolean("email_notifications_enabled").default(false),
  profileCompleted: boolean("profile_completed").default(false),
  firstFindingAcknowledged: boolean("first_finding_acknowledged").default(false),
  whatsappConnected: boolean("whatsapp_connected").default(false),
  completionPct: integer("completion_pct").default(0),
  completedAt: timestamp("completed_at"),
  nudge1SentAt: timestamp("nudge_1_sent_at"),
  nudge2SentAt: timestamp("nudge_2_sent_at"),
  nudge3SentAt: timestamp("nudge_3_sent_at"),
});

export type OnboardingProgress = typeof onboardingProgressTable.$inferSelect;
