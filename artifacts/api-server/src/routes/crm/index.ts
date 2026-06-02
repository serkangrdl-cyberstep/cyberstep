import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAdmin } from "../admin-panel/middleware";
import { sendMail } from "../../services/email";
import { logger } from "../../lib/logger";
import crypto from "crypto";

const router = Router();

// ─── TAGS ─────────────────────────────────────────────────────────────────────

router.get("/api/crm/tags", requireAdmin, async (_req, res: Response) => {
  const rows = await db.execute(sql`SELECT ct.*, COUNT(cta.customer_id)::int AS usage_count FROM customer_tags ct LEFT JOIN customer_tag_assignments cta ON cta.tag_id=ct.id GROUP BY ct.id ORDER BY ct.name`);
  res.json((rows as { rows: unknown[] }).rows);
});

router.post("/api/crm/tags", requireAdmin, async (req: Request, res: Response) => {
  const { name, color, description } = req.body as Record<string, string>;
  if (!name) return void res.status(400).json({ error: "Ad gerekli" });
  try {
    const r = await db.execute(sql`INSERT INTO customer_tags (name,color,description) VALUES (${name},${color ?? "#7B8FAF"},${description ?? null}) RETURNING *`);
    res.status(201).json((r as { rows: unknown[] }).rows[0]);
  } catch { res.status(400).json({ error: "Bu etiket zaten mevcut" }); }
});

router.put("/api/crm/tags/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const { name, color, description } = req.body as Record<string, string>;
  await db.execute(sql`UPDATE customer_tags SET name=COALESCE(${name ?? null},name), color=COALESCE(${color ?? null},color), description=COALESCE(${description ?? null},description) WHERE id=${id}`);
  res.json({ ok: true });
});

router.delete("/api/crm/tags/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  await db.execute(sql`DELETE FROM customer_tag_assignments WHERE tag_id = ${id}`);
  await db.execute(sql`DELETE FROM customer_tags WHERE id = ${id}`);
  res.json({ ok: true });
});

router.get("/api/crm/customers/:id/tags", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const rows = await db.execute(sql`SELECT ct.* FROM customer_tags ct JOIN customer_tag_assignments cta ON cta.tag_id=ct.id WHERE cta.customer_id=${id} ORDER BY ct.name`);
  res.json((rows as { rows: unknown[] }).rows);
});

router.post("/api/crm/customers/:id/tags", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const { tagId, assignedBy } = req.body as { tagId: number; assignedBy?: string };
  await db.execute(sql`INSERT INTO customer_tag_assignments (customer_id,tag_id,assigned_by) VALUES (${id},${tagId},${assignedBy ?? "admin"}) ON CONFLICT DO NOTHING`);
  res.json({ ok: true });
});

router.delete("/api/crm/customers/:id/tags/:tagId", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const tagId = parseInt(String(req.params["tagId"] ?? "0"));
  await db.execute(sql`DELETE FROM customer_tag_assignments WHERE customer_id=${id} AND tag_id=${tagId}`);
  res.json({ ok: true });
});

// ─── CUSTOMER 360 ─────────────────────────────────────────────────────────────

router.get("/api/crm/customers", requireAdmin, async (req: Request, res: Response) => {
  const { search, tag, plan, cust_status, limit = "100", offset = "0" } = req.query as Record<string, string>;
  let where = "1=1";
  if (search) where += ` AND (c.full_name ILIKE '%${search.replace(/'/g,"")}%' OR c.company_name ILIKE '%${search.replace(/'/g,"")}%' OR c.email ILIKE '%${search.replace(/'/g,"")}%')`;
  if (plan) where += ` AND c.plan='${plan.replace(/'/g,"")}'`;
  if (cust_status) where += ` AND c.cust_status='${cust_status.replace(/'/g,"")}'`;
  let tagJoin = "";
  if (tag) {
    tagJoin = `JOIN customer_tag_assignments cta ON cta.customer_id=c.id JOIN customer_tags ct ON ct.id=cta.tag_id AND ct.name='${tag.replace(/'/g,"")}'`;
  }
  const rows = await db.execute(sql.raw(
    `SELECT DISTINCT c.* FROM customers c ${tagJoin} WHERE ${where} ORDER BY c.created_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`
  ));
  res.json((rows as { rows: unknown[] }).rows);
});

router.get("/api/crm/customers/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const [cRows, tagRows, taskRows, invRows, npsRows, healthRows] = await Promise.all([
    db.execute(sql`SELECT * FROM customers WHERE id = ${id}`),
    db.execute(sql`SELECT ct.* FROM customer_tags ct JOIN customer_tag_assignments cta ON cta.tag_id=ct.id WHERE cta.customer_id=${id}`),
    db.execute(sql`SELECT * FROM crm_tasks WHERE customer_id=${id} AND task_type!='note' ORDER BY created_at DESC LIMIT 20`),
    db.execute(sql`SELECT id,full_invoice_number,invoice_number,total_tl,status,due_date,paid_at,created_at FROM enterprise_invoices WHERE customer_id=${id} ORDER BY created_at DESC LIMIT 10`),
    db.execute(sql`SELECT id,score,category,sent_at,responded_at,feedback_text FROM nps_surveys WHERE customer_id=${id} ORDER BY created_at DESC LIMIT 5`),
    db.execute(sql`SELECT health_score,risk_level,calculated_at FROM customer_health_scores WHERE customer_id=${id} ORDER BY calculated_at DESC LIMIT 1`).catch(() => ({ rows: [] })),
  ]);
  const customer = (cRows as { rows: Record<string, unknown>[] }).rows[0];
  if (!customer) return void res.status(404).json({ error: "Bulunamadı" });
  res.json({
    ...customer,
    tags: (tagRows as { rows: unknown[] }).rows,
    tasks: (taskRows as { rows: unknown[] }).rows,
    invoices: (invRows as { rows: unknown[] }).rows,
    nps: (npsRows as { rows: unknown[] }).rows,
    health: (healthRows as { rows: unknown[] }).rows[0] ?? null,
  });
});

router.patch("/api/crm/customers/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const body = req.body as Record<string, unknown>;
  const allowed = ["billing_name","billing_tax_id","billing_tax_office","billing_address","billing_email","billing_phone","payment_terms","assigned_to","sector","employee_count","phone","website","city","plan","cust_status","full_name","company_name","notes"];
  const updates = Object.entries(body).filter(([k]) => allowed.includes(k));
  if (!updates.length) return void res.status(400).json({ error: "Güncellenecek alan yok" });
  const setClauses = updates.map(([k, v]) => sql.raw(`${k} = `).append(sql`${v}`));
  const setFragment = setClauses.reduce((acc, clause) => acc.append(sql`, `).append(clause));
  await db.execute(sql`UPDATE customers SET `.append(setFragment).append(sql`, updated_at = now() WHERE id = ${id}`));
  res.json({ ok: true });
});

// Customer notes
router.get("/api/crm/customers/:id/notes", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const rows = await db.execute(sql`SELECT * FROM crm_tasks WHERE customer_id=${id} AND task_type='note' ORDER BY created_at DESC`);
  res.json((rows as { rows: unknown[] }).rows);
});

router.post("/api/crm/customers/:id/notes", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const { description, createdBy } = req.body as Record<string, string>;
  const r = await db.execute(sql`INSERT INTO crm_tasks (customer_id,title,description,task_type,status,created_by) VALUES (${id},'Not',${description},'note','completed',${createdBy ?? "admin"}) RETURNING *`);
  res.status(201).json((r as { rows: unknown[] }).rows[0]);
});

// ─── TASKS ────────────────────────────────────────────────────────────────────

router.get("/api/crm/tasks/today", requireAdmin, async (_req, res: Response) => {
  const today = new Date().toISOString().split("T")[0];
  const rows = await db.execute(sql`
    SELECT t.*, c.full_name AS customer_full_name, c.company_name AS customer_company
    FROM crm_tasks t LEFT JOIN customers c ON c.id = t.customer_id
    WHERE t.status='open' AND (t.due_date <= ${today!} OR t.due_date IS NULL) AND t.task_type!='note'
    ORDER BY CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, t.due_date ASC NULLS LAST
    LIMIT 50
  `);
  res.json((rows as { rows: unknown[] }).rows);
});

router.get("/api/crm/tasks", requireAdmin, async (req: Request, res: Response) => {
  const { status, customerId, assignedTo, taskType, priority } = req.query as Record<string, string>;
  const conds: string[] = ["t.task_type != 'note'"];
  if (status) conds.push(`t.status='${status.replace(/'/g,"")}'`);
  if (customerId) conds.push(`t.customer_id=${parseInt(customerId)}`);
  if (assignedTo) conds.push(`t.assigned_to='${assignedTo.replace(/'/g,"")}'`);
  if (taskType) conds.push(`t.task_type='${taskType.replace(/'/g,"")}'`);
  if (priority) conds.push(`t.priority='${priority.replace(/'/g,"")}'`);
  const rows = await db.execute(sql.raw(
    `SELECT t.*, c.full_name AS customer_full_name, c.company_name AS customer_company
     FROM crm_tasks t LEFT JOIN customers c ON c.id = t.customer_id
     WHERE ${conds.join(" AND ")} ORDER BY CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, t.due_date ASC NULLS LAST, t.created_at DESC LIMIT 200`
  ));
  res.json((rows as { rows: unknown[] }).rows);
});

router.post("/api/crm/tasks", requireAdmin, async (req: Request, res: Response) => {
  const { customerId, title, description, taskType, priority, dueDate, dueTime, assignedTo, createdBy } = req.body as Record<string, string>;
  if (!title) return void res.status(400).json({ error: "Başlık gerekli" });
  const r = await db.execute(sql`
    INSERT INTO crm_tasks (customer_id,title,description,task_type,priority,due_date,due_time,assigned_to,created_by)
    VALUES (${customerId ? Number(customerId) : null},${title},${description ?? null},${taskType ?? "general"},${priority ?? "medium"},${dueDate ?? null},${dueTime ?? null},${assignedTo ?? null},${createdBy ?? "admin"})
    RETURNING *
  `);
  res.status(201).json((r as { rows: unknown[] }).rows[0]);
});

router.put("/api/crm/tasks/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const { title, description, taskType, priority, dueDate, assignedTo, status, completionNote, completedBy } = req.body as Record<string, string>;
  await db.execute(sql`
    UPDATE crm_tasks SET
      title=COALESCE(${title ?? null},title), description=COALESCE(${description ?? null},description),
      task_type=COALESCE(${taskType ?? null},task_type), priority=COALESCE(${priority ?? null},priority),
      due_date=COALESCE(${dueDate ?? null},due_date), assigned_to=COALESCE(${assignedTo ?? null},assigned_to),
      status=COALESCE(${status ?? null},status), completion_note=COALESCE(${completionNote ?? null},completion_note),
      completed_at=CASE WHEN ${status ?? null}='completed' THEN now() ELSE completed_at END,
      completed_by=CASE WHEN ${status ?? null}='completed' THEN ${completedBy ?? "admin"} ELSE completed_by END
    WHERE id=${id}
  `);
  res.json({ ok: true });
});

router.delete("/api/crm/tasks/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  await db.execute(sql`DELETE FROM crm_tasks WHERE id=${id}`);
  res.json({ ok: true });
});

// ─── NPS ──────────────────────────────────────────────────────────────────────

router.get("/api/crm/nps/stats", requireAdmin, async (_req, res: Response) => {
  const rows = await db.execute(sql`
    SELECT COUNT(*)::int AS total_sent, COUNT(score)::int AS total_responded,
      ROUND(AVG(score)::numeric,1) AS avg_score,
      COUNT(*) FILTER (WHERE category='promoter')::int AS promoters,
      COUNT(*) FILTER (WHERE category='passive')::int AS passives,
      COUNT(*) FILTER (WHERE category='detractor')::int AS detractors,
      ROUND((COUNT(*) FILTER (WHERE category='promoter')::decimal - COUNT(*) FILTER (WHERE category='detractor')::decimal) / NULLIF(COUNT(*) FILTER (WHERE score IS NOT NULL),0)*100,1) AS nps_score
    FROM nps_surveys
  `);
  res.json((rows as { rows: unknown[] }).rows[0] ?? {});
});

router.get("/api/crm/nps", requireAdmin, async (_req, res: Response) => {
  const rows = await db.execute(sql`
    SELECT n.*, c.full_name, c.company_name, c.email FROM nps_surveys n
    LEFT JOIN customers c ON c.id=n.customer_id ORDER BY n.created_at DESC LIMIT 200
  `);
  res.json((rows as { rows: unknown[] }).rows);
});

router.post("/api/crm/nps/send", requireAdmin, async (req: Request, res: Response) => {
  const { customerId } = req.body as { customerId: number };
  const cr = await db.execute(sql`SELECT * FROM customers WHERE id=${customerId} LIMIT 1`);
  const c = (cr as { rows: Record<string, unknown>[] }).rows[0];
  if (!c) return void res.status(404).json({ error: "Müşteri bulunamadı" });
  const token = crypto.randomBytes(32).toString("hex");
  await db.execute(sql`INSERT INTO nps_surveys (customer_id,survey_token,trigger_type,sent_at) VALUES (${customerId},${token},'manual',now())`);
  const base = process.env["REPLIT_DOMAINS"] ? `https://${process.env["REPLIT_DOMAINS"]!.split(",")[0]!.trim()}` : "http://localhost:80";
  await sendMail({ to: String(c["email"]), subject: "CyberStep hakkında görüşünüz?", html: npsEmailHtml(String(c["full_name"]), token, base) });
  res.json({ ok: true, token });
});

// Public NPS respond
router.get("/api/nps/:token", async (req: Request, res: Response) => {
  const token = String(req.params["token"] ?? "");
  const rows = await db.execute(sql`SELECT n.*, c.full_name, c.company_name FROM nps_surveys n JOIN customers c ON c.id=n.customer_id WHERE n.survey_token=${token} LIMIT 1`);
  const s = (rows as { rows: Record<string, unknown>[] }).rows[0];
  if (!s) return void res.status(404).json({ error: "Anket bulunamadı" });
  if (s["responded_at"]) return void res.json({ alreadyResponded: true });
  await db.execute(sql`UPDATE nps_surveys SET opened_at=COALESCE(opened_at,now()) WHERE survey_token=${token}`);
  res.json({ id: s["id"], customerName: s["full_name"], companyName: s["company_name"] });
});

router.post("/api/nps/:token/respond", async (req: Request, res: Response) => {
  const token = String(req.params["token"] ?? "");
  const { score, feedbackText } = req.body as { score: number; feedbackText?: string };
  if (score === undefined || score < 0 || score > 10) return void res.status(400).json({ error: "Geçersiz skor (0-10)" });
  const category = score >= 9 ? "promoter" : score >= 7 ? "passive" : "detractor";
  const rows = await db.execute(sql`UPDATE nps_surveys SET score=${score},feedback_text=${feedbackText ?? null},category=${category},responded_at=now() WHERE survey_token=${token} AND responded_at IS NULL RETURNING customer_id`);
  if ((rows as { rows: unknown[] }).rows.length === 0) return void res.status(400).json({ error: "Zaten cevaplandı" });
  res.json({ ok: true, category });
});

// ─── REVENUE / MRR ───────────────────────────────────────────────────────────

router.get("/api/crm/revenue/stats", requireAdmin, async (_req, res: Response) => {
  const [mrrRow, monthly, custRow] = await Promise.all([
    db.execute(sql`
      SELECT
        COALESCE(SUM(total_tl) FILTER (WHERE status='paid' AND paid_at >= NOW()-INTERVAL '35 days'),0) AS mrr,
        COUNT(DISTINCT customer_id) FILTER (WHERE status='paid' AND paid_at >= NOW()-INTERVAL '35 days')::int AS active_paying,
        COALESCE(SUM(total_tl) FILTER (WHERE status='paid'),0) AS total_all_time,
        COUNT(*) FILTER (WHERE status='overdue')::int AS overdue_count,
        COALESCE(SUM(total_tl) FILTER (WHERE status='overdue'),0) AS overdue_amount,
        COALESCE(SUM(total_tl) FILTER (WHERE status IN ('pending','overdue')),0) AS outstanding
      FROM enterprise_invoices
    `),
    db.execute(sql`
      SELECT TO_CHAR(DATE_TRUNC('month',created_at),'YYYY-MM') AS month,
        COALESCE(SUM(total_tl) FILTER (WHERE status='paid'),0) AS revenue,
        COALESCE(SUM(total_tl),0) AS billed,
        COUNT(*)::int AS invoice_count,
        COUNT(DISTINCT customer_id)::int AS customers
      FROM enterprise_invoices WHERE created_at >= NOW()-INTERVAL '13 months'
      GROUP BY DATE_TRUNC('month',created_at) ORDER BY month ASC
    `),
    db.execute(sql`
      SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE cust_status='active')::int AS active,
        COUNT(*) FILTER (WHERE created_at >= NOW()-INTERVAL '30 days')::int AS new_30d
      FROM customers
    `),
  ]);
  const mrr = Number((mrrRow as { rows: Record<string, unknown>[] }).rows[0]?.["mrr"] ?? 0);
  res.json({
    mrr,
    arr: mrr * 12,
    ...(mrrRow as { rows: Record<string, unknown>[] }).rows[0],
    monthlyRevenue: (monthly as { rows: unknown[] }).rows,
    customers: (custRow as { rows: unknown[] }).rows[0] ?? {},
  });
});

// ─── ACCOUNTING SETTINGS ──────────────────────────────────────────────────────

router.get("/crm/accounting", requireAdmin, async (_req, res: Response) => {
  const rows = await db.execute(sql`SELECT id,provider,webhook_url,auto_sync_on_create,auto_sync_on_paid,auto_sync_on_cancel,bank_name,bank_iban,bank_account_name,last_sync_at,error_count FROM accounting_settings WHERE id=1`);
  res.json((rows as { rows: unknown[] }).rows[0] ?? {});
});

router.put("/crm/accounting", requireAdmin, async (req: Request, res: Response) => {
  const { provider, webhookUrl, webhookSecret, bankName, bankIban, bankAccountName, autoSyncOnCreate, autoSyncOnPaid, autoSyncOnCancel } = req.body as Record<string, unknown>;
  await db.execute(sql`
    UPDATE accounting_settings SET
      provider=${String(provider ?? "none")}, webhook_url=${webhookUrl ? String(webhookUrl) : null},
      webhook_secret=${webhookSecret ? String(webhookSecret) : null},
      bank_name=${bankName ? String(bankName) : null}, bank_iban=${bankIban ? String(bankIban) : null},
      bank_account_name=${bankAccountName ? String(bankAccountName) : null},
      auto_sync_on_create=${autoSyncOnCreate !== false}, auto_sync_on_paid=${autoSyncOnPaid !== false},
      auto_sync_on_cancel=${autoSyncOnCancel !== false}, updated_at=now()
    WHERE id=1
  `);
  res.json({ ok: true });
});

router.post("/crm/accounting/test", requireAdmin, async (req: Request, res: Response) => {
  const { webhookUrl, webhookSecret } = req.body as Record<string, string>;
  if (!webhookUrl) return void res.status(400).json({ error: "Webhook URL gerekli" });
  try {
    const r = await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${webhookSecret ?? ""}` }, body: JSON.stringify({ event: "test" }) });
    res.json({ ok: r.ok, status: r.status });
  } catch (err) { res.status(400).json({ ok: false, error: String(err) }); }
});

// ─── SUBSCRIPTION LIFECYCLE ───────────────────────────────────────────────────

router.post("/api/crm/customers/:id/pause", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const { pauseUntil } = req.body as { pauseUntil?: string };
  const until = pauseUntil ? new Date(pauseUntil) : new Date(Date.now() + 30 * 86400000);
  await db.execute(sql`UPDATE customers SET cust_status='paused', paused_until=${until.toISOString()} WHERE id=${id}`);
  await db.execute(sql`INSERT INTO crm_tasks (customer_id,title,description,task_type,due_date,status,created_by) VALUES (${id},'Abonelik duraklatıldı',${`${until.toLocaleDateString("tr-TR")} tarihine kadar duraklatıldı`},'note','${until.toISOString().split("T")[0]}','completed','system')`);
  res.json({ ok: true, pausedUntil: until });
});

router.post("/api/crm/customers/:id/resume", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  await db.execute(sql`UPDATE customers SET cust_status='active', paused_until=NULL WHERE id=${id}`);
  res.json({ ok: true });
});

router.post("/api/crm/customers/:id/cancel", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const { reason } = req.body as { reason?: string };
  await db.execute(sql`UPDATE customers SET cust_status='cancelled' WHERE id=${id}`);
  await db.execute(sql`INSERT INTO crm_tasks (customer_id,title,description,task_type,status,created_by) VALUES (${id},'Abonelik iptal edildi',${reason ?? "Müşteri talebi ile iptal"},'note','completed','admin')`);
  res.json({ ok: true });
});

router.post("/api/crm/customers/:id/upgrade", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const { newPlan } = req.body as { newPlan: string };
  if (!newPlan) return void res.status(400).json({ error: "Yeni plan gerekli" });
  const cr = await db.execute(sql`SELECT plan FROM customers WHERE id=${id}`);
  const c = (cr as { rows: Record<string, unknown>[] }).rows[0];
  const oldPlan = c?.["plan"] ?? "bilinmiyor";
  await db.execute(sql`UPDATE customers SET plan=${newPlan} WHERE id=${id}`);
  await db.execute(sql`INSERT INTO crm_tasks (customer_id,title,description,task_type,status,created_by) VALUES (${id},'Plan yükseltildi',${`${oldPlan} → ${newPlan}`},'note','completed','admin')`);
  res.json({ ok: true });
});

// ─── PORTAL SUPPORT ───────────────────────────────────────────────────────────

router.post("/api/portal/support", async (req: Request, res: Response) => {
  const cid = (req as Request & { session?: { customerId?: number } }).session?.["customerId"];
  if (!cid) return void res.status(401).json({ error: "Giriş yapmanız gerekiyor" });
  const { subject, message, priority } = req.body as Record<string, string>;
  if (!subject || !message) return void res.status(400).json({ error: "Konu ve mesaj gerekli" });
  const r = await db.execute(sql`
    INSERT INTO crm_tasks (customer_id,title,description,task_type,priority,status,created_by)
    VALUES (${cid},${`Destek: ${subject}`},${message},'support',${priority ?? "medium"},'open','portal')
    RETURNING *
  `);
  const cr = await db.execute(sql`SELECT email,full_name FROM customers WHERE id=${cid}`);
  const c = (cr as { rows: Record<string, unknown>[] }).rows[0];
  if (c) sendMail({ to: "serkangrdl@gmail.com", subject: `[Destek] ${subject} — ${c["full_name"]}`, html: `<p>${c["full_name"]} (${c["email"]}) destek talebi:</p><p>${message}</p>` }).catch(() => {});
  res.status(201).json({ ok: true, task: (r as { rows: unknown[] }).rows[0] });
});

router.get("/api/portal/support", async (req: Request, res: Response) => {
  const cid = (req as Request & { session?: { customerId?: number } }).session?.["customerId"];
  if (!cid) return void res.status(401).json({ error: "Giriş yapmanız gerekiyor" });
  const rows = await db.execute(sql`SELECT * FROM crm_tasks WHERE customer_id=${cid} AND task_type='support' ORDER BY created_at DESC`);
  res.json((rows as { rows: unknown[] }).rows);
});

// ─── AUTO-TAG CRON ────────────────────────────────────────────────────────────

export async function runAutoTagCron(): Promise<void> {
  try {
    const tagRows = await db.execute(sql`SELECT id,name FROM customer_tags WHERE name IN ('churn-riski','odeme-sorunu','yenileme-yakin')`);
    const tags = Object.fromEntries((tagRows as { rows: Record<string, unknown>[] }).rows.map(t => [String(t["name"]), Number(t["id"])]));

    if (tags["churn-riski"]) {
      await db.execute(sql`
        INSERT INTO customer_tag_assignments (customer_id,tag_id,assigned_by)
        SELECT DISTINCT hs.customer_id,${tags["churn-riski"]!},'auto' FROM customer_health_scores hs
        WHERE hs.health_score<40 AND hs.calculated_at=(SELECT MAX(h2.calculated_at) FROM customer_health_scores h2 WHERE h2.customer_id=hs.customer_id)
        ON CONFLICT DO NOTHING
      `).catch(() => {});
      await db.execute(sql`
        DELETE FROM customer_tag_assignments WHERE tag_id=${tags["churn-riski"]!} AND customer_id IN (
          SELECT DISTINCT hs.customer_id FROM customer_health_scores hs WHERE hs.health_score>=40
          AND hs.calculated_at=(SELECT MAX(h2.calculated_at) FROM customer_health_scores h2 WHERE h2.customer_id=hs.customer_id))
      `).catch(() => {});
    }

    if (tags["odeme-sorunu"]) {
      await db.execute(sql`
        INSERT INTO customer_tag_assignments (customer_id,tag_id,assigned_by)
        SELECT DISTINCT customer_id,${tags["odeme-sorunu"]!},'auto' FROM enterprise_invoices
        WHERE status='overdue' AND customer_id IS NOT NULL ON CONFLICT DO NOTHING
      `).catch(() => {});
    }

    logger.info("Auto-tag cron completed");
  } catch (err) { logger.warn({ err }, "Auto-tag cron failed"); }
}

// ─── TASK REMINDER CRON ───────────────────────────────────────────────────────

export async function runTaskReminderCron(): Promise<void> {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0]!;
  const rows = await db.execute(sql`
    SELECT t.*, c.email AS customer_email, c.full_name AS customer_name
    FROM crm_tasks t LEFT JOIN customers c ON c.id=t.customer_id
    WHERE t.status='open' AND t.due_date==${tomorrow} AND t.reminder_sent_at IS NULL AND t.assigned_to IS NOT NULL
  `).catch(() => ({ rows: [] }));
  for (const task of (rows as { rows: Record<string, unknown>[] }).rows) {
    try {
      await sendMail({ to: String(task["assigned_to"]), subject: `Görev Hatırlatması: ${task["title"]}`, html: `<p>Yarın vadesi dolan görev: <strong>${task["title"]}</strong></p><p>Müşteri: ${task["customer_name"] ?? "-"}</p>` });
      await db.execute(sql`UPDATE crm_tasks SET reminder_sent_at=now() WHERE id=${task["id"]}`);
    } catch (err) { logger.warn({ err }, "Task reminder failed"); }
  }
}

// ─── NPS CRON ─────────────────────────────────────────────────────────────────

export async function runNpsCron(): Promise<void> {
  try {
    const base = process.env["REPLIT_DOMAINS"] ? `https://${process.env["REPLIT_DOMAINS"]!.split(",")[0]!.trim()}` : "http://localhost:80";
    const candidates = await db.execute(sql`
      SELECT c.id, c.email, c.full_name FROM customers c
      WHERE c.cust_status='active' AND c.email IS NOT NULL
        AND c.first_payment_at IS NOT NULL
        AND c.first_payment_at <= NOW()-INTERVAL '30 days'
        AND NOT EXISTS (SELECT 1 FROM nps_surveys n WHERE n.customer_id=c.id AND n.created_at >= NOW()-INTERVAL '90 days')
      LIMIT 10
    `);
    for (const c of (candidates as { rows: Record<string, unknown>[] }).rows) {
      const token = crypto.randomBytes(32).toString("hex");
      await db.execute(sql`INSERT INTO nps_surveys (customer_id,survey_token,trigger_type,sent_at) VALUES (${c["id"]},${token},'scheduled',now())`);
      await sendMail({ to: String(c["email"]), subject: "CyberStep hakkında görüşünüz?", html: npsEmailHtml(String(c["full_name"]), token, base) });
      logger.info({ customerId: c["id"] }, "NPS sent (cron)");
    }
  } catch (err) { logger.warn({ err }, "NPS cron failed"); }
}

function npsEmailHtml(name: string, token: string, base: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
<h2 style="color:#060D1A;">Görüşünüz bizim için önemli</h2>
<p>Sayın ${name},</p>
<p>CyberStep'i bir iş arkadaşınıza tavsiye etme olasılığınız nedir? 30 saniyede cevaplayabilirsiniz.</p>
<div style="text-align:center;margin:32px 0;">
<a href="${base}/nps/${token}" style="background:#00A8CC;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;">Anketi Yanıtla</a>
</div>
<hr style="border:none;border-top:1px solid #E8EDF5;"><p style="color:#A0AEC0;font-size:11px;">CyberStep.io</p></div>`;
}

// ─── BANK ACCOUNTS ────────────────────────────────────────────────────────────

router.get("/bank-accounts", requireAdmin, async (_req, res: Response) => {
  try {
    const result = await db.execute(sql`SELECT id, currency, bank_name, iban, account_name, is_default, created_at FROM bank_accounts ORDER BY is_default DESC, id ASC`);
    res.json((result as { rows: unknown[] }).rows);
  } catch (err) { logger.error({ err }, "bank_accounts get"); res.status(500).json({ error: "Sunucu hatası" }); }
});

router.post("/bank-accounts", requireAdmin, async (req: Request, res: Response) => {
  const { currency, bank_name, iban, account_name, is_default } = req.body as Record<string, unknown>;
  if (!currency || !bank_name || !iban || !account_name) { res.status(400).json({ error: "currency, bank_name, iban, account_name zorunlu" }); return; }
  try {
    if (is_default) await db.execute(sql`UPDATE bank_accounts SET is_default=false`);
    const result = await db.execute(sql`INSERT INTO bank_accounts (currency, bank_name, iban, account_name, is_default) VALUES (${String(currency)}, ${String(bank_name)}, ${String(iban)}, ${String(account_name)}, ${is_default ? true : false}) RETURNING *`);
    res.json((result as { rows: unknown[] }).rows[0]);
  } catch (err) { logger.error({ err }, "bank_accounts post"); res.status(500).json({ error: "Sunucu hatası" }); }
});

router.put("/bank-accounts/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const { currency, bank_name, iban, account_name, is_default } = req.body as Record<string, unknown>;
  try {
    if (is_default) await db.execute(sql`UPDATE bank_accounts SET is_default=false WHERE id != ${id}`);
    await db.execute(sql`UPDATE bank_accounts SET currency=${String(currency ?? "TRY")}, bank_name=${String(bank_name ?? "")}, iban=${String(iban ?? "")}, account_name=${String(account_name ?? "")}, is_default=${is_default ? true : false}, updated_at=now() WHERE id=${id}`);
    res.json({ ok: true });
  } catch (err) { logger.error({ err }, "bank_accounts put"); res.status(500).json({ error: "Sunucu hatası" }); }
});

router.delete("/bank-accounts/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  try {
    await db.execute(sql`DELETE FROM bank_accounts WHERE id=${id}`);
    res.json({ ok: true });
  } catch (err) { logger.error({ err }, "bank_accounts delete"); res.status(500).json({ error: "Sunucu hatası" }); }
});

export default router;
