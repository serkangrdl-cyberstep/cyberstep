import { Router } from "express";
import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { requireAdmin } from "./middleware";
import { db, siteSettingsTable } from "@workspace/db";
import { logger } from "../../lib/logger";
import { checkCronHealth } from "../../services/cronHealthMonitor";
import {
  cronGetState,
  cronGetAll,
  cronGetHistory,
  cronGetStats,
  getCronFn,
  nextCronDate,
  wrapCron,
  cronGetLimit,
} from "../../services/cronRegistry";
import type { CronState } from "../../services/cronRegistry";
import { qualifyPendingCandidates, getISOWeek } from "../../services/discoveryPipeline";
import { scanCRTSH } from "../../services/crtshScanner";
import { scanShodanFree, SHODAN_FREE_QUERIES } from "../../services/shodanDiscovery";
import { processCertstreamQueue } from "../../services/certstreamLeadProcessor";

export const CRON_DEFS = [
  {
    name: "crtsh",
    label: "crt.sh Domain Keşfi",
    description: "Certificate Transparency kayıtlarından yeni TR domainleri bulur ve aday olarak kaydeder",
    defaultSchedule: "0 3 * * *",
    scheduleLabel: "Her gece 03:00",
    defaultEnabled: true,
    defaultLimit: 300,
    requiresApiKey: null as string | null,
    category: "lead-gen",
  },
  {
    name: "shodan",
    label: "Shodan Pasif Keşif",
    description: "Shodan API üzerinden TR domainlerinin açık port ve servis bilgisini toplar",
    defaultSchedule: "0 3 * * *",
    scheduleLabel: "Her gece 03:00",
    defaultEnabled: true,
    defaultLimit: 100,
    requiresApiKey: "SHODAN_API_KEY",
    category: "lead-gen",
  },
  {
    name: "lead_qual",
    label: "Lead Kalifikasyon",
    description: "Bekleyen lead adaylarını puanlar, filtreler ve aktif lead havuzuna taşır",
    defaultSchedule: "0 4 * * *",
    scheduleLabel: "Her gece 04:00",
    defaultEnabled: true,
    defaultLimit: 20,
    requiresApiKey: null as string | null,
    category: "lead-gen",
  },
  {
    name: "certstream_proc",
    label: "Certstream Kuyruk İşleyici",
    description: "Gerçek zamanlı SSL sertifika akışından gelen domainleri kuyruğa alır",
    defaultSchedule: "0 * * * *",
    scheduleLabel: "Her saat",
    defaultEnabled: true,
    defaultLimit: 100,
    requiresApiKey: null as string | null,
    category: "lead-gen",
  },
];

// All monitored night jobs (read-only display — not manually triggerable unless in CRON_DEFS)
export const ALL_NIGHT_JOBS = [
  { name: "crtsh",                   label: "crt.sh Domain Keşfi",              scheduleLabel: "Her gece 03:00",    scheduleExpr: "0 3 * * *", category: "lead-gen"     },
  { name: "shodan",                   label: "Shodan Pasif Keşif",               scheduleLabel: "Her gece 03:00",    scheduleExpr: "0 3 * * *", category: "lead-gen"     },
  { name: "lead_qual",                label: "Lead Kalifikasyon",                 scheduleLabel: "Her gece 04:00",    scheduleExpr: "0 4 * * *", category: "lead-gen"     },
  { name: "certstream_proc",          label: "Certstream İşleyici",               scheduleLabel: "Her saat",          scheduleExpr: "0 * * * *", category: "lead-gen"     },
  { name: "attack_path_analysis",     label: "Attack Path Analizi",              scheduleLabel: "Her gece 02:00",    scheduleExpr: "0 2 * * *", category: "security"     },
  { name: "servicenow_health",        label: "ServiceNow Sağlık Kontrolü",       scheduleLabel: "Her saat",          scheduleExpr: "0 * * * *", category: "integrations" },
  { name: "subscription_reminders",   label: "Abonelik Bitiş Hatırlatıcı",      scheduleLabel: "Her gün 10:00",     scheduleExpr: "0 10 * * *", category: "billing"     },
  { name: "assessment_reminder",      label: "Assessment 30-gün Hatırlatıcı",   scheduleLabel: "Her gün 09:00",     scheduleExpr: "0 9 * * *",  category: "assessment"  },
  { name: "domain_rescan",            label: "Domain Yeniden Tarama",            scheduleLabel: "Her gün 09:30",     scheduleExpr: "30 9 * * *", category: "security"    },
];

const router = Router();

// GET /api/admin-panel/cron/status — existing CRON_DEFS + in-memory state + DB stats merged
router.get("/admin-panel/cron/status", requireAdmin, async (req: Request, res: Response) => {
  try {
    const [rows, dbStats] = await Promise.all([
      db.select().from(siteSettingsTable),
      cronGetStats(),
    ]);

    const settingsMap: Record<string, string> = {};
    for (const r of rows) settingsMap[r.key] = r.value;

    const statsMap = Object.fromEntries(dbStats.map((s) => [s.job_name, s]));

    const jobs = CRON_DEFS.map((def) => {
      const state = cronGetState(def.name);
      const stat = statsMap[def.name];
      const nextRun = nextCronDate(def.defaultSchedule);
      return {
        name: def.name,
        label: def.label,
        description: def.description,
        scheduleLabel: def.scheduleLabel,
        scheduleExpr: def.defaultSchedule,
        category: def.category,
        requiresApiKey: def.requiresApiKey,
        apiKeyPresent: def.requiresApiKey ? !!process.env[def.requiresApiKey] : null,
        enabled: settingsMap[`cron.${def.name}.enabled`] !== "false",
        limit: parseInt(settingsMap[`cron.${def.name}.limit`] || String(def.defaultLimit)) || def.defaultLimit,
        state: {
          ...state,
          // prefer DB-persisted values for accuracy across restarts
          lastProcessedCount: stat?.last_count ?? state.lastProcessedCount,
          lastError: stat?.last_error ?? state.lastError,
        },
        dbStats: stat
          ? {
              totalRuns: Number(stat.total_runs),
              okRuns: Number(stat.ok_runs),
              errorRuns: Number(stat.error_runs),
              avgDurationMs: stat.avg_duration_ms ? Number(stat.avg_duration_ms) : null,
              lastRunAt: stat.last_run_at,
              lastStatus: stat.last_status,
            }
          : null,
        nextRunAt: nextRun?.toISOString() ?? null,
        triggerable: true,
      };
    });

    res.json({ jobs, allStates: cronGetAll() });
  } catch (e) {
    req.log.error({ err: e }, "Cron status hatası");
    res.status(500).json({ error: "Cron durumu alınamadı" });
  }
});

// GET /api/admin-panel/cron/all-jobs — all night jobs + DB stats (read-only)
router.get("/admin-panel/cron/all-jobs", requireAdmin, async (req: Request, res: Response) => {
  try {
    const dbStats = await cronGetStats();
    const statsMap = Object.fromEntries(dbStats.map((s) => [s.job_name, s]));

    const jobs = ALL_NIGHT_JOBS.map((def) => {
      const state = cronGetState(def.name);
      const stat = statsMap[def.name];
      const nextRun = nextCronDate(def.scheduleExpr);
      return {
        name: def.name,
        label: def.label,
        scheduleLabel: def.scheduleLabel,
        scheduleExpr: def.scheduleExpr,
        category: def.category,
        state: {
          ...state,
          lastProcessedCount: stat?.last_count ?? state.lastProcessedCount,
          lastError: stat?.last_error ?? state.lastError,
          lastRunStatus: (stat?.last_status as CronState["lastRunStatus"]) ?? state.lastRunStatus,
          lastRunAt: stat?.last_run_at ?? state.lastRunAt,
        },
        dbStats: stat
          ? {
              totalRuns: Number(stat.total_runs),
              okRuns: Number(stat.ok_runs),
              errorRuns: Number(stat.error_runs),
              avgDurationMs: stat.avg_duration_ms ? Number(stat.avg_duration_ms) : null,
            }
          : null,
        nextRunAt: nextRun?.toISOString() ?? null,
        triggerable: CRON_DEFS.some((d) => d.name === def.name),
      };
    });

    // Also add any DB-tracked jobs not in ALL_NIGHT_JOBS
    const knownNames = new Set(ALL_NIGHT_JOBS.map((d) => d.name));
    for (const stat of dbStats) {
      if (!knownNames.has(stat.job_name)) {
        const state = cronGetState(stat.job_name);
        jobs.push({
          name: stat.job_name,
          label: stat.job_name.replace(/_/g, " "),
          scheduleLabel: "—",
          scheduleExpr: "",
          category: "other",
          state: {
            ...state,
            lastProcessedCount: stat.last_count ?? state.lastProcessedCount,
            lastError: stat.last_error ?? state.lastError,
            lastRunStatus: (stat.last_status as CronState["lastRunStatus"]) ?? state.lastRunStatus,
            lastRunAt: stat.last_run_at ?? state.lastRunAt,
          },
          dbStats: {
            totalRuns: Number(stat.total_runs),
            okRuns: Number(stat.ok_runs),
            errorRuns: Number(stat.error_runs),
            avgDurationMs: stat.avg_duration_ms ? Number(stat.avg_duration_ms) : null,
          },
          nextRunAt: null,
          triggerable: false,
        });
      }
    }

    res.json({ jobs });
  } catch (e) {
    req.log.error({ err: e }, "All-jobs hatası");
    res.status(500).json({ error: "Job listesi alınamadı" });
  }
});

// GET /api/admin-panel/cron/health
router.get("/admin-panel/cron/health", requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await checkCronHealth();
    res.json(result);
  } catch (e) {
    req.log.error({ err: e }, "Cron health hatası");
    res.status(500).json({ error: "Sağlık durumu alınamadı" });
  }
});

// GET /api/admin-panel/cron/history?job=&limit=
router.get("/admin-panel/cron/history", requireAdmin, async (req: Request, res: Response) => {
  try {
    const job = typeof req.query["job"] === "string" ? req.query["job"] : undefined;
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query["limit"] || "50"))));
    const runs = await cronGetHistory(job, limit);
    res.json({ runs });
  } catch (e) {
    req.log.error({ err: e }, "Cron history hatası");
    res.status(500).json({ error: "Geçmiş alınamadı" });
  }
});

// PUT /api/admin-panel/cron/settings
router.put("/admin-panel/cron/settings", requireAdmin, async (req: Request, res: Response) => {
  try {
    const updates = req.body as Record<string, string>;
    for (const [key, value] of Object.entries(updates)) {
      if (!key.startsWith("cron.")) { res.status(400).json({ error: "Geçersiz anahtar" }); return; }
      await db.insert(siteSettingsTable)
        .values({ key, value, updatedAt: new Date() })
        .onConflictDoUpdate({ target: siteSettingsTable.key, set: { value, updatedAt: new Date() } });
    }
    logger.info({ keys: Object.keys(updates) }, "Cron settings updated");
    res.json({ success: true });
  } catch (e) {
    req.log.error({ err: e }, "Cron settings güncelleme hatası");
    res.status(500).json({ error: "Ayarlar güncellenemedi" });
  }
});

// POST /api/admin-panel/cron/trigger/:name
router.post("/admin-panel/cron/trigger/:name", requireAdmin, async (req: Request, res: Response) => {
  const name = String(req.params["name"]);
  const def = CRON_DEFS.find((d) => d.name === name);
  if (!def) { res.status(404).json({ error: "Cron bulunamadı" }); return; }

  const state = cronGetState(name);
  if (state.isRunning) { res.status(409).json({ error: "Zaten çalışıyor" }); return; }

  const limitRows = await db.select().from(siteSettingsTable)
    .where(eq(siteSettingsTable.key, `cron.${name}.limit`))
    .catch(() => [] as { key: string; value: string }[]);
  const limitRow = limitRows[0];
  const limit = parseInt(limitRow?.value || String(def.defaultLimit)) || def.defaultLimit;

  res.json({ started: true, message: `${def.label} başlatıldı` });

  setImmediate(async () => {
    // Prefer the registered wrapCron fn for persistence
    const wrappedFn = getCronFn(name);
    if (wrappedFn) {
      await wrappedFn().catch((err: unknown) => logger.warn({ err, name }, "Manual trigger failed"));
      return;
    }

    // Fallback: inline execution with wrapCron
    const fn = wrapCron(name, def.defaultSchedule, async () => {
      if (name === "crtsh") {
        await scanCRTSH("%.com.tr", { daysBack: 2, minCorporateScore: 10, limit });
        await new Promise((r) => setTimeout(r, 3000));
        await scanCRTSH("%.net.tr", { daysBack: 2, minCorporateScore: 10, limit: Math.floor(limit / 3) });
      } else if (name === "shodan") {
        if (!process.env["SHODAN_API_KEY"]) return 0;
        const queryIdx = getISOWeek(new Date()) % SHODAN_FREE_QUERIES.length;
        await scanShodanFree(queryIdx, limit);
      } else if (name === "lead_qual") {
        await qualifyPendingCandidates(limit);
      } else if (name === "certstream_proc") {
        const result = await processCertstreamQueue(limit);
        return result.added ?? 0;
      }
      return limit;
    });
    await fn().catch((err: unknown) => logger.warn({ err, name }, "Manual trigger fallback failed"));
  });
});

export default router;
