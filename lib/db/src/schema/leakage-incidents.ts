import {
  pgTable, serial, integer, varchar, date,
  text, boolean, jsonb, timestamp, index,
  unique,
} from "drizzle-orm/pg-core";

export const leakageIncidentsTable = pgTable(
  "leakage_incidents",
  {
    id:                 serial("id").primaryKey(),
    customerId:         integer("customer_id"),
    customerDomain:     varchar("customer_domain", { length: 255 }).notNull(),
    breachSource:       varchar("breach_source",   { length: 255 }).notNull(),
    breachDate:         date("breach_date"),
    affectedEmailCount: integer("affected_email_count").default(0),
    affectedEmails:     text("affected_emails").array(),
    dataTypes:          text("data_types").array(),
    severity:           varchar("severity", { length: 20 }).notNull().default("medium"),
    isNew:              boolean("is_new").default(true),
    sourceApi:          varchar("source_api", { length: 50 }).notNull(),
    rawResponse:        jsonb("raw_response"),
    firstDetected:      timestamp("first_detected").defaultNow(),
    lastVerified:       timestamp("last_verified").defaultNow(),
  },
  (t) => [
    unique("leakage_incidents_unique").on(t.customerId, t.breachSource, t.sourceApi),
    index("idx_leakage_customer").on(t.customerId),
    index("idx_leakage_severity").on(t.severity),
    index("idx_leakage_is_new").on(t.isNew),
  ],
);

export const leakageScanLogTable = pgTable("leakage_scan_log", {
  id:           serial("id").primaryKey(),
  customerId:   integer("customer_id"),
  scannedAt:    timestamp("scanned_at").defaultNow(),
  apiUsed:      varchar("api_used", { length: 50 }),
  breachesFound: integer("breaches_found").default(0),
  newBreaches:   integer("new_breaches").default(0),
  errorMessage:  text("error_message"),
  durationMs:    integer("duration_ms"),
});
