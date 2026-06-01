import { pgTable, serial, varchar, integer, text, timestamp } from "drizzle-orm/pg-core";

export const cronJobMetricsTable = pgTable("cron_job_metrics", {
  id: serial("id").primaryKey(),
  jobName: varchar("job_name", { length: 100 }).notNull().unique(),
  lastRunAt: timestamp("last_run_at"),
  lastDurationMs: integer("last_duration_ms"),
  lastStatus: varchar("last_status", { length: 20 }).default("ok"),
  lastError: text("last_error"),
  runCount: integer("run_count").default(0),
  errorCount: integer("error_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type CronJobMetric = typeof cronJobMetricsTable.$inferSelect;
