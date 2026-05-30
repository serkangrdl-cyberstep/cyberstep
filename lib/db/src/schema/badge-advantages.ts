import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const badgeAdvantagesTable = pgTable("badge_advantages", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  partnerName: text("partner_name").notNull(),
  description: text("description").notNull(),
  discountPercent: integer("discount_percent"),
  badgeText: text("badge_text"),
  logoUrl: text("logo_url"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBadgeAdvantageSchema = createInsertSchema(badgeAdvantagesTable).omit({ id: true, createdAt: true });
export type InsertBadgeAdvantage = z.infer<typeof insertBadgeAdvantageSchema>;
export type BadgeAdvantage = typeof badgeAdvantagesTable.$inferSelect;
