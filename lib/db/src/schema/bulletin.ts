import {
  pgTable, serial, varchar, text, integer, boolean,
  timestamp, date, numeric, index,
} from "drizzle-orm/pg-core";
import { isrCustomersTable } from "./isr";

export const weeklyBulletinsTable = pgTable("weekly_bulletins", {
  id: serial("id").primaryKey(),
  countryCode: varchar("country_code", { length: 5 }).default("TR"),
  weekNumber: integer("week_number").notNull(),
  year: integer("year").notNull(),
  weekSlug: varchar("week_slug", { length: 30 }).unique(),

  status: varchar("status", { length: 20 }).default("draft"),
  dateRangeStart: date("date_range_start"),
  dateRangeEnd: date("date_range_end"),
  totalScansThisWeek: integer("total_scans_this_week"),
  newCriticalCves: integer("new_critical_cves"),
  topFindingType: varchar("top_finding_type", { length: 100 }),
  topFindingPct: numeric("top_finding_pct", { precision: 5, scale: 2 }),
  notableSector: varchar("notable_sector", { length: 50 }),
  regulationUpdate: text("regulation_update"),

  headline: varchar("headline", { length: 255 }),
  introText: text("intro_text"),
  threatRadar: text("threat_radar"),
  turkeyData: text("turkey_data"),
  regulationSection: text("regulation_section"),
  weeklyTip: text("weekly_tip"),
  toolResource: text("tool_resource"),

  emailSubject: varchar("email_subject", { length: 255 }),
  emailPreview: varchar("email_preview", { length: 90 }),
  emailHtml: text("email_html"),
  emailPlainText: text("email_plain_text"),

  linkedinMiniPost: text("linkedin_mini_post"),

  sentAt: timestamp("sent_at"),
  recipientCount: integer("recipient_count").default(0),
  openRate: numeric("open_rate", { precision: 5, scale: 2 }),
  clickRate: numeric("click_rate", { precision: 5, scale: 2 }),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("idx_bulletins_week_slug").on(t.weekSlug),
  index("idx_bulletins_status").on(t.status),
]);

export const bulletinSubscribersTable = pgTable("bulletin_subscribers", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  name: varchar("name", { length: 255 }),
  company: varchar("company", { length: 255 }),
  title: varchar("title", { length: 255 }),
  countryCode: varchar("country_code", { length: 5 }).default("TR"),

  source: varchar("source", { length: 50 }),
  frequency: varchar("frequency", { length: 20 }).default("weekly"),
  language: varchar("language", { length: 10 }).default("tr"),

  totalReceived: integer("total_received").default(0),
  totalOpened: integer("total_opened").default(0),
  totalClicked: integer("total_clicked").default(0),
  lastOpenedAt: timestamp("last_opened_at"),
  engagementScore: integer("engagement_score").default(50),

  isrCustomerId: integer("isr_customer_id").references(() => isrCustomersTable.id),

  isActive: boolean("is_active").default(true),
  unsubscribedAt: timestamp("unsubscribed_at"),
  unsubscribeReason: varchar("unsubscribe_reason", { length: 100 }),

  subscribedAt: timestamp("subscribed_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("idx_bulletin_subs_active").on(t.isActive),
]);

export const bulletinClicksTable = pgTable("bulletin_clicks", {
  id: serial("id").primaryKey(),
  bulletinId: integer("bulletin_id").references(() => weeklyBulletinsTable.id),
  subscriberId: integer("subscriber_id").references(() => bulletinSubscribersTable.id),
  linkSection: varchar("link_section", { length: 50 }),
  clickedAt: timestamp("clicked_at").defaultNow(),
});

export type WeeklyBulletin = typeof weeklyBulletinsTable.$inferSelect;
export type BulletinSubscriber = typeof bulletinSubscribersTable.$inferSelect;
