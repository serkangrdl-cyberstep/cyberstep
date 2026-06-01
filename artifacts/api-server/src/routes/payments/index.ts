import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { serviceCatalogTable, customerServiceSubscriptionsTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { createPayment, checkPayment } from "../../services/iyzico";
import { sendMail } from "../../services/email";
import { requireAdmin } from "../../middleware/auth";
import { logger } from "../../lib/logger";

const router = Router();

const KDV_RATE = 0.20;
const ANNUAL_DISCOUNT = 0.15;

function calcPrices(monthlyTl: number, billingCycle: "monthly" | "annual") {
  const base = billingCycle === "annual"
    ? +(monthlyTl * 12 * (1 - ANNUAL_DISCOUNT)).toFixed(2)
    : +monthlyTl.toFixed(2);
  const kdv = +(base * KDV_RATE).toFixed(2);
  const total = +(base + kdv).toFixed(2);
  return { base, kdv, total };
}

async function sendReceiptEmail(params: {
  email: string;
  contactName: string;
  companyName: string;
  serviceLabel: string;
  billingCycle: string;
  amountPaid: number;
  kdv: number;
  total: number;
  expiresAt: Date;
  paymentRef?: string;
}) {
  const cycleLabel = params.billingCycle === "annual" ? "Yıllık" : "Aylık";
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;background:#f4f7fb;padding:32px">
<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
  <h2 style="color:#0ea5e9;margin-top:0">Satın Alma Onayı</h2>
  <p>Sayın <strong>${params.contactName}</strong>,</p>
  <p><strong>${params.serviceLabel}</strong> servisini başarıyla satın aldınız.</p>
  <table style="width:100%;border-collapse:collapse;margin:24px 0">
    <tr style="border-bottom:1px solid #e2e8f0">
      <td style="padding:8px 0;color:#64748b">Şirket</td>
      <td style="padding:8px 0;text-align:right;font-weight:600">${params.companyName || "-"}</td>
    </tr>
    <tr style="border-bottom:1px solid #e2e8f0">
      <td style="padding:8px 0;color:#64748b">Servis</td>
      <td style="padding:8px 0;text-align:right;font-weight:600">${params.serviceLabel}</td>
    </tr>
    <tr style="border-bottom:1px solid #e2e8f0">
      <td style="padding:8px 0;color:#64748b">Fatura Dönemi</td>
      <td style="padding:8px 0;text-align:right">${cycleLabel}</td>
    </tr>
    <tr style="border-bottom:1px solid #e2e8f0">
      <td style="padding:8px 0;color:#64748b">Tutar (KDV hariç)</td>
      <td style="padding:8px 0;text-align:right">${params.amountPaid.toLocaleString("tr-TR")} TL</td>
    </tr>
    <tr style="border-bottom:1px solid #e2e8f0">
      <td style="padding:8px 0;color:#64748b">KDV (%20)</td>
      <td style="padding:8px 0;text-align:right">${params.kdv.toLocaleString("tr-TR")} TL</td>
    </tr>
    <tr>
      <td style="padding:8px 0;font-weight:700">Toplam</td>
      <td style="padding:8px 0;text-align:right;font-weight:700;color:#0ea5e9">₺${params.total.toLocaleString("tr-TR")}</td>
    </tr>
  </table>
  <p style="color:#64748b;font-size:14px">Geçerlilik bitiş tarihi: <strong>${params.expiresAt.toLocaleDateString("tr-TR")}</strong></p>
  ${params.paymentRef ? `<p style="color:#94a3b8;font-size:12px">Ödeme Ref: ${params.paymentRef}</p>` : ""}
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
  <p style="color:#64748b;font-size:13px">Sorularınız için <a href="mailto:info@cyberstep.io" style="color:#0ea5e9">info@cyberstep.io</a> adresine yazabilirsiniz.</p>
  <p style="color:#94a3b8;font-size:12px">CyberStep.io — KOBİ Siber Güvenlik Platformu</p>
</div>
</body>
</html>`;

  await sendMail({
    to: params.email,
    subject: `Satın Alma Onayı: ${params.serviceLabel}`,
    html,
  });
}

// POST /api/payments/service-checkout
// Synchronous Iyzico card charge; creates subscription on success.
router.post("/payments/service-checkout", async (req: Request, res: Response) => {
  const {
    serviceSlug, billingCycle = "monthly",
    companyName = "", contactName, email, phone,
    cardHolderName, cardNumber, expireMonth, expireYear, cvc,
    ip,
  } = req.body as {
    serviceSlug: string;
    billingCycle?: "monthly" | "annual";
    companyName?: string;
    contactName: string;
    email: string;
    phone?: string;
    cardHolderName: string;
    cardNumber: string;
    expireMonth: string;
    expireYear: string;
    cvc: string;
    ip?: string;
  };

  if (!serviceSlug || !contactName || !email || !cardNumber || !cardHolderName) {
    res.status(400).json({ error: "Eksik ödeme bilgileri" });
    return;
  }

  const [service] = await db.select().from(serviceCatalogTable).where(eq(serviceCatalogTable.slug, serviceSlug));
  if (!service || !service.isActive) {
    res.status(404).json({ error: "Servis bulunamadı" });
    return;
  }

  const monthlyTl = Number(service.monthlyPriceTl);
  const { base, kdv, total } = calcPrices(monthlyTl, billingCycle as "monthly" | "annual");
  const conversationId = `svc-${serviceSlug}-${Date.now()}`;

  const nameParts = contactName.trim().split(" ");
  const firstName = nameParts[0] ?? contactName;
  const lastName = nameParts.slice(1).join(" ") || "-";

  const result = await createPayment({
    price: String(base),
    paidPrice: String(total),
    currency: "TRY",
    installment: 1,
    paymentCard: { cardHolderName, cardNumber: cardNumber.replace(/\s/g, ""), expireYear, expireMonth, cvc },
    buyer: {
      id: email,
      name: firstName,
      surname: lastName,
      email,
      identityNumber: "11111111111",
      registrationAddress: "Türkiye",
      city: "İstanbul",
      country: "Turkey",
      ip: ip ?? "127.0.0.1",
    },
    shippingAddress: { address: "Türkiye", city: "İstanbul", country: "Turkey", contactName },
    billingAddress: { address: "Türkiye", city: "İstanbul", country: "Turkey", contactName },
    basketItems: [{
      id: service.slug,
      name: service.label,
      category1: "Siber Güvenlik Hizmetleri",
      itemType: "VIRTUAL",
      price: String(base),
    }],
    conversationId,
  });

  if (!result.success) {
    logger.warn({ error: result.errorMessage, serviceSlug }, "Service checkout payment failed");
    res.status(402).json({ success: false, error: result.errorMessage ?? "Ödeme başarısız" });
    return;
  }

  const now = new Date();
  const expiresAt = billingCycle === "annual"
    ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
    : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

  const session = req.session as unknown as Record<string, unknown>;
  const customerId = session["customerId"] as number | undefined;

  const [subscription] = await db.insert(customerServiceSubscriptionsTable).values({
    customerId: customerId ?? null,
    serviceSlug: service.slug,
    serviceLabel: service.label,
    status: "active",
    billingCycle,
    contactName,
    companyName,
    email,
    phone: phone ?? null,
    amountPaid: String(total),
    currency: "TRY",
    paymentRef: result.paymentId ?? null,
    iyzicoConversationId: conversationId,
    startedAt: now,
    expiresAt,
  }).returning();

  logger.info({ subscriptionId: subscription?.id, serviceSlug, email }, "Service subscription created");

  setImmediate(() => {
    sendReceiptEmail({
      email,
      contactName,
      companyName,
      serviceLabel: service.label,
      billingCycle,
      amountPaid: base,
      kdv,
      total,
      expiresAt,
      paymentRef: result.paymentId,
    }).catch(err => logger.warn({ err, email }, "Receipt email failed"));
  });

  res.json({ success: true, subscriptionId: subscription?.id });
});

// POST /api/payments/service-callback
// Iyzico async webhook / server-side callback notification.
// Verifies the paymentId with Iyzico and idempotently marks the linked subscription active.
// Returns 200 for all valid calls so Iyzico does not retry unnecessarily.
router.post("/payments/service-callback", async (req: Request, res: Response) => {
  const paymentId = typeof req.body?.paymentId === "string" ? req.body.paymentId : null;
  const conversationId = typeof req.body?.conversationId === "string" ? req.body.conversationId : null;

  if (!paymentId && !conversationId) {
    logger.warn({ body: req.body }, "service-callback: missing paymentId and conversationId");
    res.status(400).json({ error: "paymentId veya conversationId gerekli" });
    return;
  }

  // Verify payment status with Iyzico
  let paymentVerified = false;
  if (paymentId) {
    const verification = await checkPayment(paymentId).catch(err => {
      logger.warn({ err, paymentId }, "service-callback: checkPayment error");
      return { success: false };
    });
    paymentVerified = verification.success;
  }

  if (!paymentVerified) {
    logger.warn({ paymentId, conversationId }, "service-callback: payment not verified — ignoring");
    res.json({ ok: false, reason: "payment_not_verified" });
    return;
  }

  // Find the subscription by paymentRef or conversationId (idempotent lookup)
  const conditions = [];
  if (paymentId) conditions.push(eq(customerServiceSubscriptionsTable.paymentRef, paymentId));
  if (conversationId) conditions.push(eq(customerServiceSubscriptionsTable.iyzicoConversationId, conversationId));

  const [existing] = await db.select()
    .from(customerServiceSubscriptionsTable)
    .where(or(...conditions))
    .limit(1);

  if (!existing) {
    logger.warn({ paymentId, conversationId }, "service-callback: no matching subscription found");
    res.json({ ok: false, reason: "subscription_not_found" });
    return;
  }

  // Already active — idempotent success
  if (existing.status === "active") {
    res.json({ ok: true, subscriptionId: existing.id, idempotent: true });
    return;
  }

  // Activate the subscription
  await db.update(customerServiceSubscriptionsTable)
    .set({ status: "active" })
    .where(eq(customerServiceSubscriptionsTable.id, existing.id));

  logger.info({ subscriptionId: existing.id, paymentId }, "service-callback: subscription activated via callback");
  res.json({ ok: true, subscriptionId: existing.id });
});

// GET /api/customer/service-subscriptions — oturum açmış müşteri kendi aboneliklerini görür
router.get("/customer/service-subscriptions", async (req: Request, res: Response) => {
  const session = req.session as unknown as Record<string, unknown>;
  const customerId = session["customerId"] as number | undefined;
  const email = session["customerEmail"] as string | undefined;

  if (!customerId && !email) {
    res.status(401).json({ error: "Oturum gerekli" });
    return;
  }

  const rows = customerId
    ? await db.select().from(customerServiceSubscriptionsTable).where(eq(customerServiceSubscriptionsTable.customerId, customerId))
    : await db.select().from(customerServiceSubscriptionsTable).where(eq(customerServiceSubscriptionsTable.email, email!));

  res.json(rows);
});

// POST /api/customer/service-subscriptions/:id/cancel — müşteri iptal
router.post("/customer/service-subscriptions/:id/cancel", async (req: Request, res: Response) => {
  const session = req.session as unknown as Record<string, unknown>;
  const customerId = session["customerId"] as number | undefined;
  const email = session["customerEmail"] as string | undefined;
  const id = Number(req.params["id"]);

  if (!customerId && !email) {
    res.status(401).json({ error: "Oturum gerekli" });
    return;
  }

  const [sub] = await db.select().from(customerServiceSubscriptionsTable).where(eq(customerServiceSubscriptionsTable.id, id));

  if (!sub) {
    res.status(404).json({ error: "Abonelik bulunamadı" });
    return;
  }

  // IDOR koruması: sadece kendi aboneliği
  if (sub.customerId && customerId && sub.customerId !== customerId) {
    res.status(403).json({ error: "Erişim reddedildi" });
    return;
  }
  if (sub.email && email && sub.email !== email) {
    res.status(403).json({ error: "Erişim reddedildi" });
    return;
  }

  await db.update(customerServiceSubscriptionsTable)
    .set({ status: "cancelled" })
    .where(eq(customerServiceSubscriptionsTable.id, id));

  logger.info({ subId: id, customerId, email }, "Subscription cancelled by customer");
  res.json({ success: true });
});

// GET /api/payments/service-subscriptions — admin-only: query subscriptions by email or customerId
router.get("/payments/service-subscriptions", requireAdmin, async (req: Request, res: Response) => {
  const email = typeof req.query["email"] === "string" ? req.query["email"].trim() : null;
  const customerIdRaw = typeof req.query["customerId"] === "string" ? Number(req.query["customerId"]) : null;
  const customerId = customerIdRaw && !Number.isNaN(customerIdRaw) ? customerIdRaw : null;

  if (!email && !customerId) {
    res.status(400).json({ error: "email veya customerId gerekli" });
    return;
  }

  const rows = customerId
    ? await db.select().from(customerServiceSubscriptionsTable).where(eq(customerServiceSubscriptionsTable.customerId, customerId))
    : await db.select().from(customerServiceSubscriptionsTable).where(eq(customerServiceSubscriptionsTable.email, email!));

  res.json(rows);
});

export default router;
