import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";

export const domainScanPurchasesTable = pgTable("domain_scan_purchases", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  domain: text("domain"),
  scanId: integer("scan_id"),
  status: text("status").notNull().default("pending"),
  amountTry: integer("amount_try").notNull().default(99000),
  paymentRef: text("payment_ref"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  paidAt: timestamp("paid_at"),
});

export type DomainScanPurchase = typeof domainScanPurchasesTable.$inferSelect;
export type InsertDomainScanPurchase = typeof domainScanPurchasesTable.$inferInsert;
