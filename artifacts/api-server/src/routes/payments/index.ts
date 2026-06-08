// TODO: IYZICO_IDENTITY_NUMBER env değişkeni MASAK AML gereksinimi için gerçek değerle doldurulmalı
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { serviceCatalogTable, customerServiceSubscriptionsTable } from "@workspace/db";
import { eq, or, inArray } from "drizzle-orm";
import { createPayment, createPaymentWithStoredCard, checkPayment } from "../../services/iyzico";
import { sendMail, sendSubscriptionCancellationEmail } from "../../services/email";
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
  <p style="color:#94a3b8;font-size:12px">CyberStep.io — işletme Siber Güvenlik Platformu</p>
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
    paymentCard: {
      cardHolderName,
      cardNumber: cardNumber.replace(/\s/g, ""),
      expireYear,
      expireMonth,
      cvc,
      registerCard: 1,
    },
    buyer: {
      id: email,
      name: firstName,
      surname: lastName,
      email,
      identityNumber: process.env.IYZICO_IDENTITY_NUMBER ?? "11111111111",
      registrationAddress: "Türkiye",
      city: "İstanbul",
      country: "Turkey",
      ip: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "127.0.0.1",
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
    iyzicoCardUserKey: result.cardUserKey ?? null,
    iyzicoCardToken: result.cardToken ?? null,
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

  setImmediate(() => {
    void import("../../services/einvoice").then(({ createEInvoice }) =>
      createEInvoice({
        customerEmail: email,
        customerName: contactName,
        companyName,
        amount: base,
        kdv,
        total,
        serviceLabel: service.label,
        paymentRef: result.paymentId ?? conversationId,
      })
    ).catch(err => logger.warn({ err, email }, "E-fatura oluşturma isteği başarısız"));
  });

  res.json({ success: true, subscriptionId: subscription?.id });
});

// POST /api/payments/cart-checkout
// Sepetteki birden fazla servisi tek Iyzico ödemesiyle satın alma.
router.post("/payments/cart-checkout", async (req: Request, res: Response) => {
  const {
    items,
    companyName = "", contactName, email, phone,
    cardHolderName, cardNumber, expireMonth, expireYear, cvc,
  } = req.body as {
    items: Array<{ serviceSlug: string; billingCycle: "monthly" | "annual" }>;
    companyName?: string;
    contactName: string;
    email: string;
    phone?: string;
    cardHolderName: string;
    cardNumber: string;
    expireMonth: string;
    expireYear: string;
    cvc: string;
  };

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "Sepet boş" }); return;
  }
  if (!contactName || !email || !cardNumber || !cardHolderName) {
    res.status(400).json({ error: "Eksik ödeme bilgileri" }); return;
  }

  const slugs = [...new Set(items.map(i => i.serviceSlug))];
  const services = await db.select().from(serviceCatalogTable)
    .where(inArray(serviceCatalogTable.slug, slugs));

  type EnrichedItem = {
    service: typeof services[number];
    billingCycle: "monthly" | "annual";
    base: number; kdv: number; total: number;
  };

  let totalBase = 0, totalKdv = 0, totalAmount = 0;
  const enrichedItems: EnrichedItem[] = [];

  for (const item of items) {
    const service = services.find(s => s.slug === item.serviceSlug);
    if (!service || !service.isActive) continue;
    const { base, kdv, total } = calcPrices(Number(service.monthlyPriceTl), item.billingCycle);
    totalBase += base; totalKdv += kdv; totalAmount += total;
    enrichedItems.push({ service, billingCycle: item.billingCycle, base, kdv, total });
  }

  if (enrichedItems.length === 0) {
    res.status(400).json({ error: "Geçerli servis bulunamadı" }); return;
  }

  totalBase = +totalBase.toFixed(2);
  totalKdv = +totalKdv.toFixed(2);
  totalAmount = +totalAmount.toFixed(2);

  const conversationId = `cart-${Date.now()}`;
  const nameParts = contactName.trim().split(" ");
  const firstName = nameParts[0] ?? contactName;
  const lastName = nameParts.slice(1).join(" ") || "-";

  const result = await createPayment({
    price: String(totalBase),
    paidPrice: String(totalAmount),
    currency: "TRY",
    installment: 1,
    paymentCard: {
      cardHolderName,
      cardNumber: cardNumber.replace(/\s/g, ""),
      expireYear, expireMonth, cvc,
      registerCard: 1,
    },
    buyer: {
      id: email, name: firstName, surname: lastName, email,
      identityNumber: process.env.IYZICO_IDENTITY_NUMBER ?? "11111111111",
      registrationAddress: "Türkiye", city: "İstanbul", country: "Turkey",
      ip: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "127.0.0.1",
    },
    shippingAddress: { address: "Türkiye", city: "İstanbul", country: "Turkey", contactName },
    billingAddress: { address: "Türkiye", city: "İstanbul", country: "Turkey", contactName },
    basketItems: enrichedItems.map(ei => ({
      id: ei.service.slug,
      name: ei.service.label,
      category1: "Siber Güvenlik Hizmetleri",
      itemType: "VIRTUAL",
      price: String(ei.base),
    })),
    conversationId,
  });

  if (!result.success) {
    logger.warn({ error: result.errorMessage, itemCount: enrichedItems.length }, "Cart checkout payment failed");
    res.status(402).json({ success: false, error: result.errorMessage ?? "Ödeme başarısız" });
    return;
  }

  const now = new Date();
  const session = req.session as unknown as Record<string, unknown>;
  const customerId = session["customerId"] as number | undefined;
  const subscriptionIds: number[] = [];

  for (const ei of enrichedItems) {
    const expiresAt = ei.billingCycle === "annual"
      ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
      : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    const [sub] = await db.insert(customerServiceSubscriptionsTable).values({
      customerId: customerId ?? null,
      serviceSlug: ei.service.slug,
      serviceLabel: ei.service.label,
      status: "active",
      billingCycle: ei.billingCycle,
      contactName, companyName, email,
      phone: phone ?? null,
      amountPaid: String(ei.total),
      currency: "TRY",
      paymentRef: result.paymentId ?? null,
      iyzicoConversationId: conversationId,
      startedAt: now, expiresAt,
      iyzicoCardUserKey: result.cardUserKey ?? null,
      iyzicoCardToken: result.cardToken ?? null,
    }).returning();
    if (sub) subscriptionIds.push(sub.id);
  }

  logger.info({ customerId, subscriptionIds, email, itemCount: enrichedItems.length }, "Cart checkout successful");

  setImmediate(() => {
    sendReceiptEmail({
      email, contactName, companyName,
      serviceLabel: enrichedItems.map(ei => ei.service.label).join(", "),
      billingCycle: enrichedItems[0]!.billingCycle,
      amountPaid: totalBase, kdv: totalKdv, total: totalAmount,
      expiresAt: new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()),
      paymentRef: result.paymentId,
    }).catch(err => logger.warn({ err, email }, "Cart receipt email failed"));
  });

  res.json({ success: true, subscriptionIds });
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

  const now = new Date();
  await db.update(customerServiceSubscriptionsTable)
    .set({ status: "cancelled", cancelledAt: now })
    .where(eq(customerServiceSubscriptionsTable.id, id));

  logger.info({ subId: id, customerId, email }, "Subscription cancelled by customer");

  setImmediate(() => {
    sendSubscriptionCancellationEmail({
      email: sub.email,
      contactName: sub.contactName,
      companyName: sub.companyName,
      serviceLabel: sub.serviceLabel,
      billingCycle: sub.billingCycle,
      cancelledAt: now,
      expiresAt: sub.expiresAt ?? null,
    }).catch(err => logger.warn({ err, subId: id }, "Cancellation email failed"));
  });

  res.json({ success: true });
});

// POST /api/customer/service-subscriptions/:id/renew — customer-facing: renew own subscription
// Modes: stored card (no card fields) or new card (full card fields)
router.post("/customer/service-subscriptions/:id/renew", async (req: Request, res: Response) => {
  const session = req.session as unknown as Record<string, unknown>;
  const customerId = session["customerId"] as number | undefined;
  const email = session["customerEmail"] as string | undefined;

  if (!customerId && !email) {
    res.status(401).json({ error: "Oturum gerekli" });
    return;
  }

  const id = Number(req.params["id"]);
  if (!id || Number.isNaN(id)) {
    res.status(400).json({ error: "Geçersiz abonelik ID" });
    return;
  }

  const [sub] = await db.select().from(customerServiceSubscriptionsTable).where(eq(customerServiceSubscriptionsTable.id, id));
  if (!sub) {
    res.status(404).json({ error: "Abonelik bulunamadı" });
    return;
  }

  // IDOR protection: customer can only renew their own subscription
  if (sub.customerId && customerId && sub.customerId !== customerId) {
    res.status(403).json({ error: "Erişim reddedildi" });
    return;
  }
  if (sub.email && email && sub.email !== email) {
    res.status(403).json({ error: "Erişim reddedildi" });
    return;
  }

  const { cardHolderName, cardNumber, expireMonth, expireYear, cvc, ip } = req.body as {
    cardHolderName?: string;
    cardNumber?: string;
    expireMonth?: string;
    expireYear?: string;
    cvc?: string;
    ip?: string;
  };

  const useStoredCard = !!(sub.iyzicoCardUserKey && sub.iyzicoCardToken && !cardNumber);
  const useNewCard = !!(cardNumber && cardHolderName && expireMonth && expireYear && cvc);

  if (!useStoredCard && !useNewCard) {
    res.status(400).json({
      error: "Kart bilgileri gerekli",
      hasStoredCard: !!(sub.iyzicoCardUserKey && sub.iyzicoCardToken),
    });
    return;
  }

  const monthlyTl = await db.select({ monthlyPriceTl: serviceCatalogTable.monthlyPriceTl })
    .from(serviceCatalogTable)
    .where(eq(serviceCatalogTable.slug, sub.serviceSlug))
    .then(rows => Number(rows[0]?.monthlyPriceTl ?? 0));

  const billingCycle = sub.billingCycle as "monthly" | "annual";
  const { base, kdv, total } = calcPrices(monthlyTl || Number(sub.amountPaid) / 1.2, billingCycle);
  const conversationId = `renew-cust-${id}-${Date.now()}`;

  const nameParts = sub.contactName.trim().split(" ");
  const firstName = nameParts[0] ?? sub.contactName;
  const lastName = nameParts.slice(1).join(" ") || "-";

  const buyerInfo = {
    id: sub.email,
    name: firstName,
    surname: lastName,
    email: sub.email,
    identityNumber: process.env.IYZICO_IDENTITY_NUMBER ?? "11111111111",
    registrationAddress: "Türkiye",
    city: "İstanbul",
    country: "Turkey",
    ip: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "127.0.0.1",
  };
  const addrInfo = { address: "Türkiye", city: "İstanbul", country: "Turkey", contactName: sub.contactName };
  const basketItems = [{ id: sub.serviceSlug, name: sub.serviceLabel, category1: "Siber Güvenlik Hizmetleri", itemType: "VIRTUAL", price: String(base) }];

  let paymentResult: { success: boolean; paymentId?: string; errorMessage?: string; cardUserKey?: string; cardToken?: string };

  if (useStoredCard) {
    paymentResult = await createPaymentWithStoredCard({
      price: String(base), paidPrice: String(total), currency: "TRY", installment: 1,
      paymentCard: { cardUserKey: sub.iyzicoCardUserKey!, cardToken: sub.iyzicoCardToken! },
      buyer: buyerInfo, shippingAddress: addrInfo, billingAddress: addrInfo, basketItems, conversationId,
    });
  } else {
    paymentResult = await createPayment({
      price: String(base), paidPrice: String(total), currency: "TRY", installment: 1,
      paymentCard: {
        cardHolderName: cardHolderName!,
        cardNumber: cardNumber!.replace(/\s/g, ""),
        expireYear: expireYear!,
        expireMonth: expireMonth!,
        cvc: cvc!,
        registerCard: 1,
        cardUserKey: sub.iyzicoCardUserKey ?? undefined,
      },
      buyer: buyerInfo, shippingAddress: addrInfo, billingAddress: addrInfo, basketItems, conversationId,
    });
  }

  if (!paymentResult.success) {
    logger.warn({ error: paymentResult.errorMessage, subId: id }, "Customer renewal payment failed");
    res.status(402).json({ success: false, error: paymentResult.errorMessage ?? "Ödeme başarısız" });
    return;
  }

  const now = new Date();
  const baseDate = sub.expiresAt && sub.expiresAt > now ? sub.expiresAt : now;
  const newExpiresAt = billingCycle === "annual"
    ? new Date(baseDate.getFullYear() + 1, baseDate.getMonth(), baseDate.getDate())
    : new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, baseDate.getDate());

  await db.update(customerServiceSubscriptionsTable)
    .set({
      status: "active",
      cancelledAt: null,
      expiresAt: newExpiresAt,
      amountPaid: String(total),
      paymentRef: paymentResult.paymentId ?? sub.paymentRef,
      iyzicoConversationId: conversationId,
      reminder30dSentAt: null,
      reminder7dSentAt: null,
      reminder1dSentAt: null,
      ...(paymentResult.cardUserKey ? { iyzicoCardUserKey: paymentResult.cardUserKey } : {}),
      ...(paymentResult.cardToken ? { iyzicoCardToken: paymentResult.cardToken } : {}),
    })
    .where(eq(customerServiceSubscriptionsTable.id, id));

  logger.info({ subId: id, email: sub.email, newExpiresAt, useStoredCard }, "Subscription renewed by customer");

  setImmediate(() => {
    sendReceiptEmail({
      email: sub.email,
      contactName: sub.contactName,
      companyName: sub.companyName,
      serviceLabel: sub.serviceLabel,
      billingCycle: sub.billingCycle,
      amountPaid: base,
      kdv,
      total,
      expiresAt: newExpiresAt,
      paymentRef: paymentResult.paymentId,
    }).catch(err => logger.warn({ err, subId: id }, "Customer renewal receipt email failed"));
  });

  res.json({ success: true, newExpiresAt, subscriptionId: id });
});

// POST /api/payments/service-subscriptions/:id/cancel — admin-only: cancel any subscription
router.post("/payments/service-subscriptions/:id/cancel", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  if (!id || Number.isNaN(id)) {
    res.status(400).json({ error: "Geçersiz abonelik ID" });
    return;
  }

  const [sub] = await db.select().from(customerServiceSubscriptionsTable).where(eq(customerServiceSubscriptionsTable.id, id));
  if (!sub) {
    res.status(404).json({ error: "Abonelik bulunamadı" });
    return;
  }

  if (sub.status === "cancelled") {
    res.status(409).json({ error: "Abonelik zaten iptal edilmiş" });
    return;
  }

  const now = new Date();
  await db.update(customerServiceSubscriptionsTable)
    .set({ status: "cancelled", cancelledAt: now })
    .where(eq(customerServiceSubscriptionsTable.id, id));

  logger.info({ subId: id, email: sub.email, serviceSlug: sub.serviceSlug }, "Subscription cancelled by admin");

  setImmediate(() => {
    sendSubscriptionCancellationEmail({
      email: sub.email,
      contactName: sub.contactName,
      companyName: sub.companyName,
      serviceLabel: sub.serviceLabel,
      billingCycle: sub.billingCycle,
      cancelledAt: now,
      expiresAt: sub.expiresAt ?? null,
    }).catch(err => logger.warn({ err, subId: id }, "Admin cancellation email failed"));
  });

  res.json({ success: true, cancelledAt: now });
});

// POST /api/payments/service-subscriptions/:id/renew — admin-only: renew a subscription
// Two modes:
//   1. Stored card: body is empty (or { mode: "stored" }) — uses iyzico_card_user_key + iyzico_card_token
//   2. New card:    body contains { cardHolderName, cardNumber, expireMonth, expireYear, cvc, ip? }
router.post("/payments/service-subscriptions/:id/renew", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  if (!id || Number.isNaN(id)) {
    res.status(400).json({ error: "Geçersiz abonelik ID" });
    return;
  }

  const [sub] = await db.select().from(customerServiceSubscriptionsTable).where(eq(customerServiceSubscriptionsTable.id, id));
  if (!sub) {
    res.status(404).json({ error: "Abonelik bulunamadı" });
    return;
  }

  const { cardHolderName, cardNumber, expireMonth, expireYear, cvc, ip } = req.body as {
    cardHolderName?: string;
    cardNumber?: string;
    expireMonth?: string;
    expireYear?: string;
    cvc?: string;
    ip?: string;
  };

  const useStoredCard = !!(sub.iyzicoCardUserKey && sub.iyzicoCardToken && !cardNumber);
  const useNewCard = !!(cardNumber && cardHolderName && expireMonth && expireYear && cvc);

  if (!useStoredCard && !useNewCard) {
    res.status(400).json({
      error: "Kart bilgileri gerekli",
      hasStoredCard: !!(sub.iyzicoCardUserKey && sub.iyzicoCardToken),
    });
    return;
  }

  const service = { slug: sub.serviceSlug, label: sub.serviceLabel };
  const monthlyTl = await db.select({ monthlyPriceTl: serviceCatalogTable.monthlyPriceTl })
    .from(serviceCatalogTable)
    .where(eq(serviceCatalogTable.slug, sub.serviceSlug))
    .then(rows => Number(rows[0]?.monthlyPriceTl ?? 0));

  const billingCycle = sub.billingCycle as "monthly" | "annual";
  const { base, kdv, total } = calcPrices(monthlyTl || Number(sub.amountPaid) / 1.2, billingCycle);
  const conversationId = `renew-${id}-${Date.now()}`;

  const nameParts = sub.contactName.trim().split(" ");
  const firstName = nameParts[0] ?? sub.contactName;
  const lastName = nameParts.slice(1).join(" ") || "-";

  const buyerInfo = {
    id: sub.email,
    name: firstName,
    surname: lastName,
    email: sub.email,
    identityNumber: process.env.IYZICO_IDENTITY_NUMBER ?? "11111111111",
    registrationAddress: "Türkiye",
    city: "İstanbul",
    country: "Turkey",
    ip: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "127.0.0.1",
  };
  const addrInfo = { address: "Türkiye", city: "İstanbul", country: "Turkey", contactName: sub.contactName };
  const basketItems = [{ id: service.slug, name: service.label, category1: "Siber Güvenlik Hizmetleri", itemType: "VIRTUAL", price: String(base) }];

  let paymentResult: { success: boolean; paymentId?: string; errorMessage?: string; cardUserKey?: string; cardToken?: string };

  if (useStoredCard) {
    const storedResult = await createPaymentWithStoredCard({
      price: String(base),
      paidPrice: String(total),
      currency: "TRY",
      installment: 1,
      paymentCard: { cardUserKey: sub.iyzicoCardUserKey!, cardToken: sub.iyzicoCardToken! },
      buyer: buyerInfo,
      shippingAddress: addrInfo,
      billingAddress: addrInfo,
      basketItems,
      conversationId,
    });
    paymentResult = storedResult;
  } else {
    const newCardResult = await createPayment({
      price: String(base),
      paidPrice: String(total),
      currency: "TRY",
      installment: 1,
      paymentCard: {
        cardHolderName: cardHolderName!,
        cardNumber: cardNumber!.replace(/\s/g, ""),
        expireYear: expireYear!,
        expireMonth: expireMonth!,
        cvc: cvc!,
        registerCard: 1,
        cardUserKey: sub.iyzicoCardUserKey ?? undefined,
      },
      buyer: buyerInfo,
      shippingAddress: addrInfo,
      billingAddress: addrInfo,
      basketItems,
      conversationId,
    });
    paymentResult = newCardResult;
  }

  if (!paymentResult.success) {
    logger.warn({ error: paymentResult.errorMessage, subId: id }, "Renewal payment failed");
    res.status(402).json({ success: false, error: paymentResult.errorMessage ?? "Ödeme başarısız" });
    return;
  }

  const now = new Date();
  const baseDate = sub.expiresAt && sub.expiresAt > now ? sub.expiresAt : now;
  const newExpiresAt = billingCycle === "annual"
    ? new Date(baseDate.getFullYear() + 1, baseDate.getMonth(), baseDate.getDate())
    : new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, baseDate.getDate());

  await db.update(customerServiceSubscriptionsTable)
    .set({
      status: "active",
      cancelledAt: null,
      expiresAt: newExpiresAt,
      amountPaid: String(total),
      paymentRef: paymentResult.paymentId ?? sub.paymentRef,
      iyzicoConversationId: conversationId,
      reminder30dSentAt: null,
      reminder7dSentAt: null,
      reminder1dSentAt: null,
      ...(paymentResult.cardUserKey ? { iyzicoCardUserKey: paymentResult.cardUserKey } : {}),
      ...(paymentResult.cardToken ? { iyzicoCardToken: paymentResult.cardToken } : {}),
    })
    .where(eq(customerServiceSubscriptionsTable.id, id));

  logger.info({ subId: id, email: sub.email, newExpiresAt, useStoredCard }, "Subscription renewed");

  setImmediate(() => {
    sendReceiptEmail({
      email: sub.email,
      contactName: sub.contactName,
      companyName: sub.companyName,
      serviceLabel: sub.serviceLabel,
      billingCycle: sub.billingCycle,
      amountPaid: base,
      kdv,
      total,
      expiresAt: newExpiresAt,
      paymentRef: paymentResult.paymentId,
    }).catch(err => logger.warn({ err, subId: id }, "Renewal receipt email failed"));
  });

  res.json({ success: true, newExpiresAt, subscriptionId: id });
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
