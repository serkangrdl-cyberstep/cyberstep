/**
 * Kaçırılan cron'ları telafi etme (catch-up).
 *
 * Neden: Uygulama Replit "Autoscale" üzerinde yayında. Trafik yokken sunucu uyur,
 * gece saatlerine planlanan işler (RSS 03:30, Shodan 04:15, blog Pzt/Per 06:00…)
 * tetiklenmez. Sunucu her uyandığında bu servis, son başarılı çalışması fazla eski
 * olan işleri bir kez çalıştırır. Kalıcı çözüm Reserved VM'e geçmektir; bu servis
 * orada da zararsızdır (işler zamanında çalıştığı için hiçbir şey yapmaz).
 *
 * İşler wrapCron ile kaydedilen fonksiyonlar üzerinden çalışır (getCronFn), böylece
 * çakışma koruması, cron_job_runs kaydı ve hata bildirimi aynen geçerlidir.
 * Admin panelinden kapatılan işler (cron.<ad>.enabled = false) atlanır.
 */

import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import { cronIsEnabled, getCronFn } from "./cronRegistry";

interface CatchupJob {
  /** Çalıştırılacak wrapCron adı */
  name: string;
  /** Son başarılı çalışma bundan eskiyse telafi edilir (saat) */
  maxAgeHours: number;
  /** Son çalışmaya bakarken birlikte sayılan iş adları (aynı işin farklı zamanlamaları) */
  group?: string[];
}

export const CATCHUP_JOBS: CatchupJob[] = [
  // Yeni domain keşfi ve tarama
  { name: "crtsh", maxAgeHours: 6 },
  { name: "shodan", maxAgeHours: 26 },
  { name: "censys_discovery", maxAgeHours: 26 },
  { name: "usom_refresh", maxAgeHours: 26 },
  // İçerik: haberler, bülten, blog, sosyal medya
  { name: "digest_rss_collect", maxAgeHours: 26 },
  { name: "digest_enrich", maxAgeHours: 26 },
  { name: "digest_weekly_generate", maxAgeHours: 8 * 24 },
  { name: "digest_autopublish", maxAgeHours: 26 },
  { name: "blog_autopilot_mon", maxAgeHours: 4 * 24, group: ["blog_autopilot_mon", "blog_autopilot_thu"] },
  { name: "social_media_weekly", maxAgeHours: 8 * 24 },
  // Tedarikçi izleme
  { name: "tprm_vendor_rescan", maxAgeHours: 26 },
];

/** Başarısız bir telafi denemesinden sonra aynı işi yeniden denemeden önce beklenecek süre. */
const RETRY_AFTER_FAILURE_HOURS = 6;

let running = false;

async function lastRuns(names: string[]): Promise<{ lastOk: Date | null; lastAttempt: Date | null }> {
  const { rows } = await pool.query<{ last_ok: Date | null; last_attempt: Date | null }>(
    `SELECT MAX(started_at) FILTER (WHERE status = 'ok') AS last_ok,
            MAX(started_at) AS last_attempt
     FROM cron_job_runs WHERE job_name = ANY($1)`,
    [names],
  );
  return { lastOk: rows[0]?.last_ok ?? null, lastAttempt: rows[0]?.last_attempt ?? null };
}

const hoursSince = (d: Date | null) => (d ? (Date.now() - new Date(d).getTime()) / 3_600_000 : Infinity);

/** Gecikmiş işleri sırayla çalıştırır; çalıştırılan iş adlarını döner. */
export async function runCronCatchup(): Promise<string[]> {
  if (running) return [];
  running = true;
  const ran: string[] = [];
  try {
    for (const job of CATCHUP_JOBS) {
      try {
        if (!(await cronIsEnabled(job.name))) continue;
        const fn = getCronFn(job.name);
        if (!fn) continue; // bu süreçte kayıtlı değil
        const { lastOk: last, lastAttempt } = await lastRuns(job.group ?? [job.name]);
        const ageHours = hoursSince(last);
        if (ageHours < job.maxAgeHours) continue;
        // Son deneme başarısızsa (ör. AI servisi hatası) her saat yeniden deneme: en az 6 saat bekle
        if (hoursSince(lastAttempt) < Math.min(RETRY_AFTER_FAILURE_HOURS, job.maxAgeHours)) continue;

        logger.info({ job: job.name, lastOkRun: last, ageHours: Number.isFinite(ageHours) ? Math.round(ageHours) : null },
          "Cron catch-up: gecikmiş iş çalıştırılıyor");
        await fn();
        ran.push(job.name);
      } catch (err) {
        logger.warn({ err, job: job.name }, "Cron catch-up: iş çalıştırılamadı");
      }
    }
  } finally {
    running = false;
  }
  if (ran.length > 0) logger.info({ ran }, "Cron catch-up tamamlandı");
  return ran;
}
