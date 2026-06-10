import { pgTable, serial, integer, varchar, timestamp, jsonb, text } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";

export const basSimulationsTable = pgTable("bas_simulations", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id, { onDelete: "cascade" }),
  domain: varchar("domain", { length: 255 }).notNull(),
  scanId: integer("scan_id"),
  status: varchar("status", { length: 20 }).notNull().default("queued"),
  selectedFindings: jsonb("selected_findings").$type<Array<{
    type: string;
    title: string;
    severity: string;
    detail: string;
  }>>(),
  reportJson: jsonb("report_json").$type<{
    summary: string;
    overallExploitability: "Yüksek" | "Orta" | "Düşük";
    scenarios: Array<{
      findingTitle: string;
      exploitable: boolean;
      probability: "Yüksek" | "Orta" | "Düşük";
      attackChain: string;
      impact: string;
      mitigation: string;
      priority: number;
    }>;
    attackNarrative: string;
    topRemediation: string[];
  }>(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  analysisStartedAt: timestamp("analysis_started_at"),
});

export type BasSimulation = typeof basSimulationsTable.$inferSelect;
