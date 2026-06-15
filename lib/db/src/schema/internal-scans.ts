import {
  pgTable, serial, integer, varchar, jsonb, timestamp, boolean, date, text,
} from "drizzle-orm/pg-core";

export const internalScansTable = pgTable("internal_scans", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id"),
  scanType: varchar("scan_type", { length: 50 }),
  scanVersion: varchar("scan_version", { length: 20 }),
  hostname: varchar("hostname", { length: 200 }),
  internalScore: integer("internal_score"),
  scoreBreakdown: jsonb("score_breakdown").$type<Record<string, number>>(),
  rawData: jsonb("raw_data"),
  findingsCount: integer("findings_count"),
  scannedAt: timestamp("scanned_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type InternalScan = typeof internalScansTable.$inferSelect;
export type InsertInternalScan = typeof internalScansTable.$inferInsert;

export const internalScanSurveysTable = pgTable("internal_scan_surveys", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id"),
  // Yedekleme
  backupEnabled: boolean("backup_enabled"),
  backupFrequency: varchar("backup_frequency", { length: 50 }),
  backupOffsite: boolean("backup_offsite"),
  backupImmutable: boolean("backup_immutable"),
  backupLastTestDate: text("backup_last_test_date"),
  // Olay Müdahale
  irPlanExists: boolean("ir_plan_exists"),
  irPlanLastTest: text("ir_plan_last_test"),
  irTeamDefined: boolean("ir_team_defined"),
  // Güvenlik Eğitimi
  securityTrainingEnabled: boolean("security_training_enabled"),
  trainingFrequency: varchar("training_frequency", { length: 50 }),
  phishingSimulation: boolean("phishing_simulation"),
  // Uyumluluk
  cyberInsurance: boolean("cyber_insurance"),
  kvkkVerbisRegistered: boolean("kvkk_verbis_registered"),
  iso27001: boolean("iso_27001"),
  pciDss: boolean("pci_dss"),
  // Genel
  siemExists: boolean("siem_exists"),
  socExists: boolean("soc_exists"),
  socType: varchar("soc_type", { length: 20 }),
  // Metadata
  completedAt: timestamp("completed_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type InternalScanSurvey = typeof internalScanSurveysTable.$inferSelect;
export type InsertInternalScanSurvey = typeof internalScanSurveysTable.$inferInsert;

export const aiSecurityReportsTable = pgTable("ai_security_reports", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id"),
  internalScanId: integer("internal_scan_id"),
  executiveSummary: text("executive_summary"),
  criticalActions: jsonb("critical_actions"),
  mediumTermActions: jsonb("medium_term_actions"),
  longTermActions: jsonb("long_term_actions"),
  costEstimates: jsonb("cost_estimates"),
  benchmarkData: jsonb("benchmark_data"),
  fullResponse: jsonb("full_response"),
  modelUsed: varchar("model_used", { length: 50 }).default("claude-haiku-4-5-20251001"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  generatedAt: timestamp("generated_at").defaultNow(),
});

export type AiSecurityReport = typeof aiSecurityReportsTable.$inferSelect;
export type InsertAiSecurityReport = typeof aiSecurityReportsTable.$inferInsert;
