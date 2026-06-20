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
        await db.execute(sql`
          UPDATE cve_tracker
          SET patch_available = true,
              patch_url = ${enriched.patchUrl ?? null},
              patch_became_available_at = NOW()
          WHERE cve_id = ${cveId}
            AND patch_available = false
        `);
        updated++;
        logger.info({ cveId, patchUrl: enriched.patchUrl }, "CVE yama durumu güncellendi (false→true)");
      }
    } catch (err) {
      logger.warn({ err, cveId }, "CVE patch recheck hatası — atlanıyor");
    }
    // NVD rate limit: key'siz 30 sn/5 istek ≈ 6s minimum; 2s yeterli key varsa
    await new Promise(r => setTimeout(r, process.env["NVD_API_KEY"] ? 1200 : 6200));
  }

  logger.info({ checked: cveIds.length, updated }, "Patch recheck tamamlandı");
  return { checked: cveIds.length, updated };
}
