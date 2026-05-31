import { pgTable, serial, integer, text, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";

export interface AttackPathStage {
  stage: string;
  mitre_technique: string;
  technique_name: string;
  finding_used: string;
  description: string;
  finding_type?: string;
}

export const attackPathsTable = pgTable("attack_paths", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  scanId: integer("scan_id"),
  pathName: varchar("path_name", { length: 255 }),
  severity: varchar("severity", { length: 20 }),
  confidence: integer("confidence"),
  stages: jsonb("stages").$type<AttackPathStage[]>().notNull(),
  estimatedDamageTl: integer("estimated_damage_tl"),
  mermaidDiagram: text("mermaid_diagram"),
  narrative: text("narrative"),
  singleFixRecommendation: text("single_fix_recommendation"),
  status: varchar("status", { length: 20 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type AttackPath = typeof attackPathsTable.$inferSelect;
export type InsertAttackPath = typeof attackPathsTable.$inferInsert;
