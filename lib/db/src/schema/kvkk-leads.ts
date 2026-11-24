import { pgTable, serial, integer, text, boolean, timestamp, jsonb, date } from "drizzle-orm/pg-core";

/** KVKK veri ihlali kamuoyu duyuruları (kvkk.gov.tr) ve tedarikçi bağlantılı olanlardan türeyen satış lead'leri. */
export const kvkkBreachNoticesTable = pgTable("kvkk_breach_notices", {
  id: serial("id").primaryKey(),
  noticeId: integer("notice_id").notNull().unique(),
  url: text("url").notNull(),
  companyName: text("company_name").notNull(),
  publishedAt: date("published_at"),
  decisionNo: text("decision_no"),
  affectedCount: integer("affected_count"),
  summary: text("summary").notNull().default(""),
  supplierLinked: boolean("supplier_linked").notNull().default(false),
  supplierSignals: jsonb("supplier_signals").$type<string[]>(),
  isLead: boolean("is_lead").notNull().default(false),
  status: text("status").notNull().default("new"), // new | contacted | interested | closed | not_fit
  salesScript: jsonb("sales_script").$type<SalesScript>(),
  notes: text("notes"),
  contactedAt: timestamp("contacted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export interface SalesScript {
  opening: string;
  talkingPoints: string[];
  objections: { objection: string; answer: string }[];
  emailDraft: string;
  doNot: string[];
}
