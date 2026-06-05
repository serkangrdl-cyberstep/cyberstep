import {
  pgTable, serial, varchar, text, integer, boolean,
  timestamp, jsonb, date, numeric, index, unique,
} from "drizzle-orm/pg-core";

export const vulncheckKevTable = pgTable("vulncheck_kev", {
  id: serial("id").primaryKey(),
  cveId: varchar("cve_id", { length: 30 }).unique().notNull(),

  vulnCheckId: varchar("vuln_check_id", { length: 100 }),
  description: text("description"),
  cvssScore: numeric("cvss_score", { precision: 4, scale: 1 }),
  cvssVersion: varchar("cvss_version", { length: 10 }),
  epssScore: numeric("epss_score", { precision: 6, scale: 4 }),
  epssPercentile: numeric("epss_percentile", { precision: 5, scale: 2 }),

  dateAdded: date("date_added"),
  dateFirstExploited: date("date_first_exploited"),
  ransomwareUse: boolean("ransomware_use").default(false),

  affectedProducts: jsonb("affected_products"),
  isNetworkEdge: boolean("is_network_edge").default(false),
  isEndOfLife: boolean("is_end_of_life").default(false),

  inCisaKev: boolean("in_cisa_kev").default(false),
  cisaDueDate: date("cisa_due_date"),

  source: varchar("source", { length: 50 }).default("vulncheck"),
  lastFetchedAt: timestamp("last_fetched_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("vulncheck_kev_edge_idx").on(t.isNetworkEdge),
  index("vulncheck_kev_ransomware_idx").on(t.ransomwareUse),
  index("vulncheck_kev_date_idx").on(t.dateAdded),
]);

export const annualIntelReportsTable = pgTable("annual_intel_reports", {
  id: serial("id").primaryKey(),
  reportKey: varchar("report_key", { length: 100 }).unique().notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  publisher: varchar("publisher", { length: 100 }),
  reportYear: integer("report_year"),
  publishDate: date("publish_date"),

  rawContent: text("raw_content"),
  keyFindings: jsonb("key_findings"),
  turkeyImpactSummary: text("turkey_impact_summary"),
  cyberstepRecommendations: jsonb("cyberstep_recommendations"),

  status: varchar("status", { length: 20 }).default("pending"),
  usedInReportMonth: varchar("used_in_report_month", { length: 7 }),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const intelFeedSourcesTable = pgTable("intel_feed_sources", {
  id: serial("id").primaryKey(),
  sourceKey: varchar("source_key", { length: 100 }).unique().notNull(),
  name: varchar("name", { length: 255 }),
  feedUrl: varchar("feed_url", { length: 500 }),
  feedType: varchar("feed_type", { length: 20 }).default("rss"),
  category: varchar("category", { length: 50 }),
  isActive: boolean("is_active").default(true),
  lastCheckedAt: timestamp("last_checked_at"),
  lastNewItemAt: timestamp("last_new_item_at"),
  checkIntervalHours: integer("check_interval_hours").default(4),
  createdAt: timestamp("created_at").defaultNow(),
});

export const intelFeedItemsTable = pgTable("intel_feed_items", {
  id: serial("id").primaryKey(),
  sourceKey: varchar("source_key", { length: 100 }).notNull(),
  itemUrl: varchar("item_url", { length: 500 }).notNull(),
  title: text("title"),
  summary: text("summary"),
  publishedAt: timestamp("published_at"),
  isRelevant: boolean("is_relevant"),
  relevanceScore: integer("relevance_score"),
  relevanceReason: text("relevance_reason"),
  tags: text("tags").array(),
  notifiedAt: timestamp("notified_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  unique("intel_feed_item_url_uq").on(t.itemUrl),
  index("intel_feed_items_source_idx").on(t.sourceKey),
  index("intel_feed_items_relevant_idx").on(t.isRelevant),
]);

export type VulncheckKev = typeof vulncheckKevTable.$inferSelect;
export type AnnualIntelReport = typeof annualIntelReportsTable.$inferSelect;
export type IntelFeedSource = typeof intelFeedSourcesTable.$inferSelect;
export type IntelFeedItem = typeof intelFeedItemsTable.$inferSelect;
