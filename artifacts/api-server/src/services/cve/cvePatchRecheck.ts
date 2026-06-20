import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";
import { enrichWithNVD } from "./cveFeedReader";

export interface PatchRecheckOptions {
  maxAgeDays?: number;
}

export interface PatchRecheckResult {
  checked: number;
  updated: number;
}

/**
 * Patch flip olduğunda domain_scans.cve_summary JSONB içindeki patchAvailable
 * alanını da günceller — scan zamanı yakalanan stale veriyi düzeltir.
 */
async function propagatePatchToDomainScans(cveId: string, patchUrl: string | null | undefined): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE domain_scans
      SET cve_summary = (
        SELECT jsonb_agg(
          CASE WHEN (elem->>'cveId') = ${cveId}
          THEN jsonb_set(
                 jsonb_set(elem, '{patchAvailable}', 'true'::jsonb),
                 '{patchUrl}',
                 ${patchUrl ? `"${patchUrl}"` : 'null'}::jsonb
               )
          ELSE elem
          END
        )
        FROM jsonb_array_elements(cve_summary) elem
      )
      WHERE cve_summary IS NOT NULL
        AND cve_summary @> ${JSON.stringify([{ cveId }])}::jsonb
    `);
  } catch (err) {
    logger.warn({ err, cveId }, "domain_scans JSONB propagation hatası — atlanıyor");
  }
}

/**
 * patch_available = false olan CVE'leri NVD'den yeniden sorgular.
 * maxAgeDays: sadece son N gün içinde tespit edilen CVE'leri kontrol et.
 *   - Cron: 60 (patch çıkma ihtimali yüksek pencere)
 *   - Admin re-enrich butonu: undefined (tümü)
 */
export async function recheckPatchStatus(opts?: PatchRecheckOptions): Promise<PatchRecheckResult> {
  const ageSql = opts?.maxAgeDays != null
    ? sql`AND detected_at > NOW() - INTERVAL '${sql.raw(String(opts.maxAgeDays))} days'`
    : sql``;

  const rows = await db.execute(sql`
    SELECT cve_id FROM cve_tracker
    WHERE patch_available = false
    ${ageSql}
    ORDER BY detected_at DESC
  `);
  const cveIds = (rows.rows as Array<{ cve_id: string }>).map(r => r.cve_id);

  if (cveIds.length === 0) {
    logger.info({ maxAgeDays: opts?.maxAgeDays }, "Yama bekleyen CVE yok — recheck atlandı");
    return { checked: 0, updated: 0 };
  }

  logger.info({ count: cveIds.length, maxAgeDays: opts?.maxAgeDays }, "Patch recheck başladı");

  let updated = 0;
  for (const cveId of cveIds) {
    try {
      const enriched = await enrichWithNVD(cveId);
      if (enriched.patchAvailable) {
        // 1. cve_tracker güncelle — idempotent (WHERE patch_available=false)
        const result = await db.execute(sql`
          UPDATE cve_tracker
          SET patch_available = true,
              patch_url = ${enriched.patchUrl ?? null},
              patch_became_available_at = NOW()
          WHERE cve_id = ${cveId}
            AND patch_available = false
        `);
        if ((result.rowCount ?? 0) > 0) {
          updated++;
          logger.info({ cveId, patchUrl: enriched.patchUrl }, "CVE yama durumu güncellendi (false→true)");
          // 2. domain_scans JSONB içindeki stale patchAvailable değerini de güncelle
          await propagatePatchToDomainScans(cveId, enriched.patchUrl);
        }
      }
    } catch (err) {
      logger.warn({ err, cveId }, "CVE patch recheck hatası — atlanıyor");
    }
    // NVD rate limit: key'siz 30 sn/5 istek ≈ 6s; key varsa 1.2s
    await new Promise(r => setTimeout(r, process.env["NVD_API_KEY"] ? 1200 : 6200));
  }

  logger.info({ checked: cveIds.length, updated }, "Patch recheck tamamlandı");
  return { checked: cveIds.length, updated };
}
