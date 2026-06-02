/**
 * Processes certstream_queue entries into lead_candidates.
 * Run hourly by cron.
 */
import { db } from "@workspace/db";
import { certstreamQueueTable, leadCandidatesTable, certstreamStatusTable } from "@workspace/db";
import { eq, desc, asc, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { forceFlushCertstreamBuffer } from "./certstreamLeadFilter";

export interface ProcessResult {
  processed: number;
  added: number;
  skipped: number;
}

export async function processCertstreamQueue(batchSize: number = 100): Promise<ProcessResult> {
  // Flush in-memory buffer first
  await forceFlushCertstreamBuffer();

  const queued = await db.select().from(certstreamQueueTable)
    .where(eq(certstreamQueueTable.processed, false))
    .orderBy(
      desc(certstreamQueueTable.corporateScore),
      asc(certstreamQueueTable.receivedAt),
    )
    .limit(batchSize);

  if (queued.length === 0) return { processed: 0, added: 0, skipped: 0 };

  let added = 0;
  let skipped = 0;

  for (const item of queued) {
    // Check if already in lead_candidates
    const existing = await db.select({ id: leadCandidatesTable.id })
      .from(leadCandidatesTable)
      .where(eq(leadCandidatesTable.domain, item.rootDomain))
      .limit(1);

    if (existing.length > 0) {
      // Enrich company name if we now have cert org info
      if (item.certOrg) {
        await db.update(leadCandidatesTable).set({
          companyName: sql`COALESCE(lead_candidates.company_name, ${item.certOrg})`,
          updatedAt: new Date(),
        }).where(eq(leadCandidatesTable.domain, item.rootDomain));
      }
      await db.update(certstreamQueueTable).set({ processed: true, skippedReason: "already_exists" })
        .where(eq(certstreamQueueTable.id, item.id));
      skipped++;
      continue;
    }

    const inserted = await db.insert(leadCandidatesTable).values({
      domain: item.rootDomain,
      companyName: item.certOrg || null,
      source: "certstream_realtime",
      sourceData: {
        triggerSubdomain: item.triggerSubdomain,
        subdomainType: item.subdomainType,
        corporateScore: item.corporateScore,
        certOrg: item.certOrg,
        certIssuer: item.certIssuer,
        receivedAt: item.receivedAt,
      },
      scanStatus: "pending",
    }).onConflictDoNothing().returning();

    if (inserted.length > 0) {
      added++;
      db.update(certstreamStatusTable).set({
        totalQualified: sql`total_qualified + 1`,
        updatedAt: new Date(),
      }).where(eq(certstreamStatusTable.id, 1)).catch(() => {});
    }

    await db.update(certstreamQueueTable).set({ processed: true })
      .where(eq(certstreamQueueTable.id, item.id));
  }

  logger.info({ processed: queued.length, added, skipped }, "certstream queue processed");
  return { processed: queued.length, added, skipped };
}
