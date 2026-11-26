import { pgTable, serial, varchar, text, integer, boolean, timestamp, jsonb, date, decimal } from "drizzle-orm/pg-core";

// ─── Growth Trigger Log ───────────────────────────────────────────────────────

// ─── Competitor Checks ────────────────────────────────────────────────────────

// ─── Benchmark Downloads ──────────────────────────────────────────────────────
export const benchmarkDownloadsTable = pgTable("benchmark_downloads", {
  id: serial("id").primaryKey(),
  sector: varchar("sector", { length: 100 }).notNull(),
  reportPeriod: varchar("report_period", { length: 20 }),
  visitorName: varchar("visitor_name", { length: 255 }),
  visitorEmail: varchar("visitor_email", { length: 255 }).notNull(),
  visitorCompany: varchar("visitor_company", { length: 255 }),
  visitorDomain: varchar("visitor_domain", { length: 255 }),
  leadCreated: boolean("lead_created").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type BenchmarkDownload = typeof benchmarkDownloadsTable.$inferSelect;

// ─── Sector Newsletter Subscribers ───────────────────────────────────────────

// ─── EKAP Tenders ─────────────────────────────────────────────────────────────

// ─── New Companies Registry (MERSİS) ─────────────────────────────────────────

// ─── Growth Engine Settings ───────────────────────────────────────────────────
