import { pgTable, serial, text, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";

interface CarouselSlide { slide: number; text: string; }
interface VisualPrompts { blog: string; linkedin: string; instagram: string; x: string; }
interface BlogRef { title: string; url: string; }

export const blogPostsTable = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  excerpt: text("excerpt").notNull(),
  content: text("content").notNull(),
  titleEn: text("title_en"),
  excerptEn: text("excerpt_en"),
  contentEn: text("content_en"),
  socialTextTr: text("social_text_tr"),
  socialTextEn: text("social_text_en"),
  coverImageBase64: text("cover_image_base64"),
  authorName: text("author_name").notNull().default("CyberStep.io"),
  status: text("status").notNull().default("draft"),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  // SEO
  seoTitle: text("seo_title"),
  seoTitleEn: text("seo_title_en"),
  metaDescription: text("meta_description"),
  metaDescriptionEn: text("meta_description_en"),
  focusKeyword: text("focus_keyword"),
  focusKeywordEn: text("focus_keyword_en"),
  seoTags: jsonb("seo_tags").$type<string[]>(),
  seoTagsEn: jsonb("seo_tags_en").$type<string[]>(),
  // Social media
  linkedinPostTr: text("linkedin_post_tr"),
  linkedinPostEn: text("linkedin_post_en"),
  instagramCarouselTr: jsonb("instagram_carousel_tr").$type<CarouselSlide[]>(),
  instagramCarouselEn: jsonb("instagram_carousel_en").$type<CarouselSlide[]>(),
  instagramCaptionTr: text("instagram_caption_tr"),
  instagramCaptionEn: text("instagram_caption_en"),
  visualPromptsTr: jsonb("visual_prompts_tr").$type<VisualPrompts>(),
  visualPromptsEn: jsonb("visual_prompts_en").$type<VisualPrompts>(),
  // Shared references
  refsJson: jsonb("refs_json").$type<BlogRef[]>(),
});

export const newsletterSubscribersTable = pgTable("newsletter_subscribers", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  unsubscribeToken: text("unsubscribe_token").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  subscribedAt: timestamp("subscribed_at").notNull().defaultNow(),
  unsubscribedAt: timestamp("unsubscribed_at"),
});

export const socialMediaLinksTable = pgTable("social_media_links", {
  id: serial("id").primaryKey(),
  platform: text("platform").notNull(),
  label: text("label").notNull(),
  url: text("url").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const specialDayMessagesTable = pgTable("special_day_messages", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  messageTr: text("message_tr").notNull(),
  messageEn: text("message_en"),
  imageBase64: text("image_base64"),
  bgColor: text("bg_color").notNull().default("#0f172a"),
  textColor: text("text_color").notNull().default("#ffffff"),
  startAt: timestamp("start_at").notNull(),
  endAt: timestamp("end_at").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  sendNewsletter: boolean("send_newsletter").notNull().default(false),
  newsletterSent: boolean("newsletter_sent").notNull().default(false),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type BlogPost = typeof blogPostsTable.$inferSelect;
export type NewsletterSubscriber = typeof newsletterSubscribersTable.$inferSelect;
export type SocialMediaLink = typeof socialMediaLinksTable.$inferSelect;
export type SpecialDayMessage = typeof specialDayMessagesTable.$inferSelect;
