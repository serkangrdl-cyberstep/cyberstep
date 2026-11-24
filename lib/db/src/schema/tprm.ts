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
  // initial: ilk anket · reassess: düzeltme sonrası yeniden değerlendirme talebi
  kind: text("kind").notNull().default("initial"),
  vendorId: integer("vendor_id"),
});

// Tedarikçinin doldurduğu anket yanıtları
export const tprmQuestionnaireResponseTable = pgTable("tprm_questionnaire_responses", {
  id: serial("id").primaryKey(),
  linkId: integer("link_id").notNull().references(() => tprmQuestionnaireLinkTable.id),
  supplierContactName: text("supplier_contact_name").notNull(),
  supplierContactEmail: text("supplier_contact_email").notNull(),
  answers: jsonb("answers").notNull(),     // [{questionId, answer, score}]
  selfScore: integer("self_score").notNull(),
  // Tedarikçinin beyan ettiği alt hizmet sağlayıcılar (doğrulanmamış)
  subprocessors: jsonb("subprocessors"),
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
  // Tedarikçinin iş süreçleri için önemi: kritik | onemli | standart
  criticality: text("criticality").notNull().default("standart"),
  // Ön sınıflandırma: veri/siber/operasyon/uyum/yapay zekâ/dördüncü taraf (bool)
  riskDomains: jsonb("risk_domains"),
  // Cross-sell
  crosssellSentAt: timestamp("crosssell_sent_at"),
  // Uyarı
  alertSentAt: timestamp("alert_sent_at"),
  // Tarama aktif mi
  monitoringActive: boolean("monitoring_active").notNull().default(true),
  addedAt: timestamp("added_at").notNull().defaultNow(),
  // Tedarikçi iletişim e-postası (anketten) ve düzeltme/yeniden değerlendirme döngüsü
  supplierContactEmail: text("supplier_contact_email"),
  remediationStatus: text("remediation_status").notNull().default("none"), // none | requested | rescanned
  remediationRequestedAt: timestamp("remediation_requested_at"),
  remediationDoneAt: timestamp("remediation_done_at"),
  scoreBeforeRemediation: integer("score_before_remediation"),
  // Müşterinin kendi alan adı (tedarikçi limitine sayılmaz, tedarikçi raporlarına girmez)
  isOwn: boolean("is_own").notNull().default(false),
  // Yıllık doğrulama (Siber Dayanıklılık Yönetmeliği taslağı Md. 69/5 ile uyumlu takip): müşteri kendi kanıtına dayanarak işaretler
  lastVerifiedAt: timestamp("last_verified_at"),
  verificationNote: text("verification_note"),
  verifyRemindedAt: timestamp("verify_reminded_at"),
});

// Tedarikçi olay geçmişi (yönetim raporu ve zaman çizelgesi için)
export const tprmVendorEventTable = pgTable("tprm_vendor_events", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendor_id").notNull(),
  kind: text("kind").notNull(), // questionnaire_completed | report_sent | reassess_requested | rescan_done
  detail: jsonb("detail"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTprmLinkSchema = createInsertSchema(tprmQuestionnaireLinkTable).omit({ id: true, createdAt: true });
export type InsertTprmLink = z.infer<typeof insertTprmLinkSchema>;
export type TprmLink = typeof tprmQuestionnaireLinkTable.$inferSelect;
export type TprmResponse = typeof tprmQuestionnaireResponseTable.$inferSelect;
export type TprmVendor = typeof tprmVendorTable.$inferSelect;
