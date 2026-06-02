import {
  pgTable, bigserial, serial, varchar, text, boolean,
  integer, bigint, timestamp, index,
} from "drizzle-orm/pg-core";

export const certstreamQueueTable = pgTable("certstream_queue", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  rootDomain: varchar("root_domain", { length: 255 }).unique().notNull(),
  triggerSubdomain: varchar("trigger_subdomain", { length: 500 }),
  subdomainType: varchar("subdomain_type", { length: 50 }),
  corporateScore: integer("corporate_score"),
  certOrg: varchar("cert_org", { length: 500 }),
  certIssuer: varchar("cert_issuer", { length: 255 }),
  rawDomains: text("raw_domains").array(),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
  processed: boolean("processed").notNull().default(false),
  skippedReason: varchar("skipped_reason", { length: 50 }),
}, (t) => [
  index("idx_certstream_queue_processed").on(t.processed),
  index("idx_certstream_queue_score").on(t.corporateScore),
]);

export const certstreamStatusTable = pgTable("certstream_status", {
  id: serial("id").primaryKey(),
  status: varchar("status", { length: 20 }).notNull().default("stopped"),
  startedAt: timestamp("started_at"),
  lastCertAt: timestamp("last_cert_at"),
  totalReceived: bigint("total_received", { mode: "number" }).notNull().default(0),
  totalTrFound: integer("total_tr_found").notNull().default(0),
  totalQualified: integer("total_qualified").notNull().default(0),
  errorMessage: text("error_message"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type CertstreamQueue = typeof certstreamQueueTable.$inferSelect;
export type CertstreamStatus = typeof certstreamStatusTable.$inferSelect;
