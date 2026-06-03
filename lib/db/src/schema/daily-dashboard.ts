import { pgTable, serial, date, integer, decimal, jsonb, timestamp } from "drizzle-orm/pg-core";

export interface ActionItem {
  priority: number;
  icon: string;
  description: string;
  url: string;
  estimatedMinutes: number;
}

export const dailySummariesTable = pgTable("daily_summaries", {
  id: serial("id").primaryKey(),
  summaryDate: date("summary_date").unique().notNull(),

  activeSubscriptions: integer("active_subscriptions").default(0),
  mrrTrl: decimal("mrr_trl", { precision: 12, scale: 2 }).default("0"),
  newCustomersToday: integer("new_customers_today").default(0),
  renewalsDue30Days: integer("renewals_due_30_days").default(0),
  overduePayments: integer("overdue_payments").default(0),
  momMrrChange: decimal("mom_mrr_change", { precision: 5, scale: 2 }).default("0"),

  domainsScannedLastNight: integer("domains_scanned_last_night").default(0),
  leadsQualified: integer("leads_qualified").default(0),
  emailsReadyToSend: integer("emails_ready_to_send").default(0),
  emailsSentYesterday: integer("emails_sent_yesterday").default(0),

  highChurnRiskCount: integer("high_churn_risk_count").default(0),
  mediumChurnRiskCount: integer("medium_churn_risk_count").default(0),

  cveAlertsLast24h: integer("cve_alerts_last_24h").default(0),
  iocProcessedLast24h: integer("ioc_processed_last_24h").default(0),

  socialPostsPendingApproval: integer("social_posts_pending_approval").default(0),
  socialPostsPublishedYesterday: integer("social_posts_published_yesterday").default(0),
  newsletterSubscribers: integer("newsletter_subscribers").default(0),

  actionItems: jsonb("action_items").$type<ActionItem[]>().default([]),
  generatedAt: timestamp("generated_at").defaultNow(),
});

export type DailySummary = typeof dailySummariesTable.$inferSelect;
