import { pgTable, serial, integer, text, boolean, timestamp, jsonb, unique } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";

export const ctCertificateEventsTable = pgTable(
  "ct_certificate_events",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id").notNull().references(() => customersTable.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    certDomain: text("cert_domain").notNull(),
    issuer: text("issuer"),
    sans: jsonb("sans").$type<string[]>().default([]),
    notBefore: timestamp("not_before"),
    notAfter: timestamp("not_after"),
    certFingerprint: text("cert_fingerprint"),
    detectedAt: timestamp("detected_at").defaultNow().notNull(),
    isSuspicious: boolean("is_suspicious").default(false).notNull(),
  },
  (t) => [unique("ct_cert_fingerprint_domain_uq").on(t.certFingerprint, t.domain)],
);

export type CtCertificateEvent = typeof ctCertificateEventsTable.$inferSelect;
export type InsertCtCertificateEvent = typeof ctCertificateEventsTable.$inferInsert;
