import { Router } from "express";
import type { Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { requireAdmin, requireCustomer, getCustomerId } from "../../middleware/auth";
import { logger } from "../../lib/logger";
import { resolveVendorLimit } from "../tprm/index";
import { grantState, clampHours, validReason, canRequestNew, SUPPORT_SCOPE, type GrantState } from "../../services/supportAccess";

const router = Router();

type GrantRow = { id: number; customer_id: number; reason: string; status: string; requested_by_label: string | null; requested_at: Date; decided_at: Date | null; expires_at: Date | null };
type LogRow = { id: number; actor: string; actor_label: string | null; action: string; at: Date };

const rowsOf = <T,>(r: unknown): T[] => (r as { rows: T[] }).rows;

async function adminLabel(req: Request): Promise<{ id: number | null; label: string }> {
  const id = ((req.session as unknown as Record<string, unknown>)["adminId"] as number | undefined) ?? null;
  if (!id) return { id: null, label: "yönetici" };
  const r = rowsOf<{ name: string | null; email: string }>(await db.execute(sql`SELECT name, email FROM admin_users WHERE id = ${id}`))[0];
  return { id, label: r ? (r.name?.trim() || r.email) : `yönetici #${id}` };
}

async function logEvent(grantId: number, actor: "admin" | "customer" | "system", label: string | null, action: string) {
  await db.execute(sql`INSERT INTO support_access_log (grant_id, actor, actor_label, action) VALUES (${grantId}, ${actor}, ${label}, ${action})`);
}

const present = (g: GrantRow) => ({
  id: g.id, state: grantState({ status: g.status, expiresAt: g.expires_at }) as GrantState,
  reason: g.reason, requestedBy: g.requested_by_label, requestedAt: g.requested_at, decidedAt: g.decided_at, expiresAt: g.expires_at,
});

async function latestGrant(customerId: number): Promise<GrantRow | null> {
  return rowsOf<GrantRow>(await db.execute(sql`SELECT * FROM support_access_grants WHERE customer_id = ${customerId} AND scope = ${SUPPORT_SCOPE} ORDER BY id DESC LIMIT 1`))[0] ?? null;
}
async function logOf(grantId: number): Promise<LogRow[]> {
  return rowsOf<LogRow>(await db.execute(sql`SELECT id, actor, actor_label, action, at FROM support_access_log WHERE grant_id = ${grantId} ORDER BY id DESC LIMIT 50`));
}

// ─── Yönetici ────────────────────────────────────────────────────────────────

// Yalnızca toplu rakamlar: tedarikçi adı/alan adı içermez, izin gerektirmez.
router.get("/admin-panel/customers/:id/tprm-summary", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"]));
  if (!id) { res.status(400).json({ error: "Geçersiz müşteri" }); return; }
  try {
    const c = rowsOf<{ email: string; subscription_plan: string | null; subscription_status: string | null }>(
      await db.execute(sql`SELECT email, subscription_plan, subscription_status FROM customers WHERE id = ${id}`))[0];
    if (!c) { res.status(404).json({ error: "Bulunamadı" }); return; }
    const a = rowsOf<Record<string, number | string | null>>(await db.execute(sql`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE monitoring_active)::int AS monitored,
             count(*) FILTER (WHERE last_scan_at IS NULL)::int AS never_scanned,
             count(*) FILTER (WHERE last_scan_at > now() - interval '7 days')::int AS scanned_7d,
             count(*) FILTER (WHERE questionnaire_status = 'completed')::int AS questionnaires_done,
             max(last_scan_at) AS last_scan_at
        FROM tprm_vendors WHERE lower(customer_email) = lower(${c.email})`))[0]!;
    const lim = resolveVendorLimit(c.subscription_plan, c.subscription_status);
    res.json({
      vendorCount: a["total"], limit: Number.isFinite(lim.limit) ? lim.limit : null, plan: lim.plan,
      monitored: a["monitored"], neverScanned: a["never_scanned"], scannedLast7Days: a["scanned_7d"],
      questionnairesCompleted: a["questionnaires_done"], lastScanAt: a["last_scan_at"],
    });
  } catch (err) {
    logger.error({ err }, "tprm-summary failed");
    res.status(500).json({ error: "Özet alınamadı" });
  }
});

router.get("/admin-panel/customers/:id/support-access", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"]));
  const g = id ? await latestGrant(id) : null;
  res.json({ current: g ? present(g) : null, log: g ? await logOf(g.id) : [] });
});

router.post("/admin-panel/customers/:id/support-access", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"]));
  const reason = validReason((req.body as { reason?: unknown } | undefined)?.reason);
  if (!id) { res.status(400).json({ error: "Geçersiz müşteri" }); return; }
  if (!reason) { res.status(400).json({ error: "Gerekçe en az 10 karakter olmalı" }); return; }
  const exists = rowsOf<{ id: number }>(await db.execute(sql`SELECT id FROM customers WHERE id = ${id}`))[0];
  if (!exists) { res.status(404).json({ error: "Bulunamadı" }); return; }
  const prev = await latestGrant(id);
  if (prev && !canRequestNew([grantState({ status: prev.status, expiresAt: prev.expires_at })])) {
    res.status(409).json({ error: "Zaten bekleyen veya aktif bir destek erişimi var" }); return;
  }
  const who = await adminLabel(req);
  const g = rowsOf<GrantRow>(await db.execute(sql`INSERT INTO support_access_grants (customer_id, scope, requested_by_admin_id, requested_by_label, reason) VALUES (${id}, ${SUPPORT_SCOPE}, ${who.id}, ${who.label}, ${reason}) RETURNING *`))[0]!;
  await logEvent(g.id, "admin", who.label, "Erişim istendi");
  res.json({ current: present(g) });
});

router.post("/admin-panel/customers/:id/support-access/end", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"]));
  const g = id ? await latestGrant(id) : null;
  if (!g) { res.status(404).json({ error: "İzin yok" }); return; }
  const st = grantState({ status: g.status, expiresAt: g.expires_at });
  if (st !== "active" && st !== "pending") { res.status(409).json({ error: "Açık izin yok" }); return; }
  const who = await adminLabel(req);
  await db.execute(sql`UPDATE support_access_grants SET status = 'revoked', decided_at = now() WHERE id = ${g.id}`);
  await logEvent(g.id, "admin", who.label, st === "pending" ? "İstek geri çekildi" : "Erişim sonlandırıldı");
  res.json({ ok: true });
});

// İzin aktifken tedarikçi listesi (yalnızca ad/alan adı/skor/kritiklik; bulgu ayrıntısı yok). Her görüntüleme kaydedilir.
router.get("/admin-panel/customers/:id/support-access/vendors", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"]));
  const g = id ? await latestGrant(id) : null;
  if (!g || grantState({ status: g.status, expiresAt: g.expires_at }) !== "active") {
    res.status(403).json({ error: "Aktif destek erişimi yok. Müşteriden onay istenmeli." }); return;
  }
  try {
    const c = rowsOf<{ email: string }>(await db.execute(sql`SELECT email FROM customers WHERE id = ${id}`))[0];
    if (!c) { res.status(404).json({ error: "Bulunamadı" }); return; }
    const vendors = rowsOf<Record<string, unknown>>(await db.execute(sql`
      SELECT id, supplier_domain AS domain, supplier_name AS name, last_scan_score AS score, risk_level AS risk, criticality,
             last_scan_at AS "lastScanAt", monitoring_active AS monitored, questionnaire_status AS questionnaire
        FROM tprm_vendors WHERE lower(customer_email) = lower(${c.email}) ORDER BY added_at DESC LIMIT 500`));
    const who = await adminLabel(req);
    await logEvent(g.id, "admin", who.label, `Tedarikçi listesi görüntülendi (${vendors.length} kayıt)`);
    res.json({ expiresAt: g.expires_at, vendors });
  } catch (err) {
    logger.error({ err }, "support-access vendors failed");
    res.status(500).json({ error: "Liste alınamadı" });
  }
});

// ─── Müşteri ────────────────────────────────────────────────────────────────

router.get("/tprm/support-access", requireCustomer, async (req: Request, res: Response) => {
  const cid = getCustomerId(req);
  const g = cid ? await latestGrant(cid) : null;
  if (!g) { res.json({ current: null, log: [] }); return; }
  res.json({ current: present(g), log: await logOf(g.id) });
});

async function ownGrant(req: Request, gid: number): Promise<GrantRow | null> {
  const cid = getCustomerId(req);
  if (!cid || !gid) return null;
  return rowsOf<GrantRow>(await db.execute(sql`SELECT * FROM support_access_grants WHERE id = ${gid} AND customer_id = ${cid}`))[0] ?? null;
}

router.post("/tprm/support-access/:gid/approve", requireCustomer, async (req: Request, res: Response) => {
  const g = await ownGrant(req, parseInt(String(req.params["gid"])));
  if (!g) { res.status(404).json({ error: "Bulunamadı" }); return; }
  if (grantState({ status: g.status, expiresAt: g.expires_at }) !== "pending") { res.status(409).json({ error: "Bu istek artık beklemede değil" }); return; }
  const hours = clampHours((req.body as { hours?: unknown } | undefined)?.hours);
  await db.execute(sql`UPDATE support_access_grants SET status = 'approved', decided_at = now(), expires_at = now() + (${hours} * interval '1 hour') WHERE id = ${g.id}`);
  await logEvent(g.id, "customer", null, `Erişim onaylandı (${hours} saat)`);
  res.json({ ok: true });
});

router.post("/tprm/support-access/:gid/decline", requireCustomer, async (req: Request, res: Response) => {
  const g = await ownGrant(req, parseInt(String(req.params["gid"])));
  if (!g) { res.status(404).json({ error: "Bulunamadı" }); return; }
  if (grantState({ status: g.status, expiresAt: g.expires_at }) !== "pending") { res.status(409).json({ error: "Bu istek artık beklemede değil" }); return; }
  await db.execute(sql`UPDATE support_access_grants SET status = 'declined', decided_at = now() WHERE id = ${g.id}`);
  await logEvent(g.id, "customer", null, "Erişim reddedildi");
  res.json({ ok: true });
});

router.post("/tprm/support-access/:gid/revoke", requireCustomer, async (req: Request, res: Response) => {
  const g = await ownGrant(req, parseInt(String(req.params["gid"])));
  if (!g) { res.status(404).json({ error: "Bulunamadı" }); return; }
  if (grantState({ status: g.status, expiresAt: g.expires_at }) !== "active") { res.status(409).json({ error: "Aktif erişim yok" }); return; }
  await db.execute(sql`UPDATE support_access_grants SET status = 'revoked', decided_at = now() WHERE id = ${g.id}`);
  await logEvent(g.id, "customer", null, "Erişim iptal edildi");
  res.json({ ok: true });
});

export default router;
