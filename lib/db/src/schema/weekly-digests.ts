import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const weeklyDigestsTable = pgTable("weekly_digests", {
  id: serial("id").primaryKey(),
  weekYear: integer("week_year").notNull(),
  weekNumber: integer("week_number").notNull(),
  status: text("status").notNull().default("draft"),
  contentSummary: text("content_summary"),
  contentLinkedin: text("content_linkedin"),
  contentTwitter: text("content_twitter"),
  contentInstagram: text("content_instagram"),
  contentStory: text("content_story"),
  approvedAt: timestamp("approved_at"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertWeeklyDigestSchema = createInsertSchema(weeklyDigestsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWeeklyDigest = z.infer<typeof insertWeeklyDigestSchema>;
export type WeeklyDigest = typeof weeklyDigestsTable.$inferSelect;
