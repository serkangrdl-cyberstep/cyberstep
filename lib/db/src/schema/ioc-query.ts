import { pgTable, serial, integer, varchar, boolean, timestamp, jsonb, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { customersTable } from "./customers";

export const iocQueriesTable = pgTable("ioc_queries", {
  id:              serial("id").primaryKey(),
  customerId:      integer("customer_id").references(() => customersTable.id),
  queryType:       varchar("query_type", { length: 20 }).notNull(),
  queryValue:      varchar("query_value", { length: 500 }).notNull(),
  shodanResult:        jsonb("shodan_result"),
  virustotalResult:    jsonb("virustotal_result"),
  abuseipdbResult:     jsonb("abuseipdb_result"),
  greynoiseResult:     jsonb("greynoise_result"),
  threatfoxResult:     jsonb("threatfox_result"),
  urlhausResult:       jsonb("urlhaus_result"),
  malwarebazaarResult: jsonb("malwarebazaar_result"),
  whoisResult:         jsonb("whois_result"),
  feodoResult:         jsonb("feodo_result"),
  threatLevel:         varchar("threat_level", { length: 20 }),
  threatScore:         integer("threat_score"),
  aiSummary:           varchar("ai_summary", { length: 5000 }),
  aiRecommendations:   jsonb("ai_recommendations"),
  indicators:          jsonb("indicators"),
  creditsUsed:         integer("credits_used").default(1),
  cacheHit:            boolean("cache_hit").default(false),
  status:              varchar("status", { length: 20 }).default("pending"),
  errorMessage:        varchar("error_message", { length: 2000 }),
  processingTimeMs:    integer("processing_time_ms"),
  createdAt:           timestamp("created_at").defaultNow(),
  completedAt:         timestamp("completed_at"),
});

export const iocQueryCreditsTable = pgTable("ioc_query_credits", {
  id:               serial("id").primaryKey(),
  customerId:       integer("customer_id").references(() => customersTable.id).unique(),
  creditsTotal:     integer("credits_total").default(10),
  creditsUsed:      integer("credits_used").default(0),
  creditsPurchased: integer("credits_purchased").default(0),
  resetDate:        date("reset_date"),
  updatedAt:        timestamp("updated_at").defaultNow(),
});

export const iocCreditTransactionsTable = pgTable("ioc_credit_transactions", {
  id:          serial("id").primaryKey(),
  customerId:  integer("customer_id").references(() => customersTable.id),
  amount:      integer("amount").notNull(),
  type:        varchar("type", { length: 30 }),
  queryId:     integer("query_id").references(() => iocQueriesTable.id),
  description: varchar("description", { length: 500 }),
  createdAt:   timestamp("created_at").defaultNow(),
});

export type IocQuery = typeof iocQueriesTable.$inferSelect;
export type IocQueryCredit = typeof iocQueryCreditsTable.$inferSelect;
export const insertIocQuerySchema = createInsertSchema(iocQueriesTable).omit({ id: true, createdAt: true });
