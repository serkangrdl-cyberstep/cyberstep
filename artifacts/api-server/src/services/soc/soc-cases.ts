/**
 * SOC case helpers: case-number generation, CRUD, activity logging, SLA lookup,
 * whitelist + block/IOC checks used by the triage engine.
 */

import {
  db,
  socCasesTable,
  socActivityLogTable,
  socSlaConfigTable,
  socIpWhitelistTable,
  fortimanagerBlockActionsTable,
  customersTable,
  socCasesTable as _socCasesTable,
  type SocCase,
  type SocSlaConfig,
} from "@workspace/db";
import { eq, and, desc, gte, sql, inArray } from "drizzle-orm";
import { logger } from "../../lib/logger";

type InsertSocCaseRow = typeof _socCasesTable.$inferInsert;

// ─── Case number ──────────────────────────────────────────────────────────────

export async function generateCaseNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CS-SOC-${year}-`;
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(socCasesTable)
    .where(sql`${socCasesTable.caseNumber} like ${prefix + "%"}`);
  const next = Number(row?.count ?? 0) + 1;
  return `${prefix}${String(next).padStart(5, "0")}`;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createCase(values: InsertSocCaseRow): Promise<SocCase | null> {
  const [row] = await db.insert(socCasesTable).values(values).returning();
  return row ?? null;
}

/**
 * Insert a case while generating its case number, retrying on the unique
 * constraint so concurrent triage runs can't collide on the same number.
 * Pass `values` WITHOUT `caseNumber`; it is generated here.
 */
export async function createCaseWithNumber(
  values: Omit<InsertSocCaseRow, "caseNumber">,
): Promise<SocCase | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const caseNumber = await generateCaseNumber();
    try {
      const [row] = await db
        .insert(socCasesTable)
        .values({ ...values, caseNumber })
        .returning();
      return row ?? null;
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === "23505") {
        logger.warn({ caseNumber, attempt }, "Case number collision, retrying");
        continue;
      }
      throw err;
    }
  }
  logger.error("Failed to generate a unique case number after 5 attempts");
  return null;
}

export async function getCase(id: number): Promise<SocCase | null> {
  const [row] = await db.select().from(socCasesTable).where(eq(socCasesTable.id, id));
  return row ?? null;
}

export async function updateCase(id: number, patch: Partial<InsertSocCaseRow>): Promise<SocCase | null> {
  const [row] = await db
    .update(socCasesTable)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(socCasesTable.id, id))
    .returning();
  return row ?? null;
}

// ─── Activity log ─────────────────────────────────────────────────────────────

export async function logSOCActivity(params: {
  caseId: number;
  actorType?: "system" | "ai" | "analyst" | "customer";
  actorName?: string | null;
  actionType: string;
  description?: string | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(socActivityLogTable).values({
      caseId: params.caseId,
      actorType: params.actorType ?? "system",
      actorName: params.actorName ?? null,
      actionType: params.actionType,
      description: params.description ?? null,
      details: params.details ?? {},
    });
  } catch (err) {
    logger.warn({ err, caseId: params.caseId }, "Failed to log SOC activity");
  }
}

export async function getCaseActivity(caseId: number) {
  return db
    .select()
    .from(socActivityLogTable)
    .where(eq(socActivityLogTable.caseId, caseId))
    .orderBy(desc(socActivityLogTable.createdAt));
}

// ─── SLA ──────────────────────────────────────────────────────────────────────

export async function getSLAConfig(
  tier: string,
  severity: string,
): Promise<SocSlaConfig | null> {
  const [row] = await db
    .select()
    .from(socSlaConfigTable)
    .where(and(eq(socSlaConfigTable.tier, tier as SocSlaConfig["tier"]), eq(socSlaConfigTable.severity, severity as SocSlaConfig["severity"])));
  return row ?? null;
}

// ─── Whitelist / block / IOC checks (triage tier-0 inputs) ────────────────────

export async function getCustomerWhitelist(customerId: number): Promise<string[]> {
  const rows = await db
    .select({ ip: socIpWhitelistTable.ip })
    .from(socIpWhitelistTable)
    .where(eq(socIpWhitelistTable.customerId, customerId));
  return rows.map((r) => r.ip);
}

export async function checkIPAlreadyBlocked(customerId: number, ip: string): Promise<boolean> {
  if (!ip) return false;
  const [row] = await db
    .select({ id: fortimanagerBlockActionsTable.id })
    .from(fortimanagerBlockActionsTable)
    .where(
      and(
        eq(fortimanagerBlockActionsTable.customerId, customerId),
        eq(fortimanagerBlockActionsTable.ip, ip),
        inArray(fortimanagerBlockActionsTable.status, ["success", "verified"]),
      ),
    )
    .limit(1);
  return !!row;
}

/**
 * Look up an IP in a local threat-intel/IOC registry.
 * No standalone IOC registry exists in this codebase yet, so this returns null
 * (unknown). Wire a real feed here later without touching the triage engine.
 */
export async function checkIOCRegistry(_ip: string): Promise<{ severity: string; description: string } | null> {
  return null;
}

// ─── Stats helpers (dashboards + reports) ─────────────────────────────────────

export async function getCustomerEmail(customerId: number): Promise<string | null> {
  const [c] = await db
    .select({ email: customersTable.email })
    .from(customersTable)
    .where(eq(customersTable.id, customerId));
  return c?.email ?? null;
}

export async function getCasesSince(customerId: number | null, since: Date): Promise<SocCase[]> {
  const where = customerId == null
    ? gte(socCasesTable.createdAt, since)
    : and(eq(socCasesTable.customerId, customerId), gte(socCasesTable.createdAt, since));
  return db.select().from(socCasesTable).where(where).orderBy(desc(socCasesTable.createdAt));
}

export interface CaseStats {
  total: number;
  open: number;
  resolved: number;
  closed: number;
  critical: number;
  high: number;
  slaBreached: number;
}

export function summarizeCases(cases: SocCase[]): CaseStats {
  return {
    total: cases.length,
    open: cases.filter((c) => c.status === "open" || c.status === "investigating").length,
    resolved: cases.filter((c) => c.status === "resolved").length,
    closed: cases.filter((c) => c.status === "closed" || c.status === "false_positive").length,
    critical: cases.filter((c) => c.severity === "critical").length,
    high: cases.filter((c) => c.severity === "high").length,
    slaBreached: cases.filter((c) => c.slaBreached).length,
  };
}
