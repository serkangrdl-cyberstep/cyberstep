import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAdmin } from "../admin-panel/middleware";
import { createInvoice, generateInvoicePDF, syncInvoiceToAccounting } from "../../services/invoice";
import { sendMail } from "../../services/email";
import { logger } from "../../lib/logger";
import crypto from "crypto";

const router = Router();

function custId(req: Request): number | undefined {
  return (req as Request & { session?: { customerId?: number } }).session?.["customerId"];
}

// ── Stats (MUST be before /:id) ───────────────────────────────────────────────
router.get("/api/invoices/stats", requireAdmin, async (_req, res: Response) => {
  const ms = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const rows = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE created_at >= ${ms})::int AS this_month_count,
      COALESCE(SUM(total_tl) FILTER (WHERE created_at >= ${ms}), 0) AS this_month_total,
      COALESCE(SUM(total_tl) FILTER (WHERE status='paid' AND paid_at >= ${ms}), 0) AS this_month_collected,
      COALESCE(SUM(total_tl) FILTER (WHERE status IN ('pending','overdue')), 0) AS total_outstanding,
      COALESCE(SUM(total_tl) FILTER (WHERE status='overdue'), 0) AS overdue_total,
      COUNT(*) FILTER (WHERE status='overdue')::int AS overdue_count
    FROM enterprise_invoices
  `);
  res.json((rows as { rows: unknown[] }).rows[0] ?? {});
});

router.get("/api/invoices/overdue", requireAdmin, async (_req, res: Response) => {
  const today = new Date().toISOString().split("T")[0];
  const rows = await db.execute(sql`
    SELECT * FROM enterprise_invoices
    WHERE due_date <= ${today!} AND status IN ('pending','overdue')
    ORDER BY due_date ASC
  `);
  res.json((rows as { rows: unknown[] }).rows);
});

// ── List ──────────────────────────────────────────────────────────────────────
router.get("/api/invoices", requireAdmin, async (req: Request, res: Response) => {
  const { status, customerId, search, limit = "100", offset = "0" } = req.query as Record<string, string>;
  let where = "1=1";
  if (status) where += ` AND status = '${status.replace(/'/g, "''")}'`;
  if (customerId) where += ` AND customer_id = ${parseInt(customerId)}`;
  if (search) where += ` AND (customer_name ILIKE '%${search.replace(/'/g, "''")}%' OR full_invoice_number ILIKE '%${search.replace(/'/g, "''")}%')`;
  const rows = await db.execute(
    sql.raw(`SELECT * FROM enterprise_invoices WHERE ${where} ORDER BY created_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`)
  );
  res.json((rows as { rows: unknown[] }).rows);
});

// ── Pay link (public, before /:id) ────────────────────────────────────────────
router.get("/api/invoices/pay/:token", async (req: Request, res: Response) => {
  const token = String(req.params["token"] ?? "");
  const rows = await db.execute(sql`SELECT id, full_invoice_number, invoice_number, total_tl, customer_name, status, due_date FROM enterprise_invoices WHERE payment_token = ${token}`);
  const inv = (rows as { rows: Record<string, unknown>[] }).rows[0];
  if (!inv) return void res.status(404).json({ error: "Geçersiz link" });
  res.json(inv);
});

// ── Single ────────────────────────────────────────────────────────────────────
router.get("/api/invoices/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const rows = await db.execute(sql`SELECT * FROM enterprise_invoices WHERE id = ${id}`);
  const row = (rows as { rows: unknown[] }).rows[0];
  if (!row) return void res.status(404).json({ error: "Bulunamadı" });
  res.json(row);
});

// ── Create ────────────────────────────────────────────────────────────────────
router.post("/api/invoices", requireAdmin, async (req: Request, res: Response) => {
  try {
    const inv = await createInvoice(req.body as Parameters<typeof createInvoice>[0]);
    const settings = await db.execute(sql`SELECT auto_sync_on_create FROM accounting_settings WHERE id = 1`);
    const s = (settings as { rows: Record<string, unknown>[] }).rows[0];
    if (s?.["auto_sync_on_create"]) syncInvoiceToAccounting(Number(inv["id"])).catch(() => {});
    res.status(201).json(inv);
  } catch (err) {
    logger.error({ err }, "Invoice create failed");
    res.status(500).json({ error: "Fatura oluşturulamadı" });
  }
});

// ── Update ────────────────────────────────────────────────────────────────────
router.put("/api/invoices/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const { notes, dueDate, status, customerName, customerTaxId, customerTaxOffice, customerAddress, billingEmail } = req.body as Record<string, string>;
  await db.execute(sql`
    UPDATE enterprise_invoices SET
      notes = COALESCE(${notes ?? null}, notes),
      due_date = COALESCE(${dueDate ?? null}, due_date),
      status = COALESCE(${status ?? null}, status),
      customer_name = COALESCE(${customerName ?? null}, customer_name),
      customer_tax_id = COALESCE(${customerTaxId ?? null}, customer_tax_id),
      customer_tax_office = COALESCE(${customerTaxOffice ?? null}, customer_tax_office),
      customer_address = COALESCE(${customerAddress ?? null}, customer_address),
      billing_email = COALESCE(${billingEmail ?? null}, billing_email)
    WHERE id = ${id}
  `);
  res.json({ ok: true });
});

// ── PDF ───────────────────────────────────────────────────────────────────────
router.get("/api/invoices/:id/pdf", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const rows = await db.execute(sql`SELECT * FROM enterprise_invoices WHERE id = ${id}`);
  const inv = (rows as { rows: Record<string, unknown>[] }).rows[0];
  if (!inv) return void res.status(404).json({ error: "Bulunamadı" });
  try {
    const pdf = await generateInvoicePDF(inv);
    const num = String(inv["full_invoice_number"] ?? inv["invoice_number"] ?? id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${num}.pdf"`);
    res.send(pdf);
  } catch (err) {
    logger.error({ err }, "PDF gen failed");
    res.status(500).json({ error: "PDF oluşturulamadı" });
  }
});

// ── Send ──────────────────────────────────────────────────────────────────────
router.post("/api/invoices/:id/send", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const rows = await db.execute(sql`SELECT * FROM enterprise_invoices WHERE id = ${id}`);
  const inv = (rows as { rows: Record<string, unknown>[] }).rows[0];
  if (!inv) return void res.status(404).json({ error: "Bulunamadı" });
  const to = String(inv["billing_email"] ?? inv["customer_email"] ?? "");
  if (!to) return void res.status(400).json({ error: "E-posta adresi yok" });
  try {
    const pdf = await generateInvoicePDF(inv);
    const num = String(inv["full_invoice_number"] ?? inv["invoice_number"]);
    await sendMail({ to, subject: `CyberStep Fatura: ${num}`, html: invEmailHtml(inv), attachments: [{ filename: `${num}.pdf`, content: pdf, contentType: "application/pdf" }] });
    await db.execute(sql`UPDATE enterprise_invoices SET sent_at = now() WHERE id = ${id}`);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Invoice send failed");
    res.status(500).json({ error: "E-posta gönderilemedi" });
  }
});

// ── Mark paid ─────────────────────────────────────────────────────────────────
router.post("/api/invoices/:id/mark-paid", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const rows = await db.execute(sql`SELECT total_tl FROM enterprise_invoices WHERE id = ${id}`);
  const inv = (rows as { rows: Record<string, unknown>[] }).rows[0];
  if (!inv) return void res.status(404).json({ error: "Bulunamadı" });
  await db.execute(sql`UPDATE enterprise_invoices SET status='paid', paid_at=now(), paid_amount_tl=${String(inv["total_tl"])} WHERE id=${id}`);
  const s = (await db.execute(sql`SELECT auto_sync_on_paid FROM accounting_settings WHERE id=1`) as { rows: Record<string, unknown>[] }).rows[0];
  if (s?.["auto_sync_on_paid"]) syncInvoiceToAccounting(id).catch(() => {});
  res.json({ ok: true });
});

// ── Cancel ────────────────────────────────────────────────────────────────────
router.post("/api/invoices/:id/cancel", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  await db.execute(sql`UPDATE enterprise_invoices SET status='cancelled' WHERE id=${id}`);
  const s = (await db.execute(sql`SELECT auto_sync_on_cancel FROM accounting_settings WHERE id=1`) as { rows: Record<string, unknown>[] }).rows[0];
  if (s?.["auto_sync_on_cancel"]) syncInvoiceToAccounting(id).catch(() => {});
  res.json({ ok: true });
});

// ── Send reminder ─────────────────────────────────────────────────────────────
router.post("/api/invoices/:id/send-reminder", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const { reminderNumber = 1 } = req.body as { reminderNumber?: number };
  const rows = await db.execute(sql`SELECT * FROM enterprise_invoices WHERE id = ${id}`);
  const inv = (rows as { rows: Record<string, unknown>[] }).rows[0];
  if (!inv) return void res.status(404).json({ error: "Bulunamadı" });
  const to = String(inv["billing_email"] ?? inv["customer_email"] ?? "");
  if (!to) return void res.status(400).json({ error: "E-posta adresi yok" });
  const num = String(inv["full_invoice_number"] ?? inv["invoice_number"]);
  const subjects: Record<number, string> = { 1: `Hatırlatma: ${num}`, 2: `Acil: ${num} — Vadesi geçti`, 3: `Son Uyarı: ${num} — Servis askıya alınacak` };
  await sendMail({ to, subject: subjects[reminderNumber] ?? subjects[1]!, html: reminderHtml(String(inv["customer_name"]), num, Number(inv["total_tl"]), String(inv["due_date"]), reminderNumber) });
  const cols = ["reminder_1_sent_at", "reminder_2_sent_at", "reminder_3_sent_at"];
  const col = cols[reminderNumber - 1] ?? cols[0]!;
  await db.execute(sql`UPDATE enterprise_invoices SET reminder_1_sent_at = CASE WHEN ${col} = 'reminder_1_sent_at' THEN now() ELSE reminder_1_sent_at END, reminder_2_sent_at = CASE WHEN ${col} = 'reminder_2_sent_at' THEN now() ELSE reminder_2_sent_at END, reminder_3_sent_at = CASE WHEN ${col} = 'reminder_3_sent_at' THEN now() ELSE reminder_3_sent_at END WHERE id = ${id}`);
  res.json({ ok: true });
});

// ── Regenerate payment token ──────────────────────────────────────────────────
router.post("/api/invoices/:id/regenerate-token", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const token = crypto.randomBytes(32).toString("hex");
  await db.execute(sql`UPDATE enterprise_invoices SET payment_token=${token} WHERE id=${id}`);
  res.json({ token });
});

// ── Customer portal: invoices ─────────────────────────────────────────────────
router.get("/api/portal/invoices", async (req: Request, res: Response) => {
  const cid = custId(req);
  if (!cid) return void res.status(401).json({ error: "Giriş yapmanız gerekiyor" });
  const rows = await db.execute(sql`SELECT id,full_invoice_number,invoice_number,total_tl,status,due_date,paid_at,created_at FROM enterprise_invoices WHERE customer_id = ${cid} ORDER BY created_at DESC`);
  res.json((rows as { rows: unknown[] }).rows);
});

router.get("/api/portal/invoices/:id/pdf", async (req: Request, res: Response) => {
  const cid = custId(req);
  if (!cid) return void res.status(401).json({ error: "Giriş yapmanız gerekiyor" });
  const id = parseInt(String(req.params["id"] ?? "0"));
  const rows = await db.execute(sql`SELECT * FROM enterprise_invoices WHERE id = ${id} AND customer_id = ${cid}`);
  const inv = (rows as { rows: Record<string, unknown>[] }).rows[0];
  if (!inv) return void res.status(404).json({ error: "Bulunamadı" });
  const pdf = await generateInvoicePDF(inv);
  const num = String(inv["full_invoice_number"] ?? inv["invoice_number"] ?? id);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${num}.pdf"`);
  res.send(pdf);
});

function invEmailHtml(inv: Record<string, unknown>): string {
  const total = Number(inv["total_tl"] ?? 0);
  const num = inv["full_invoice_number"] ?? inv["invoice_number"];
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
<h1 style="color:#060D1A;">CyberStep.io Fatura</h1>
<p>Sayın ${inv["customer_name"] ?? "Müşteri"},</p>
<p>${num} numaralı faturanız ekte yer almaktadır.</p>
<div style="background:#F8FAFF;border-radius:8px;padding:16px;margin:20px 0;border-left:4px solid #00A8CC;">
<p style="margin:4px 0;"><strong>Fatura No:</strong> ${num}</p>
<p style="margin:4px 0;"><strong>Tutar:</strong> ₺${total.toLocaleString("tr-TR",{minimumFractionDigits:2})}</p>
<p style="margin:4px 0;"><strong>Vade:</strong> ${inv["due_date"] ? new Date(String(inv["due_date"])).toLocaleDateString("tr-TR") : "-"}</p>
</div>
<p>Havale açıklamasına fatura numarasını yazmayı unutmayın.</p>
<hr style="border:none;border-top:1px solid #E8EDF5;"><p style="color:#A0AEC0;font-size:11px;">CyberStep.io</p></div>`;
}

function reminderHtml(name: string, num: string, total: number, dueDate: string, n: number): string {
  const tones: Record<number, string> = { 1: "Ödemenizin vadesi geçti. Gözden kaçmış olabilir.", 2: "Ödemeniz gecikmiş durumda. Lütfen işlem yapın.", 3: "Son uyarıdır. 48 saat içinde servisiniz askıya alınacaktır." };
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
<h2 style="color:#060D1A;">Ödeme Hatırlatması</h2>
<p>Sayın ${name},</p><p>${tones[n] ?? tones[1]}</p>
<div style="background:#FFF8F0;border-radius:8px;padding:16px;border-left:4px solid #FC8181;margin:20px 0;">
<p style="margin:4px 0;"><strong>Fatura No:</strong> ${num}</p>
<p style="margin:4px 0;"><strong>Tutar:</strong> ₺${total.toLocaleString("tr-TR",{minimumFractionDigits:2})}</p>
<p style="margin:4px 0;"><strong>Vade Tarihi:</strong> ${dueDate ? new Date(dueDate).toLocaleDateString("tr-TR") : "-"}</p>
</div>
<hr style="border:none;border-top:1px solid #E8EDF5;"><p style="color:#A0AEC0;font-size:11px;">CyberStep.io</p></div>`;
}

export default router;
