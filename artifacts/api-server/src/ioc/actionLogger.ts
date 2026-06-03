import { db } from "@workspace/db";
import { iocActionLogTable, systemSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

export async function logIOCAction(params: {
  customerId: number;
  iocValue: string;
  iocType: string;
  iocId?: number;
  action: string;
  confidenceScore?: number;
  sources?: string[];
  skipReason?: string;
  performedBy?: string;
  fortinetResponse?: object;
}): Promise<void> {
  await db.insert(iocActionLogTable).values({
    customerId: params.customerId,
    iocValue: params.iocValue,
    iocType: params.iocType,
    iocId: params.iocId,
    action: params.action,
    confidenceScore: params.confidenceScore,
    sources: params.sources ?? [],
    skipReason: params.skipReason,
    performedBy: params.performedBy ?? "auto",
    fortinetResponse: params.fortinetResponse,
  });
}

export async function getSystemSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(systemSettingsTable);
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

export async function isKillSwitchActive(): Promise<boolean> {
  const [row] = await db
    .select()
    .from(systemSettingsTable)
    .where(eq(systemSettingsTable.key, "kill_switch_active"))
    .limit(1);
  return row?.value === "true";
}

export async function activateKillSwitch(reason: string, activatedBy: string): Promise<void> {
  await db
    .update(systemSettingsTable)
    .set({ value: "true", updatedBy: activatedBy, updatedAt: new Date() })
    .where(eq(systemSettingsTable.key, "kill_switch_active"));

  await db
    .update(iocActionLogTable)
    .set({ action: "skipped_disabled", skipReason: `kill_switch: ${reason}` })
    .where(eq(iocActionLogTable.action, "block_queued"));

  logger.warn({ reason, activatedBy }, "IOC kill switch activated");
}

export async function deactivateKillSwitch(deactivatedBy: string): Promise<void> {
  await db
    .update(systemSettingsTable)
    .set({ value: "false", updatedBy: deactivatedBy, updatedAt: new Date() })
    .where(eq(systemSettingsTable.key, "kill_switch_active"));

  logger.info({ deactivatedBy }, "IOC kill switch deactivated");
}
