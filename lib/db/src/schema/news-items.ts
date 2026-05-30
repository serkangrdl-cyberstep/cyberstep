import { pgTable, serial, integer, text, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { newsSourcesTable } from "./news-sources";

export const newsItemsTable = pgTable("news_items", {
  id: serial("id").primaryKey(),
  sourceId: integer("source_id").notNull().references(() => newsSourcesTable.id),
  title: text("title").notNull(),
  url: text("url").notNull().unique(),
  summary: text("summary"),
  content: text("content"),
  publishedAt: timestamp("published_at"),
  relevanceScore: numeric("relevance_score", { precision: 5, scale: 2 }),
  isTurkeyRelated: boolean("is_turkey_related").notNull().default(false),
  isIncluded: boolean("is_included").notNull().default(false),
  weekYear: integer("week_year"),
  weekNumber: integer("week_number"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertNewsItemSchema = createInsertSchema(newsItemsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertNewsItem = z.infer<typeof insertNewsItemSchema>;
export type NewsItem = typeof newsItemsTable.$inferSelect;
