/**
 * KVKK Hesap Yönetimi
 * POST /api/portal/account/delete-request  — Madde 7 silme talebi
 * DELETE /api/portal/account/cancel-deletion — Talebi geri al
 */

import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { customersTable, customerServiceSubscriptionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireCustomer } from "../../middleware/auth";
import { sendMail } from "../../services/email";
import { logger } from "../../lib/logger";

const router = Router();

const BASE_URL = process.env["REPLIT_DOMAINS"]
  ? `https://${process.env["REPLIT_DOMAINS"].split(",")[0]?.trim()}`
  : "http://localhost:80";

// ─── Silme talebi ─────────────────────────────────────────────────────────────

router.post("/portal/account/delete-request", requireCustomer, async (req: Request, res: Response) => {
  const customerId = (req.session as { customerId?: number }).customerId;
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

  const [customer] = await db.select().from(customersTable)
    .where(eq(customersTable.id, customerId)).limit(1);
  if (!customer) { res.status(404).json({ error: "Müşteri bulunamadı" }); return; }

  if (customer.deletionRequestedAt) {
    res.status(409).json({ error: "Zaten silme talebi mevcut" }); return;
  }

  const scheduledAt = new Date(Date.now() + 30 * 86_400_000);

  // Aktif abonelikleri iptal et
  await db.update(customerServiceSubscriptionsTable).set({
    status: "cancelled",
    cancelledAt: new Date(),
  }).where(
    and(
      eq(customerServiceSubscriptionsTable.customerId, customerId),
      eq(customerServiceSubscriptionsTable.status, "active"),
    )
  );

  // Silme zamanlaması
  await db.update(customersTable).set({
    deletionRequestedAt: new Date(),
    scheduledDeletionAt: scheduledAt,
    subscriptionStatus: "inactive",
  }).where(eq(customersTable.id, customerId));

  // Onay emaili
  setImmediate(async () => {
    await sendMail({
      to: customer.email,
      subject: "CyberStep — Hesap silme talebiniz alındı",
      html: `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
<p>Sayın ${customer.fullName},</p>
<p>Hesap silme talebiniz alınmıştır. <strong>${scheduledAt.toLocaleDateString("tr-TR")}</strong> tarihinde tüm verileriniz kalıcı olarak silinecektir.</p>
<p>Bu süreçten vazgeçmek istiyorsanız aşağıdaki bağlantıya tıklayın:</p>
<p><a href="${BASE_URL}/portal/cancel-deletion" style="background:#6366f1;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block">Silme Talebini İptal Et</a></p>
<p style="font-size:12px;color:#888">Bu talep KVKK Madde 7 kapsamında işlenmektedir.</p>
<hr><p style="font-size:12px;color:#888">CyberStep.io</p>
</body></html>`,
    }).catch(err => logger.warn({ err }, "Deletion request confirmation email failed"));
  });

  logger.info({ customerId, scheduledAt }, "Account deletion requested");
  res.json({ ok: true, scheduledDeletionAt: scheduledAt });
});

// ─── Talebi geri al ───────────────────────────────────────────────────────────

router.delete("/portal/account/cancel-deletion", requireCustomer, async (req: Request, res: Response) => {
  const customerId = (req.session as { customerId?: number }).customerId;
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

  const [customer] = await db.select().from(customersTable)
    .where(eq(customersTable.id, customerId)).limit(1);

  if (!customer?.deletionRequestedAt) {
    res.status(404).json({ error: "Aktif silme talebi yok" }); return;
  }

  // Henüz silinmediyse geri al
  if (customer.archivedAt) {
    res.status(410).json({ error: "Hesap zaten silinmiş" }); return;
  }

  await db.update(customersTable).set({
    deletionRequestedAt: null,
    scheduledDeletionAt: null,
    subscriptionStatus: "inactive",
  }).where(eq(customersTable.id, customerId));

  logger.info({ customerId }, "Account deletion cancelled by customer");
  res.json({ ok: true, message: "Silme talebiniz iptal edildi." });
});

export default router;
