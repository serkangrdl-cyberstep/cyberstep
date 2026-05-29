import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const workPackagesTable = pgTable("work_packages", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id"),
  assessmentId: integer("assessment_id"),
  domainScanId: integer("domain_scan_id"),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  priority: text("priority").notNull().default("medium"),
  estimatedCost: integer("estimated_cost"),
  commissionRate: integer("commission_rate").default(15),
  status: text("status").notNull().default("open"),
  partnerId: integer("partner_id"),
  assignedAt: timestamp("assigned_at"),
  completedAt: timestamp("completed_at"),
  verifiedAt: timestamp("verified_at"),
  completionNote: text("completion_note"),
  scoreBefore: integer("score_before"),
  scoreAfter: integer("score_after"),
  companyName: text("company_name"),
  domain: text("domain"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertWorkPackageSchema = createInsertSchema(workPackagesTable).omit({ id: true, createdAt: true });
export type InsertWorkPackage = z.infer<typeof insertWorkPackageSchema>;
export type WorkPackage = typeof workPackagesTable.$inferSelect;
