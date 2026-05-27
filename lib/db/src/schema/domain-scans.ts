import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const domainScansTable = pgTable("domain_scans", {
  id: serial("id").primaryKey(),
  domain: text("domain").notNull(),
  email: text("email"),
  spfPass: boolean("spf_pass").notNull().default(false),
  spfRecord: text("spf_record"),
  dmarcPass: boolean("dmarc_pass").notNull().default(false),
  dmarcRecord: text("dmarc_record"),
  dkimPass: boolean("dkim_pass").notNull().default(false),
  dkimSelectors: jsonb("dkim_selectors").$type<string[]>().notNull().default([]),
  mxPass: boolean("mx_pass").notNull().default(false),
  mxRecords: jsonb("mx_records").$type<Array<{ exchange: string; priority: number }>>().notNull().default([]),
  sslPass: boolean("ssl_pass").notNull().default(false),
  sslExpiry: text("ssl_expiry"),
  sslIssuer: text("ssl_issuer"),
  sslDaysUntilExpiry: integer("ssl_days_until_expiry"),
  overallScore: integer("overall_score").notNull().default(0),
  hibpBreachCount: integer("hibp_breach_count").notNull().default(0),
  hibpBreaches: jsonb("hibp_breaches").$type<Array<{ name: string; breachDate: string; pwnCount: number; dataClasses: string[] }>>().notNull().default([]),
  blacklisted: boolean("blacklisted").notNull().default(false),
  blacklistCount: integer("blacklist_count").notNull().default(0),
  blacklistResults: jsonb("blacklist_results").$type<Array<{ list: string; listed: boolean }>>().notNull().default([]),
  shadowItServices: jsonb("shadow_it_services").$type<Array<{ name: string; category: string; risk: string; description: string; version?: string }>>().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  notifiedAt: timestamp("notified_at"),
});

export const insertDomainScanSchema = createInsertSchema(domainScansTable).omit({ id: true, createdAt: true });
export type InsertDomainScan = z.infer<typeof insertDomainScanSchema>;
export type DomainScan = typeof domainScansTable.$inferSelect;
