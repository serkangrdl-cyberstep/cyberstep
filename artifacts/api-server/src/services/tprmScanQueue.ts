/**
 * TPRM tarama kuyruğu — toplu yüklemede yüzlerce taramanın aynı anda
 * başlamasını önler. Bellek içi ve süreç başına; sunucu yeniden başlarsa
 * kuyruktaki işler kaybolur, ancak gece cron'u (runVendorRescanCron)
 * hiç taranmamış tedarikçileri zaten tarar.
 */

import { logger } from "../lib/logger";

type Job = { key: string; run: () => Promise<void> };

const CONCURRENCY = 2;
const queue: Job[] = [];
const queued = new Set<string>();
let active = 0;

function pump(): void {
  while (active < CONCURRENCY && queue.length > 0) {
    const job = queue.shift()!;
    active++;
    job.run()
      .catch((err) => logger.error({ err, key: job.key }, "TPRM kuyruk işi başarısız"))
      .finally(() => {
        active--;
        queued.delete(job.key);
        pump();
      });
  }
}

/** Aynı anahtar zaten kuyruktaysa tekrar eklenmez. true = eklendi. */
export function enqueueScan(key: string, run: () => Promise<void>): boolean {
  if (queued.has(key)) return false;
  queued.add(key);
  queue.push({ key, run });
  pump();
  return true;
}

export function scanQueueStats(): { pending: number; active: number } {
  return { pending: queue.length, active };
}
