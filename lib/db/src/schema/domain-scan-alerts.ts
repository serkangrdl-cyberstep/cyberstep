import { pgTable, serial, integer, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";

export interface BlacklistAlertDetails {
  spamhaus: boolean;
  google_safebrowsing: boolean;
  surbl: boolean;
  mxtoolbox: boolean | null;  // null = API key yok, atlandı
  hit_count: number;
}

export const domainScanAlertsTable = pgTable("domain_scan_alerts", {
  id:        serial("id").primaryKey(),
  scanId:    integer("scan_id").notNull(),
  domain:    text("domain").notNull(),
  alertType: text("alert_type").notNull().default("blacklist"),
  severity:  text("severity").notNull().default("high"),
  title:     text("title").notNull(),
  details:   jsonb("details").$type<BlacklistAlertDetails>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  ackAt:     timestamp("ack_at"),
}, (t) => [
  index("domain_scan_alerts_scan_id_idx").on(t.scanId),
]);

export type DomainScanAlert = typeof domainScanAlertsTable.$inferSelect;
