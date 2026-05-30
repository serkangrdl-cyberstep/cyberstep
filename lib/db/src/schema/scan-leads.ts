import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const scanLeadsTable = pgTable("scan_leads", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  domain: text("domain").notNull(),
  scanId: integer("scan_id"),
  overallScore: integer("overall_score"),
  sequenceStep: integer("sequence_step").notNull().default(0),
  nextSendAt: timestamp("next_send_at", { withTimezone: true }),
  lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
  unsubscribed: boolean("unsubscribed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ScanLead = typeof scanLeadsTable.$inferSelect;
