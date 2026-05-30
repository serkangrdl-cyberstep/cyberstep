import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
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

export const insertTprmLinkSchema = createInsertSchema(tprmQuestionnaireLinkTable).omit({ id: true, createdAt: true });
export type InsertTprmLink = z.infer<typeof insertTprmLinkSchema>;
export type TprmLink = typeof tprmQuestionnaireLinkTable.$inferSelect;
export type TprmResponse = typeof tprmQuestionnaireResponseTable.$inferSelect;
