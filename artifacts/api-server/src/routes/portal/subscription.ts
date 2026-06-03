/**
 * Self-Serve Abonelik Yönetimi
 * POST /api/portal/subscription/cancel
 * POST /api/portal/subscription/upgrade  (istek oluştur — admin onayı)
 */

import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  customersTable,
  customerServiceSubscriptionsTable,
  subscriptionChangesTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireCustomer } from "../../middleware/auth";
import { sendMail } from "../../services/email";
import { trackSubscriptionCancelled } from "../../services/analytics";
import { logger } from "../../lib/logger";

const router = Router();

// ─── İptal ────────────────────────────────────────────────────────────────────

router.post("/portal/subscription/cancel", requireCustomer, async (req: Request, res: Response) => {
  const customerId = (req.session as { customerId?: number }).customerId;
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

  const { reason = "" } = req.body as { reason?: string };

  const [sub] = await db.select().from(customerServiceSubscriptionsTable)
    .where(
      and(
        eq(customerServiceSubscriptionsTable.customerId, customerId),
        eq(customerServiceSubscriptionsTable.status, "active"),
      )
    ).limit(1);

  if (!sub) { res.status(404).json({ error: "Aktif abonelik bulunamadı" }); return; }

  const [customer] = await db.select().from(customersTable)
    .where(eq(customersTable.id, customerId)).limit(1);

  // Dönem sonuna kadar aktif bırak — status = 'cancelled', cancelsAt = expiresAt
  await db.update(customerServiceSubscriptionsTable).set({
    status: "cancelled",
    cancelledAt: new Date(),
    cancelsAt: sub.expiresAt ?? new Date(),
  }).where(eq(customerServiceSubscriptionsTable.id, sub.id));

  await db.insert(subscriptionChangesTable).values({
    customerId,
    changeType: "cancel",
    fromPlan: sub.serviceSlug,
    reason: reason || null,
    effectiveDate: sub.expiresAt ? new Date(sub.expiresAt).toISOString().slice(0, 10) : null,
    performedBy: "customer",
  });

  // Müşteri iptal emaili
  if (customer) {
    const effectiveDate = sub.expiresAt
      ? new Date(sub.expiresAt).toLocaleDateString("tr-TR")
      : "dönem sonu";

    setImmediate(async () => {
      await sendMail({
        to: customer.email,
        subject: "CyberStep aboneliğiniz iptal edildi",
        html: `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
<p>Sayın ${customer.fullName},</p>
<p>Aboneliğiniz iptal edilmiştir. <strong>${effectiveDate}</strong> tarihine kadar erişiminiz devam edecektir.</p>
<p>Düşüncelerinizi duymak isteriz. Geri bildirim için yanıtlayabilirsiniz.</p>
<hr><p style="font-size:12px;color:#888">CyberStep.io</p>
</body></html>`,
      }).catch(err => logger.warn({ err }, "Cancel confirmation email failed"));
    });

    trackSubscriptionCancelled(
      customerId,
      sub.serviceSlug,
      reason,
      sub.startedAt
        ? Math.floor((Date.now() - new Date(sub.startedAt).getTime()) / (30 * 86_400_000))
        : undefined,
    );
  }

  logger.info({ customerId, serviceSlug: sub.serviceSlug, reason }, "Subscription cancelled by customer");
  res.json({ ok: true, cancelsAt: sub.expiresAt });
});

// ─── Yükseltme (istek) ────────────────────────────────────────────────────────

router.post("/portal/subscription/upgrade", requireCustomer, async (req: Request, res: Response) => {
  const customerId = (req.session as { customerId?: number }).customerId;
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

  const { newPlan = "" } = req.body as { newPlan?: string };
  if (!newPlan) { res.status(400).json({ error: "newPlan gerekli" }); return; }

  const [sub] = await db.select().from(customerServiceSubscriptionsTable)
    .where(
      and(
        eq(customerServiceSubscriptionsTable.customerId, customerId),
        eq(customerServiceSubscriptionsTable.status, "active"),
      )
    ).limit(1);

  if (!sub) { res.status(404).json({ error: "Aktif abonelik bulunamadı" }); return; }

  const [customer] = await db.select().from(customersTable)
    .where(eq(customersTable.id, customerId)).limit(1);

  await db.insert(subscriptionChangesTable).values({
    customerId,
    changeType: "upgrade",
    fromPlan: sub.serviceSlug,
    toPlan: newPlan,
    performedBy: "customer",
  });

  // Admin bildirim emaili
  const adminEmail = process.env["SMTP_USER"];
  if (adminEmail) {
    setImmediate(async () => {
      await sendMail({
        to: adminEmail,
        subject: `Yükseltme Talebi: ${customer?.companyName ?? customer?.fullName} → ${newPlan}`,
        html: `<p>Müşteri #${customerId} (${customer?.email}) <strong>${newPlan}</strong> planına geçmek istiyor.</p>
<p>Mevcut plan: ${sub.serviceSlug}</p>`,
      }).catch(err => logger.warn({ err }, "Upgrade request admin email failed"));
    });
  }

  logger.info({ customerId, fromPlan: sub.serviceSlug, newPlan }, "Upgrade request created");
  res.json({ ok: true, message: "Yükseltme talebiniz alındı. Ekibimiz size ulaşacak." });
});

export default router;
