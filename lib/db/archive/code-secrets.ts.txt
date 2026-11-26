import { pgTable, serial, integer, varchar, timestamp, boolean } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";

export const codeSecretsFindingsTable = pgTable("code_secrets_findings", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  platform: varchar("platform", { length: 20 }).notNull(),
  repoUrl: varchar("repo_url", { length: 500 }).notNull(),
  repoName: varchar("repo_name", { length: 255 }),
  repoVisibility: varchar("repo_visibility", { length: 20 }),
  filePath: varchar("file_path", { length: 500 }),
  commitHash: varchar("commit_hash", { length: 64 }),
  lineNumber: integer("line_number"),
  secretType: varchar("secret_type", { length: 100 }),
  secretPreview: varchar("secret_preview", { length: 50 }),
  severity: varchar("severity", { length: 20 }).default("high"),
  isVerified: boolean("is_verified").default(false),
  isRevoked: boolean("is_revoked").default(false),
  discoveredAt: timestamp("discovered_at").defaultNow(),
});

export type CodeSecretsFinding = typeof codeSecretsFindingsTable.$inferSelect;
export type InsertCodeSecretsFinding = typeof codeSecretsFindingsTable.$inferInsert;
