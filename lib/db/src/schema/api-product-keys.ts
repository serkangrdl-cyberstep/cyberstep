import { pgTable, serial, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const apiProductKeysTable = pgTable("api_product_keys", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  email: text("email").notNull(),
  company: text("company").notNull(),
  tier: text("tier").notNull().default("freemium"), // freemium | standard | enterprise
  dailyLimit: integer("daily_limit").notNull().default(10),
  monthlyLimit: integer("monthly_limit").notNull().default(10),
  usageToday: integer("usage_today").notNull().default(0),
  usageMonth: integer("usage_month").notNull().default(0),
  usageResetDate: timestamp("usage_reset_date", { withTimezone: true }).notNull().defaultNow(),
  webhookUrl: text("webhook_url"),
  active: boolean("active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});

export const apiProductUsageTable = pgTable("api_product_usage", {
  id: serial("id").primaryKey(),
  apiKeyId: integer("api_key_id").notNull().references(() => apiProductKeysTable.id),
  endpoint: text("endpoint").notNull(),
  domain: text("domain"),
  sector: text("sector"),
  statusCode: integer("status_code").notNull().default(200),
  responseMs: integer("response_ms"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("api_usage_key_id_idx").on(t.apiKeyId),
  index("api_usage_created_at_idx").on(t.createdAt),
]);

export const insertApiProductKeySchema = createInsertSchema(apiProductKeysTable).omit({ id: true, createdAt: true, lastUsedAt: true, usageToday: true, usageMonth: true });
export type InsertApiProductKey = z.infer<typeof insertApiProductKeySchema>;
export type ApiProductKey = typeof apiProductKeysTable.$inferSelect;
