import { pgTable, serial, integer, varchar, boolean, timestamp, jsonb, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { customersTable } from "./customers";


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
  queryId:     integer("query_id"),
  description: varchar("description", { length: 500 }),
  createdAt:   timestamp("created_at").defaultNow(),
});

export type IocQueryCredit = typeof iocQueryCreditsTable.$inferSelect;
