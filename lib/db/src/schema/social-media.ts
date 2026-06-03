import { pgTable, serial, varchar, text, boolean, integer, timestamp, date, time, jsonb, decimal } from "drizzle-orm/pg-core";

export const socialMediaAccountsTable = pgTable("social_media_accounts", {
  id:              serial("id").primaryKey(),
  platform:        varchar("platform", { length: 20 }).unique().notNull(),
  accountName:     varchar("account_name", { length: 100 }),
  accountId:       varchar("account_id", { length: 100 }),
  accessToken:     text("access_token"),
  tokenExpiresAt:  timestamp("token_expires_at"),
  isActive:        boolean("is_active").default(true),
  lastPostedAt:    timestamp("last_posted_at"),
  createdAt:       timestamp("created_at").defaultNow(),
});

export const specialDaysTable = pgTable("special_days", {
  id:                  serial("id").primaryKey(),
  name:                varchar("name", { length: 255 }).notNull(),
  nameEn:              varchar("name_en", { length: 255 }),
  day:                 integer("day"),
  month:               integer("month"),
  isLunar:             boolean("is_lunar").default(false),
  category:            varchar("category", { length: 30 }),
  tone:                varchar("tone", { length: 20 }),
  cybersecurityAngle:  text("cybersecurity_angle"),
  isActive:            boolean("is_active").default(true),
});

export const contentCalendarTable = pgTable("content_calendar", {
  id:                serial("id").primaryKey(),
  weekStart:         date("week_start").notNull(),
  generatedAt:       timestamp("generated_at"),
  status:            varchar("status", { length: 20 }).default("pending"),
  totalPosts:        integer("total_posts").default(0),
  approvedPosts:     integer("approved_posts").default(0),
  publishedPosts:    integer("published_posts").default(0),
  generationCostUsd: decimal("generation_cost_usd", { precision: 8, scale: 6 }).default("0"),
  createdAt:         timestamp("created_at").defaultNow(),
});

export const socialMediaPostsTable = pgTable("social_media_posts", {
  id:               serial("id").primaryKey(),
  calendarId:       integer("calendar_id").references(() => contentCalendarTable.id),
  platform:         varchar("platform", { length: 20 }).notNull(),
  postType:         varchar("post_type", { length: 30 }).default("standard"),
  scheduledDate:    date("scheduled_date"),
  scheduledTime:    time("scheduled_time").default("09:30"),
  caption:          text("caption"),
  hashtags:         text("hashtags").array(),
  altText:          varchar("alt_text", { length: 500 }),
  slides:           jsonb("slides"),
  threadTweets:     jsonb("thread_tweets"),
  imageSvg:         text("image_svg"),
  imagePngPath:     varchar("image_png_path", { length: 500 }),
  imageDimensions:  varchar("image_dimensions", { length: 20 }),
  status:           varchar("status", { length: 20 }).default("draft"),
  revisionRequest:  text("revision_request"),
  revisionCount:    integer("revision_count").default(0),
  approvedBy:       varchar("approved_by", { length: 100 }),
  approvedAt:       timestamp("approved_at"),
  publishedAt:      timestamp("published_at"),
  platformPostId:   varchar("platform_post_id", { length: 255 }),
  platformPostUrl:  varchar("platform_post_url", { length: 500 }),
  likes:            integer("likes").default(0),
  comments:         integer("comments").default(0),
  shares:           integer("shares").default(0),
  impressions:      integer("impressions").default(0),
  clicks:           integer("clicks").default(0),
  fetchedAt:        timestamp("fetched_at"),
  specialDayId:     integer("special_day_id").references(() => specialDaysTable.id),
  dataSource:       varchar("data_source", { length: 100 }),
  generationPrompt: text("generation_prompt"),
  generationCostUsd: decimal("generation_cost_usd", { precision: 8, scale: 6 }).default("0"),
  createdAt:        timestamp("created_at").defaultNow(),
  updatedAt:        timestamp("updated_at").defaultNow(),
});

export type SocialMediaAccount = typeof socialMediaAccountsTable.$inferSelect;
export type SpecialDay        = typeof specialDaysTable.$inferSelect;
export type ContentCalendar   = typeof contentCalendarTable.$inferSelect;
export type SocialMediaPost   = typeof socialMediaPostsTable.$inferSelect;
