import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { assessmentsTable, answerEnum } from "./assessments";

export const assessmentAnswersTable = pgTable("assessment_answers", {
  id: serial("id").primaryKey(),
  assessmentId: integer("assessment_id").notNull().references(() => assessmentsTable.id),
  questionNumber: integer("question_number").notNull(),
  answer: answerEnum("answer").notNull(),
  score: integer("score").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAssessmentAnswerSchema = createInsertSchema(assessmentAnswersTable).omit({ id: true, createdAt: true });
export type InsertAssessmentAnswer = z.infer<typeof insertAssessmentAnswerSchema>;
export type AssessmentAnswer = typeof assessmentAnswersTable.$inferSelect;
