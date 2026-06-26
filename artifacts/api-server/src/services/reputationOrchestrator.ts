/**
 * Reputation Orchestrator — Part 3 + Part 6
 *
 * Blacklist, SSL ve mail reputation kontrollerini sırayla çalıştırır.
 * Kontrol sonuçlarına göre domain'in overall_score'unu günceller.
 *
 * Cron: her gece 03:45 Istanbul (03:00 blacklist, 03:15 SSL, 03:30 mail
 * batch cron'larından sonra; orchestrator tüm pipeline'ı toparlar).
 */

import { db, domainScansTable } from "@workspace/db";
import { isNull, lt, or, sql, eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { runBlacklistCheck } from "./monitoring/blacklist-monitor";
import { runSslCheck, runMailCheck } from "./monitoring/ssl-mail-monitor";

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
const DELAY_MS   = 500;

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

export async function runReputationMonitoring(): Promise<{ processed: number; errors: number }> {
  const cutoff = new Date(Date.now() - SEVEN_DAYS);

  const rows = await db
    .select({ id: domainScansTable.id, domain: domainScansTable.domain })
    .from(domainScansTable)
    .where(
      or(
        isNull(domainScansTable.blacklistCheckedAt),
        lt(domainScansTable.blacklistCheckedAt, cutoff)
      )
    )
    .orderBy(sql`blacklist_checked_at NULLS FIRST, created_at DESC`)
    .limit(200);

  logger.info({ count: rows.length }, "Reputation orchestrator: batch başladı");

  let processed = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;

    try {
      // 1. Blacklist kontrolü
      await runBlacklistCheck(row.id);

      // 2. SSL sertifika kontrolü
      await runSslCheck(row.id);

      // 3. Mail reputation kontrolü
      await runMailCheck(row.id);

      // 4. Part 6 — overall_score düzeltmesi
      const [scan] = await db
        .select({
          overallScore:        domainScansTable.overallScore,
          blacklistScore:      domainScansTable.blacklistScore,
          sslIsValid:          domainScansTable.sslIsValid,
          sslDaysRemaining:    domainScansTable.sslDaysRemaining,
          mailReputationScore: domainScansTable.mailReputationScore,
        })
        .from(domainScansTable)
        .where(eq(domainScansTable.id, row.id));

      if (scan) {
        let adj = 0;
        if ((scan.blacklistScore ?? 100) < 50)      adj -= 15;
        if (scan.sslIsValid === false)               adj -= 20;
        if ((scan.sslDaysRemaining ?? 999) <= 7)     adj -= 15;
        if ((scan.mailReputationScore ?? 100) < 50)  adj -= 5;

        if (adj !== 0) {
          const newScore = Math.max(0, (scan.overallScore ?? 0) + adj);
          await db
            .update(domainScansTable)
            .set({ overallScore: newScore })
            .where(eq(domainScansTable.id, row.id));
          logger.info({ domain: row.domain, adj, newScore }, "Reputation: overall_score güncellendi");
        }
      }

      processed++;

      if ((i + 1) % 50 === 0) {
        logger.info({ processed, total: rows.length, domain: row.domain }, "Reputation orchestrator: ilerleme");
      }
    } catch (err) {
      errors++;
      logger.warn({ domain: row.domain, err }, "Reputation orchestrator: domain hata");
    }

    if (i < rows.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  logger.info({ processed, errors }, "Reputation orchestrator: tamamlandı");
  return { processed, errors };
}
