import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  growthTriggersTable,
  competitorChecksTable,
  benchmarkDownloadsTable,
  growthEngineSettingsTable,
  ekapTendersTable,
} from "@workspace/db";
import { eq, desc, gte, and, count } from "drizzle-orm";
import {
  fireTrigger,
  handleCompetitorCheck,
  handleBenchmarkDownload,
  getGrowthEngineStats,
  runSSLExpiryCron,
  runCVEAlertCron,
  runPortChangeCron,
} from "../../services/growth-engine";
import { logger } from "../../lib/logger";
import { requireAdmin } from "../../middleware/auth";

const router: IRouter = Router();

// ─── Admin: Stats ─────────────────────────────────────────────────────────────

router.get("/stats", requireAdmin, async (req, res) => {
  try {
    const stats = await getGrowthEngineStats();
    res.json(stats);
  } catch (err) {
    req.log.error({ err }, "growth-engine stats failed");
    res.status(500).json({ error: "İstatistikler alınamadı" });
  }
});

// ─── Admin: Trigger List ──────────────────────────────────────────────────────

router.get("/triggers", requireAdmin, async (req, res) => {
  try {
    const { type, status, page = "1", limit = "50" } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const conditions = [];
    if (type) conditions.push(eq(growthTriggersTable.triggerType, type));
    if (status) conditions.push(eq(growthTriggersTable.status, status));

    const rows = await db.select().from(growthTriggersTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(growthTriggersTable.createdAt))
      .limit(parseInt(limit))
      .offset(offset);

    const [{ total }] = await db.select({ total: count() }).from(growthTriggersTable)
      .where(conditions.length ? and(...conditions) : undefined);

    res.json({ rows, total });
  } catch (err) {
    req.log.error({ err }, "growth-engine triggers list failed");
    res.status(500).json({ error: "Liste alınamadı" });
  }
});

// ─── Admin: Competitor Checks ─────────────────────────────────────────────────

router.get("/competitor-checks", requireAdmin, async (req, res) => {
  try {
    const rows = await db.select().from(competitorChecksTable)
      .orderBy(desc(competitorChecksTable.createdAt)).limit(100);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "competitor checks list failed");
    res.status(500).json({ error: "Liste alınamadı" });
  }
});

// ─── Admin: Benchmark Downloads ───────────────────────────────────────────────

router.get("/benchmark-downloads", requireAdmin, async (req, res) => {
  try {
    const rows = await db.select().from(benchmarkDownloadsTable)
      .orderBy(desc(benchmarkDownloadsTable.createdAt)).limit(100);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "benchmark downloads list failed");
    res.status(500).json({ error: "Liste alınamadı" });
  }
});

// ─── Admin: EKAP Tenders ──────────────────────────────────────────────────────

router.get("/ekap-tenders", requireAdmin, async (req, res) => {
  try {
    const rows = await db.select().from(ekapTendersTable)
      .orderBy(desc(ekapTendersTable.processedAt)).limit(100);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "ekap tenders list failed");
    res.status(500).json({ error: "Liste alınamadı" });
  }
});

// ─── Admin: Settings ──────────────────────────────────────────────────────────

router.get("/settings", requireAdmin, async (req, res) => {
  try {
    const rows = await db.select().from(growthEngineSettingsTable);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "growth-engine settings get failed");
    res.status(500).json({ error: "Ayarlar alınamadı" });
  }
});

router.put("/settings/:triggerType", requireAdmin, async (req, res) => {
  try {
    const triggerType = String(req.params["triggerType"]);
    const { isActive, suppressDays, maxDailyLimit } = req.body as { isActive?: boolean; suppressDays?: number; maxDailyLimit?: number };

    const existing = await db.select({ id: growthEngineSettingsTable.id })
      .from(growthEngineSettingsTable)
      .where(eq(growthEngineSettingsTable.triggerType, triggerType))
      .limit(1);

    if (existing.length) {
      await db.update(growthEngineSettingsTable)
        .set({
          ...(isActive !== undefined ? { isActive } : {}),
          ...(suppressDays !== undefined ? { suppressDays } : {}),
          ...(maxDailyLimit !== undefined ? { maxDailyLimit } : {}),
          updatedAt: new Date(),
        })
        .where(eq(growthEngineSettingsTable.triggerType, triggerType));
    } else {
      await db.insert(growthEngineSettingsTable).values({
        triggerType,
        isActive: isActive ?? true,
        suppressDays: suppressDays ?? 30,
        maxDailyLimit: maxDailyLimit ?? 50,
      });
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "growth-engine settings update failed");
    res.status(500).json({ error: "Ayar güncellenemedi" });
  }
});

// ─── Admin: Manual Trigger Test ───────────────────────────────────────────────

router.post("/trigger-test", requireAdmin, async (req, res) => {
  try {
    const { triggerType, domain, email } = req.body as { triggerType: string; domain: string; email?: string };
    if (!triggerType || !domain) { res.status(400).json({ error: "triggerType ve domain zorunlu" }); return; }

    const testData: Record<string, Record<string, unknown>> = {
      ssl_expiry:    { expiryDate: "2026-06-15", daysRemaining: 14 },
      new_cve:       { cveId: "CVE-2025-99999", cvss: 9.8, affectedTech: "Apache", description: "Test CVE" },
      sector_breach: { newsTitle: "Test sektör saldırısı haberi", sector: "finans", attackType: "siber saldırı" },
      kvk_penalty:   { penaltyTl: "250000", sector: "finans", decisionNumber: "TEST-001" },
      score_drop:    { oldScore: 72, newScore: 55, diff: 17, suggestedUpgrade: "Büyüme" },
      port_change:   { newPorts: [3389], portNames: ["RDP"] },
      ekap_tender:   { tenderSubject: "Test İhale", contractingAuthority: "Test Kamu Kurumu" },
    };

    const ok = await fireTrigger({
      type: triggerType,
      domain,
      email,
      data: testData[triggerType] ?? { test: true },
    });

    res.json({ ok, message: ok ? "Trigger gönderildi" : "Gönderilmedi (suppress veya e-posta yok)" });
  } catch (err) {
    req.log.error({ err }, "trigger test failed");
    res.status(500).json({ error: "Test başarısız" });
  }
});

// ─── Admin: Manual Cron Run ───────────────────────────────────────────────────

router.post("/run-cron/:cronType", requireAdmin, async (req, res) => {
  try {
    const cronType = String(req.params["cronType"]);
    res.json({ ok: true, message: "Cron arka planda başlatıldı" });

    // Fire-and-forget
    setImmediate(async () => {
      try {
        if (cronType === "ssl_expiry") await runSSLExpiryCron();
        else if (cronType === "cve_alert") await runCVEAlertCron();
        else if (cronType === "port_change") await runPortChangeCron();
        else logger.warn({ cronType }, "Unknown cron type");
      } catch (err) {
        logger.error({ err, cronType }, "Manual cron run failed");
      }
    });
  } catch (err) {
    req.log.error({ err }, "run-cron failed");
    res.status(500).json({ error: "Cron başlatılamadı" });
  }
});

// ─── Public: Competitor Check ─────────────────────────────────────────────────

router.post("/public/competitor-check", async (req, res) => {
  try {
    const { ownDomain, competitorDomain, email, company } = req.body as {
      ownDomain: string;
      competitorDomain: string;
      email?: string;
      company?: string;
    };
    if (!ownDomain?.trim() || !competitorDomain?.trim()) {
      res.status(400).json({ error: "ownDomain ve competitorDomain zorunlu" }); return;
    }

    const result = await handleCompetitorCheck({
      ownDomain: ownDomain.trim().toLowerCase().replace(/^https?:\/\//, ""),
      competitorDomain: competitorDomain.trim().toLowerCase().replace(/^https?:\/\//, ""),
      email: email?.trim(),
      company: company?.trim(),
    });

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "competitor-check failed");
    res.status(500).json({ error: "Karşılaştırma başarısız" });
  }
});

// ─── Public: Benchmark Download ───────────────────────────────────────────────

router.post("/public/benchmark-download", async (req, res) => {
  try {
    const { sector, visitorName, visitorEmail, visitorCompany, visitorDomain, reportPeriod } = req.body as {
      sector: string;
      visitorName?: string;
      visitorEmail: string;
      visitorCompany?: string;
      visitorDomain?: string;
      reportPeriod?: string;
    };
    if (!sector || !visitorEmail?.trim()) {
      res.status(400).json({ error: "sector ve visitorEmail zorunlu" }); return;
    }

    await handleBenchmarkDownload({ sector, visitorName, visitorEmail, visitorCompany, visitorDomain, reportPeriod });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "benchmark-download failed");
    res.status(500).json({ error: "Kayıt başarısız" });
  }
});

export default router;
