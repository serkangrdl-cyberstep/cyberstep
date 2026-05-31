import { pgTable, serial, varchar, text, integer, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";

export const achievementBadgesTable = pgTable("achievement_badges", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 100 }).unique().notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 10 }),
  conditionType: varchar("condition_type", { length: 50 }),
  conditionValue: integer("condition_value"),
  isShareable: boolean("is_shareable").default(true),
});

export const customerAchievementsTable = pgTable("customer_achievements", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customersTable.id),
  badgeId: integer("badge_id").references(() => achievementBadgesTable.id),
  earnedAt: timestamp("earned_at").defaultNow(),
  sharedAt: timestamp("shared_at"),
}, (t) => [unique().on(t.customerId, t.badgeId)]);

export type AchievementBadge = typeof achievementBadgesTable.$inferSelect;
export type CustomerAchievement = typeof customerAchievementsTable.$inferSelect;
