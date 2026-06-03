import { pgTable, serial, text, varchar, timestamp, boolean } from "drizzle-orm/pg-core";

export const marketWatchItemsTable = pgTable("market_watch_items", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  url: text("url").notNull().unique(),
  source: varchar("source", { length: 100 }),
  itemType: varchar("item_type", { length: 50 }),
  summary: text("summary"),
  publishedAt: timestamp("published_at"),
  weekSummarySentAt: timestamp("week_summary_sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type MarketWatchItem = typeof marketWatchItemsTable.$inferSelect;
