import { pgTable, serial, integer, varchar, boolean, timestamp, jsonb, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { customersTable } from "./customers";

export const pendingApprovalsTable = pgTable("pending_approvals", {
  id:              serial("id").primaryKey(),
  actionType:      varchar("action_type", { length: 50 }).notNull(),
  title:           varchar("title", { length: 255 }).notNull(),
  description:     text("description"),
  riskLevel:       varchar("risk_level", { length: 20 }).default("medium"),
  payload:         jsonb("payload").notNull(),
  customerId:      integer("customer_id").references(() => customersTable.id),
  relatedId:       integer("related_id"),
  expiresAt:       timestamp("expires_at").notNull(),
  onExpire:        varchar("on_expire", { length: 20 }).default("auto_reject"),
  status:          varchar("status", { length: 20 }).default("pending"),
  approvedBy:      varchar("approved_by", { length: 100 }),
  approvedAt:      timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  executed:        boolean("executed").default(false),
  executedAt:      timestamp("executed_at"),
  executionResult: jsonb("execution_result"),
  createdAt:       timestamp("created_at").defaultNow(),
});

export const approvalAuditLogTable = pgTable("approval_audit_log", {
  id:          serial("id").primaryKey(),
  approvalId:  integer("approval_id").references(() => pendingApprovalsTable.id),
  action:      varchar("action", { length: 30 }),
  performedBy: varchar("performed_by", { length: 100 }),
  notes:       text("notes"),
  createdAt:   timestamp("created_at").defaultNow(),
});

export type PendingApproval = typeof pendingApprovalsTable.$inferSelect;
export type ApprovalAuditLog = typeof approvalAuditLogTable.$inferSelect;
export const insertPendingApprovalSchema = createInsertSchema(pendingApprovalsTable).omit({ id: true, createdAt: true });
