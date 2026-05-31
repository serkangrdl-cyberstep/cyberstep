import { pgTable, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const servicePricesTable = pgTable("service_prices", {
  slug: text("slug").primaryKey(),
  label: text("label").notNull(),
  amountTl: numeric("amount_tl", { precision: 10, scale: 2 }).notNull(),
  unit: text("unit").notNull().default("tek seferlik"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ServicePrice = typeof servicePricesTable.$inferSelect;
export const insertServicePriceSchema = createInsertSchema(servicePricesTable);
export type InsertServicePrice = z.infer<typeof insertServicePriceSchema>;
