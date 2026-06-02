import { Router } from "express";
import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { requireAdmin } from "./middleware";
import { db, siteSettingsTable } from "@workspace/db";
import { logger } from "../../lib/logger";
import { cronGetState, cronGetAll, cronStart } from "../../services/cronRegistry";
import { qualifyPendingCandidates, getISOWeek } from "../../services/discoveryPipeline";
import { scanCRTSH } from "../../services/crtshScanner";
import { scanShodanFree, SHODAN_FREE_QUERIES } from "../../services/shodanDiscovery";
import { processCertstreamQueue } from "../../services/certstreamLeadProcessor";

export const CRON_DEFS = [
  {
    name: "crtsh",
    label: "crt.sh Domain Keşfi",
    description: "Certificate Transparency kayıtlarından yeni TR domainleri bulur ve aday olarak kaydeder",
    defaultSchedule: "0 3 * * 1",
    scheduleLabel: "Pazartesi 03:00",
    defaultEnabled: true,
    defaultLimit: 300,
    requiresApiKey: null as string | null,
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
  },
];

const router = Router();

// GET /api/admin-panel/cron/status
router.get("/admin-panel/cron/status", requireAdmin, async (req: Request, res: Response) => {
  try {
    const rows = await db.select().from(siteSettingsTable);
    const settingsMap: Record<string, string> = {};
    for (const r of rows) settingsMap[r.key] = r.value;

    const jobs = CRON_DEFS.map((def) => ({
      name: def.name,
      label: def.label,
      description: def.description,
      scheduleLabel: def.scheduleLabel,
      defaultSchedule: def.defaultSchedule,
      requiresApiKey: def.requiresApiKey,
      apiKeyPresent: def.requiresApiKey ? !!process.env[def.requiresApiKey] : null,
      enabled: settingsMap[`cron.${def.name}.enabled`] !== "false",
      limit: parseInt(settingsMap[`cron.${def.name}.limit`] || String(def.defaultLimit)) || def.defaultLimit,
      state: cronGetState(def.name),
    }));

    res.json({ jobs, allStates: cronGetAll() });
  } catch (e) {
    req.log.error({ err: e }, "Cron status hatası");
    res.status(500).json({ error: "Cron durumu alınamadı" });
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
    const done = cronStart(name);
    try {
      if (name === "crtsh") {
        await scanCRTSH("%.com.tr", { daysBack: 7, minCorporateScore: 70, limit });
        await new Promise((r) => setTimeout(r, 3000));
        await scanCRTSH("%.net.tr", { daysBack: 7, minCorporateScore: 70, limit: Math.floor(limit / 3) });
      } else if (name === "shodan") {
        if (!process.env["SHODAN_API_KEY"]) { done(false, "SHODAN_API_KEY tanımlı değil"); return; }
        const queryIdx = getISOWeek(new Date()) % SHODAN_FREE_QUERIES.length;
        await scanShodanFree(queryIdx, limit);
      } else if (name === "lead_qual") {
        await qualifyPendingCandidates(limit);
      } else if (name === "certstream_proc") {
        await processCertstreamQueue(limit);
      }
      done(true);
      logger.info({ name, limit }, "Cron manual trigger completed");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      done(false, msg);
      logger.warn({ name, err }, "Cron manual trigger failed");
    }
  });
});

export default router;
