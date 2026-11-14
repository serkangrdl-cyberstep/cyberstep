/**
 * Skor v2 backfill: henüz v2 ile skorlanmamış (score_v2_version boş veya eski) domain_scans satırlarına
 * Skor v2 yazar. Yeni taramalar da bir sonraki çalıştırmada skorlanır.
 * Benchmark ve sektör karşılaştırması bu kolonu SQL üzerinden okur.
 */

import { db, domainScansTable } from "@workspace/db";
import { desc, isNull, ne, or, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { computeScoreV2, cveIdsOf, SCORE_V2_VERSION } from "../lib/scoring/scoreV2";
import { loadKevLookup, scanToScoreInput } from "../lib/scoring/scoreV2Loader";

export const BACKFILL_BATCH_SIZE = 1000;

/** Bir parti işler; işlenen satır sayısını döner (0 = yapılacak iş kalmadı). */
export async function runScoreV2BackfillBatch(limit = BACKFILL_BATCH_SIZE): Promise<number> {
  // En yeni taramalardan başla: benchmark "domain başına son tarama"yı kullanır.
  const rows = await db.select().from(domainScansTable)
    .where(or(isNull(domainScansTable.scoreV2Version), ne(domainScansTable.scoreV2Version, SCORE_V2_VERSION)))
    .orderBy(desc(domainScansTable.id))
    .limit(limit);
  if (rows.length === 0) return 0;

  const inputs = rows.map(scanToScoreInput);
  const kev = await loadKevLookup([...new Set(inputs.flatMap(cveIdsOf))]);

  const values = rows.map((r, i) => {
    const result = computeScoreV2(inputs[i]!, kev);
    // Veri yetersizse skor yazılmaz (null) — benchmark'a girmez; sürüm yine işaretlenir.
    const score = result.insufficientData ? null : result.score;
    return sql`(${r.id}::int, ${score}::int)`;
  });

  // Tek UPDATE ile toplu yazım
  await db.execute(sql`
    UPDATE domain_scans AS d
    SET score_v2 = v.score, score_v2_version = ${SCORE_V2_VERSION}, score_v2_at = now()
    FROM (VALUES ${sql.join(values, sql`, `)}) AS v(id, score)
    WHERE d.id = v.id
  `);

  return rows.length;
}

/** Cron girişi: tek çalıştırmada en fazla `maxBatches` parti. */
export async function runScoreV2Backfill(maxBatches = 5): Promise<number> {
  let total = 0;
  for (let i = 0; i < maxBatches; i++) {
    const n = await runScoreV2BackfillBatch();
    total += n;
    if (n < BACKFILL_BATCH_SIZE) break;
  }
  if (total > 0) logger.info({ total }, "Skor v2 backfill tamamlandı");
  return total;
}
