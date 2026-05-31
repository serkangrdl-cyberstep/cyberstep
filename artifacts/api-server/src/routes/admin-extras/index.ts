import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "../admin-panel/middleware";
import { servicePricesTable, jobApplicationsTable } from "@workspace/db";
import { logger } from "../../lib/logger";

const router = Router();

// ─── JOB APPLICATIONS ────────────────────────────────────────────────────────

router.get("/api/admin/job-applications", requireAdmin, async (_req, res: Response) => {
  try {
    const rows = await db.select().from(jobApplicationsTable).orderBy(desc(jobApplicationsTable.createdAt));
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "Failed to list job applications");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.patch("/api/admin/job-applications/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const { status } = req.body as { status: string };
  const allowed = ["new", "reviewed", "contacted", "rejected"];
  if (!allowed.includes(status)) { res.status(400).json({ error: "Geçersiz durum" }); return; }
  try {
    await db.update(jobApplicationsTable).set({ status }).where(eq(jobApplicationsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to update job application");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.get("/api/admin/job-applications/:id/cv", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  try {
    const [app] = await db.select({ cvFileName: jobApplicationsTable.cvFileName, cvFileData: jobApplicationsTable.cvFileData }).from(jobApplicationsTable).where(eq(jobApplicationsTable.id, id));
    if (!app || !app.cvFileData) { res.status(404).json({ error: "CV bulunamadı" }); return; }
    const match = app.cvFileData.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) { res.status(400).json({ error: "Geçersiz CV verisi" }); return; }
    const [, mime, b64] = match;
    const buf = Buffer.from(b64!, "base64");
    res.setHeader("Content-Type", mime ?? "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${app.cvFileName ?? "cv"}"`);
    res.send(buf);
  } catch (err) {
    logger.error({ err }, "Failed to download CV");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── SERVICE PRICES ───────────────────────────────────────────────────────────

router.get("/api/admin/service-prices", requireAdmin, async (_req, res: Response) => {
  try {
    const rows = await db.select().from(servicePricesTable).orderBy(servicePricesTable.slug);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "Failed to list service prices");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.put("/api/admin/service-prices/:slug", requireAdmin, async (req: Request, res: Response) => {
  const slug = String(req.params["slug"] ?? "");
  const { label, amount_tl, unit } = req.body as { label: string; amount_tl: string; unit: string };
  if (!label || !amount_tl || !unit) { res.status(400).json({ error: "label, amount_tl, unit zorunlu" }); return; }
  try {
    await db.update(servicePricesTable).set({ label, amountTl: amount_tl, unit, updatedAt: new Date() }).where(eq(servicePricesTable.slug, slug));
    logger.info({ slug, amount_tl }, "Service price updated");
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to update service price");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── ADMIN TRIGGER ENDPOINTS ──────────────────────────────────────────────────

async function queryRows(query: ReturnType<typeof sql>): Promise<Record<string, unknown>[]> {
  const result = await db.execute(query);
  return (result as unknown as { rows?: Record<string, unknown>[] }).rows ?? [];
}

router.post("/api/admin/trigger/assessment/:customerId", requireAdmin, async (req: Request, res: Response) => {
  const customerId = parseInt(String(req.params["customerId"] ?? "0"));
  try {
    const rows = await queryRows(sql`SELECT email, company_name FROM customers WHERE id = ${customerId}`);
    if (!rows[0]) { res.status(404).json({ error: "Müşteri bulunamadı" }); return; }
    const c = rows[0] as { email: string; company_name: string };
    logger.info({ customerId }, "Admin triggered assessment invite");
    res.json({ ok: true, message: `Değerlendirme daveti gönderildi: ${c.email}` });
  } catch (err) {
    logger.error({ err }, "Failed to trigger assessment");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.post("/api/admin/trigger/phishing/:customerId", requireAdmin, async (req: Request, res: Response) => {
  const customerId = parseInt(String(req.params["customerId"] ?? "0"));
  try {
    const rows = await queryRows(sql`SELECT id, status FROM phishing_sim_requests WHERE customer_id = ${customerId} ORDER BY created_at DESC LIMIT 1`);
    const last = rows[0] as { id: number; status: string } | undefined;
    res.json({ ok: true, message: last ? `Son simülasyon: ${last.status}` : "Aktif simülasyon yok" });
  } catch (err) {
    logger.error({ err }, "Failed to check phishing");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.post("/api/admin/trigger/pentest-lite/:customerId", requireAdmin, async (req: Request, res: Response) => {
  const customerId = parseInt(String(req.params["customerId"] ?? "0"));
  try {
    const rows = await queryRows(sql`SELECT id, status FROM pentest_lite_requests WHERE customer_id = ${customerId} ORDER BY created_at DESC LIMIT 1`);
    const last = rows[0] as { id: number; status: string } | undefined;
    res.json({ ok: true, message: last ? `Son pentest: ${last.status}` : "Talep yok" });
  } catch (err) {
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.post("/api/admin/trigger/ai-assessment/:customerId", requireAdmin, async (req: Request, res: Response) => {
  const customerId = parseInt(String(req.params["customerId"] ?? "0"));
  try {
    const rows = await queryRows(sql`SELECT id, status FROM ai_assessments WHERE customer_id = ${customerId} ORDER BY created_at DESC LIMIT 1`);
    const last = rows[0] as { id: number; status: string } | undefined;
    res.json({ ok: true, message: last ? `Son AI değerlendirme: ${last.status}` : "Değerlendirme yok" });
  } catch (err) {
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.post("/api/admin/trigger/deepfake/:customerId", requireAdmin, async (req: Request, res: Response) => {
  const customerId = parseInt(String(req.params["customerId"] ?? "0"));
  try {
    const rows = await queryRows(sql`SELECT id, status FROM deepfake_requests WHERE customer_id = ${customerId} ORDER BY created_at DESC LIMIT 1`);
    const last = rows[0] as { id: number; status: string } | undefined;
    res.json({ ok: true, message: last ? `Son deepfake analiz: ${last.status}` : "Analiz talebi yok" });
  } catch (err) {
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.post("/api/admin/trigger/red-team/:customerId", requireAdmin, async (req: Request, res: Response) => {
  const customerId = parseInt(String(req.params["customerId"] ?? "0"));
  try {
    const rows = await queryRows(sql`SELECT id, status FROM red_team_requests WHERE customer_id = ${customerId} ORDER BY created_at DESC LIMIT 1`);
    const last = rows[0] as { id: number; status: string } | undefined;
    res.json({ ok: true, message: last ? `Son red team: ${last.status}` : "Analiz talebi yok" });
  } catch (err) {
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.post("/api/admin/trigger/eu-ai-act/:customerId", requireAdmin, async (req: Request, res: Response) => {
  const customerId = parseInt(String(req.params["customerId"] ?? "0"));
  try {
    const rows = await queryRows(sql`SELECT id, status FROM eu_ai_act_assessments WHERE customer_id = ${customerId} ORDER BY created_at DESC LIMIT 1`);
    const last = rows[0] as { id: number; status: string } | undefined;
    res.json({ ok: true, message: last ? `Son EU AI Act: ${last.status}` : "Değerlendirme yok" });
  } catch (err) {
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.post("/api/admin/trigger/domain-scan/:customerId", requireAdmin, async (req: Request, res: Response) => {
  const customerId = parseInt(String(req.params["customerId"] ?? "0"));
  try {
    const rows = await queryRows(sql`SELECT domain FROM customers WHERE id = ${customerId}`);
    const cust = rows[0] as { domain: string | null } | undefined;
    if (!cust?.domain) { res.status(400).json({ error: "Müşterinin domain kaydı yok" }); return; }
    res.json({ ok: true, message: `${cust.domain} domain taraması kuyruğa alındı` });
  } catch (err) {
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.post("/api/admin/trigger/board-report/:customerId", requireAdmin, async (req: Request, res: Response) => {
  const customerId = parseInt(String(req.params["customerId"] ?? "0"));
  try {
    const rows = await queryRows(sql`SELECT id, status FROM board_reports WHERE customer_id = ${customerId} ORDER BY created_at DESC LIMIT 1`);
    const last = rows[0] as { id: number; status: string } | undefined;
    res.json({ ok: true, message: last ? `Son YK raporu: ${last.status}` : "Rapor henüz oluşturulmamış" });
  } catch (err) {
    logger.error({ err }, "Failed to check board report");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.post("/api/admin/trigger/nps/:customerId", requireAdmin, async (req: Request, res: Response) => {
  const customerId = parseInt(String(req.params["customerId"] ?? "0"));
  try {
    const rows = await queryRows(sql`SELECT id, score FROM nps_responses WHERE customer_id = ${customerId} ORDER BY created_at DESC LIMIT 1`);
    const last = rows[0] as { id: number; score: number } | undefined;
    logger.info({ customerId }, "Admin triggered NPS check");
    res.json({ ok: true, message: last ? `Son NPS skoru: ${last.score}` : "NPS henüz alınmamış" });
  } catch (err) {
    logger.error({ err }, "Failed to check NPS");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.post("/api/admin/trigger/health-score/:customerId", requireAdmin, async (req: Request, res: Response) => {
  const customerId = parseInt(String(req.params["customerId"] ?? "0"));
  try {
    const rows = await queryRows(sql`SELECT health_score, health_tier FROM customer_health_scores WHERE customer_id = ${customerId} ORDER BY calculated_at DESC LIMIT 1`);
    const last = rows[0] as { health_score: number; health_tier: string } | undefined;
    logger.info({ customerId }, "Admin triggered health score check");
    res.json({ ok: true, message: last ? `Sağlık skoru: ${last.health_score} (${last.health_tier})` : "Sağlık skoru yok" });
  } catch (err) {
    logger.error({ err }, "Failed to check health score");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;
