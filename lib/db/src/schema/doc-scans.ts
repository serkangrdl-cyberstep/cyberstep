import { pgTable, serial, text, integer, boolean, timestamp, jsonb, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const documentScansTable = pgTable("document_scans", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id"),

  filename: text("filename"),
  fileType: text("file_type"),
  fileSizeKb: integer("file_size_kb"),
  fileHash: text("file_hash"),

  aiGenerationProbability: decimal("ai_generation_probability", { precision: 5, scale: 2 }),
  manipulationProbability: decimal("manipulation_probability", { precision: 5, scale: 2 }),

  metadataAnomalies: jsonb("metadata_anomalies"),
  fontInconsistencies: boolean("font_inconsistencies"),
  imageArtifacts: boolean("image_artifacts"),
  textAiProbability: decimal("text_ai_probability", { precision: 5, scale: 2 }),

  verdict: text("verdict"),
  confidence: integer("confidence"),
  riskFactors: text("risk_factors").array(),

  analysisSummary: text("analysis_summary"),

  paymentType: text("payment_type").default("single"),
  priceTl: integer("price_tl").default(49),

  scannedAt: timestamp("scanned_at").defaultNow(),
});

export const insertDocumentScanSchema = createInsertSchema(documentScansTable).omit({
  id: true,
  scannedAt: true,
});

export type DocumentScan = typeof documentScansTable.$inferSelect;
export type InsertDocumentScan = z.infer<typeof insertDocumentScanSchema>;
