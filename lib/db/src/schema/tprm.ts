import { pgTable, text, serial, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Tedarikçiye gönderilen anket linki
export const tprmQuestionnaireLinkTable = pgTable("tprm_questionnaire_links", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull(),
  companySector: text("company_sector").notNull(),
  supplierDomain: text("supplier_domain").notNull(),
  supplierName: text("supplier_name"),
  token: text("token").notNull().unique(),
  scanScore: integer("scan_score"),        // from domain scan
  scanData: jsonb("scan_data"),            // raw scan result
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Tedarikçinin doldurduğu anket yanıtları
export const tprmQuestionnaireResponseTable = pgTable("tprm_questionnaire_responses", {
  id: serial("id").primaryKey(),
  linkId: integer("link_id").notNull().references(() => tprmQuestionnaireLinkTable.id),
  supplierContactName: text("supplier_contact_name").notNull(),
  supplierContactEmail: text("supplier_contact_email").notNull(),
  answers: jsonb("answers").notNull(),     // [{questionId, answer, score}]
  selfScore: integer("self_score").notNull(),
  combinedScore: integer("combined_score"), // weighted avg of scan + self
  completedAt: timestamp("completed_at").notNull().defaultNow(),
});

// Kalıcı tedarikçi kaydı — sürekli izleme için
export const tprmVendorTable = pgTable("tprm_vendors", {
  id: serial("id").primaryKey(),
  customerEmail: text("customer_email").notNull(),
  supplierDomain: text("supplier_domain").notNull(),
  supplierName: text("supplier_name"),
  // Son tarama
  lastScanScore: integer("last_scan_score"),
  prevScanScore: integer("prev_scan_score"),  // bir önceki skor (trend için)
  lastScanAt: timestamp("last_scan_at"),
  lastScanData: jsonb("last_scan_data"),
  // Anket durumu
  questionnaireStatus: text("questionnaire_status").notNull().default("none"), // none | pending | completed
  questionnaireToken: text("questionnaire_token"),
  combinedScore: integer("combined_score"),
  riskLevel: text("risk_level"),              // Düşük | Orta | Yüksek
  // Cross-sell
  crosssellSentAt: timestamp("crosssell_sent_at"),
  // Uyarı
  alertSentAt: timestamp("alert_sent_at"),
  // Tarama aktif mi
  monitoringActive: boolean("monitoring_active").notNull().default(true),
  addedAt: timestamp("added_at").notNull().defaultNow(),
});

export const insertTprmLinkSchema = createInsertSchema(tprmQuestionnaireLinkTable).omit({ id: true, createdAt: true });
export type InsertTprmLink = z.infer<typeof insertTprmLinkSchema>;
export type TprmLink = typeof tprmQuestionnaireLinkTable.$inferSelect;
export type TprmResponse = typeof tprmQuestionnaireResponseTable.$inferSelect;
export type TprmVendor = typeof tprmVendorTable.$inferSelect;
