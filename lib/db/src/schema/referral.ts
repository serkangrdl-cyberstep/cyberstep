import { pgTable, serial, integer, varchar, boolean, timestamp } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";

export const referralCodesTable = pgTable("referral_codes", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 20 }).notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  isActive: boolean("is_active").notNull().default(true),
  totalUses: integer("total_uses").notNull().default(0),
  totalRewardsGiven: integer("total_rewards_given").notNull().default(0),
});

export const referralEventsTable = pgTable("referral_events", {
  id: serial("id").primaryKey(),
  referralCodeId: integer("referral_code_id").notNull().references(() => referralCodesTable.id, { onDelete: "cascade" }),
  referrerCustomerId: integer("referrer_customer_id").notNull().references(() => customersTable.id, { onDelete: "cascade" }),
  referredEmail: varchar("referred_email", { length: 255 }),
  referredCustomerId: integer("referred_customer_id").references(() => customersTable.id, { onDelete: "set null" }),
  status: varchar("status", { length: 30 }).notNull().default("pending"),
  referredAt: timestamp("referred_at").notNull().defaultNow(),
  registeredAt: timestamp("registered_at"),
  convertedAt: timestamp("converted_at"),
  rewardedAt: timestamp("rewarded_at"),
  rewardType: varchar("reward_type", { length: 30 }),
  referrerIp: varchar("referrer_ip", { length: 100 }),
  referredIp: varchar("referred_ip", { length: 100 }),
});

export type ReferralCode = typeof referralCodesTable.$inferSelect;
export type ReferralEvent = typeof referralEventsTable.$inferSelect;
