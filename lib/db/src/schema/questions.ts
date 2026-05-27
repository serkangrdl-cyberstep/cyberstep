import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const questionsTable = pgTable("questions", {
  id: serial("id").primaryKey(),
  number: integer("number").notNull(),
  type: text("type").notNull().default("mini"),
  domain: text("domain").notNull(),
  text: text("text").notNull(),
  weight: integer("weight").notNull().default(1),
  isRedAlarm: boolean("is_red_alarm").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertQuestionSchema = createInsertSchema(questionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Question = typeof questionsTable.$inferSelect;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
