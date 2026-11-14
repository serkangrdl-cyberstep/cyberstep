/**
 * Haftalık digest otomatik yayını.
 *
 * - Onay bekleyen digestler otomatik yayınlanır. Yalnızca bu hafta / geçen hafta
 *   için olanlar abonelere e-postayla gönderilir; daha eski taslaklar sadece sitede
 *   (kendi haftası etiketiyle) yayınlanır — abonelere aylar önceki bülten gitmez.
 * - Geçmişte haber toplanmış ama digest'i hiç üretilmemiş haftalar (ör. sunucunun
 *   uykuda kaldığı dönem) için, o haftanın gerçek haberlerinden digest üretilir ve
 *   sadece sitede yayınlanır. Haberi olmayan haftalar için içerik uydurulmaz.
 * - Admin panelinden kapatılabilir: site_settings `digest.autoPublish` = "false".
 */

import { db, pool, weeklyDigestsTable, newsItemsTable } from "@workspace/db";
import { ne, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

/** Bu sayıdan az haberi olan geçmiş haftalar için digest üretilmez. */
export const MIN_NEWS_FOR_BACKFILL = 5;
/** En fazla bu kadar hafta geriye gidilir. */
export const MAX_BACKFILL_WEEKS = 26;

interface IsoWeek { weekYear: number; weekNumber: number }

async function isEnabled(): Promise<boolean> {
  try {
    const { rows } = await pool.query<{ value: string }>("SELECT value FROM site_settings WHERE key = 'digest.autoPublish'");
    return rows[0]?.value !== "false";
  } catch {
    return true;
  }
}

/** Haftanın sırası (karşılaştırma için): yıl * 100 + hafta */
const ord = (w: IsoWeek) => w.weekYear * 100 + w.weekNumber;

export async function runDigestAutoPublish(now = new Date()): Promise<{ generated: number; published: number; emailed: number }> {
  if (!(await isEnabled())) {
    logger.info("Digest otomatik yayın kapalı (digest.autoPublish=false)");
    return { generated: 0, published: 0, emailed: 0 };
  }
  const { getISOWeek } = await import("../routes/digest/rss-collector");
  const { generateWeeklyDigest } = await import("../routes/digest/claude-processor");
  const { approveDigest } = await import("../routes/digest/index");

  const thisWeek = getISOWeek(now);
  const lastWeek = getISOWeek(new Date(now.getTime() - 7 * 86_400_000));

  // ── 1) Haberi olan ama digest'i olmayan geçmiş haftalar ────────────────────
  let generated = 0;
  const existing = await db.select({ weekYear: weeklyDigestsTable.weekYear, weekNumber: weeklyDigestsTable.weekNumber })
    .from(weeklyDigestsTable);
  const have = new Set(existing.map(e => ord(e)));

  const newsWeeks = await db.select({
    weekYear: newsItemsTable.weekYear,
    weekNumber: newsItemsTable.weekNumber,
    n: sql<number>`count(*)::int`,
  }).from(newsItemsTable)
    .where(sql`${newsItemsTable.weekYear} IS NOT NULL AND ${newsItemsTable.weekNumber} IS NOT NULL`)
    .groupBy(newsItemsTable.weekYear, newsItemsTable.weekNumber);

  const oldestAllowed = ord(getISOWeek(new Date(now.getTime() - MAX_BACKFILL_WEEKS * 7 * 86_400_000)));
  const candidates = newsWeeks
    .filter((w): w is { weekYear: number; weekNumber: number; n: number } => w.weekYear !== null && w.weekNumber !== null)
    .filter(w => w.n >= MIN_NEWS_FOR_BACKFILL)
    .filter(w => !have.has(ord(w)))
    .filter(w => ord(w) >= oldestAllowed && ord(w) < ord(thisWeek)) // bu hafta henüz bitmedi
    .sort((a, b) => ord(a) - ord(b));

  for (const w of candidates) {
    try {
      await generateWeeklyDigest(w.weekYear, w.weekNumber);
      generated++;
      logger.info({ week: `${w.weekYear}/${w.weekNumber}`, news: w.n }, "Digest: eksik hafta için digest üretildi");
    } catch (err) {
      logger.warn({ err, week: `${w.weekYear}/${w.weekNumber}` }, "Digest: eksik hafta üretilemedi");
    }
  }

  // ── 2) Onay bekleyenleri yayınla ───────────────────────────────────────────
  const pending = await db.select({ id: weeklyDigestsTable.id, weekYear: weeklyDigestsTable.weekYear, weekNumber: weeklyDigestsTable.weekNumber })
    .from(weeklyDigestsTable)
    .where(ne(weeklyDigestsTable.status, "approved"));

  let published = 0;
  let emailed = 0;
  for (const d of pending) {
    const recent = ord(d) >= ord(lastWeek);
    try {
      if (await approveDigest(d.id, { sendEmails: recent })) {
        published++;
        if (recent) emailed++;
      }
    } catch (err) {
      logger.warn({ err, id: d.id }, "Digest otomatik yayınlanamadı");
    }
  }

  if (generated || published) logger.info({ generated, published, emailed }, "Digest otomatik yayın tamamlandı");
  return { generated, published, emailed };
}
