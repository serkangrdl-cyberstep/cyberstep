import { pgTable, serial, integer, varchar, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";

export const emailSequenceQueueTable = pgTable("email_sequence_queue", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customersTable.id),
  email: varchar("email", { length: 255 }).notNull(),
  sequenceType: varchar("sequence_type", { length: 50 }).notNull(),
  step: integer("step").notNull().default(1),
  sendAt: timestamp("send_at").notNull(),
  sentAt: timestamp("sent_at"),
  status: varchar("status", { length: 20 }).default("pending"),
  subject: text("subject"),
  templateKey: varchar("template_key", { length: 100 }),
  context: jsonb("context").default({}),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("idx_esq_pending").on(t.status, t.sendAt),
]);

export type EmailSequenceQueue = typeof emailSequenceQueueTable.$inferSelect;
