import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { paymentsTable, pricingPlansTable, customersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createPayment, isIyzicoConfigured } from "../../services/iyzico";
import { logger } from "../../lib/logger";

function getSession(req: Request) {
  return req.session as unknown as Record<string, unknown>;
}

const router = Router();

const KDV_RATE = 0.20; // %20 KDV

// POST /api/payments/initiate — start a payment
// GET /api/payments/status/:assessmentId — check if an assessment has been paid
// GET /api/payments/config — returns whether iyzico is configured
router.get("/payments/config", (_req: Request, res: Response) => {
  res.json({ configured: isIyzicoConfigured() });
});

router.get("/payments/status/:assessmentId", async (req: Request, res: Response) => {
  const assessmentId = Number(req.params.assessmentId);
  if (!assessmentId) { res.status(400).json({ paid: false }); return; }

  // Aktif abonesi olan müşteri için ödeme kontrolü atla
  const session = getSession(req);
  if (session.customerId) {
    const [customer] = await db.select({ subscriptionPlan: customersTable.subscriptionPlan, subscriptionStatus: customersTable.subscriptionStatus })
      .from(customersTable)
      .where(eq(customersTable.id, session.customerId as number));
    if (customer && (customer.subscriptionPlan === "full" || customer.subscriptionPlan === "premium") && customer.subscriptionStatus === "active") {
      res.json({ paid: true, status: "subscription" });
      return;
    }
  }

  const [payment] = await db.select()
    .from(paymentsTable)
    .where(eq(paymentsTable.assessmentId, assessmentId));
  res.json({ paid: payment?.status === "success", status: payment?.status ?? null });
});

router.post("/payments/initiate", async (req: Request, res: Response) => {
  const { assessmentId, planSlug, companyName, contactName, email, cardHolderName, cardNumber, expireYear, expireMonth, cvc, ip } = req.body as {
    assessmentId?: number;
    planSlug: string; companyName: string; contactName: string; email: string;
    cardHolderName: string; cardNumber: string; expireYear: string; expireMonth: string; cvc: string; ip?: string;
  };

  if (!planSlug || !companyName || !email || !cardNumber) {
    res.status(400).json({ error: "Eksik ödeme bilgileri" }); return;
  }

  const [plan] = await db.select().from(pricingPlansTable).where(eq(pricingPlansTable.slug, planSlug));
  if (!plan || !plan.isActive) { res.status(404).json({ error: "Plan bulunamadı" }); return; }

  const priceNum = Number(plan.price);
  const kdvAmount = +(priceNum * KDV_RATE).toFixed(2);
  const totalAmount = +(priceNum + kdvAmount).toFixed(2);

  const conversationId = `cs-${Date.now()}`;

  const nameParts = contactName.split(" ");
  const firstName = nameParts[0] ?? contactName;
  const lastName = nameParts.slice(1).join(" ") || "-";

  const result = await createPayment({
    price: String(priceNum),
    paidPrice: String(totalAmount),
    currency: plan.currency,
    installment: 1,
    paymentCard: { cardHolderName, cardNumber, expireYear, expireMonth, cvc },
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
      id: plan.slug,
      name: plan.name,
      category1: "Siber Güvenlik Hizmetleri",
      itemType: "VIRTUAL",
      price: String(priceNum),
    }],
    conversationId,
  });

  const [payment] = await db.insert(paymentsTable).values({
    assessmentId: assessmentId ?? null,
    planSlug: plan.slug,
    companyName,
    contactName,
    email,
    amount: String(totalAmount),
    currency: plan.currency,
    iyzicoPaymentId: result.paymentId,
    status: result.success ? "success" : "failed",
    kdvAmount: String(kdvAmount),
    netAmount: String(priceNum),
  }).returning();

  if (result.success) {
    logger.info({ paymentId: payment.id, planSlug }, "Payment successful");

    // Update customer subscription if logged in
    const customerId = getSession(req)["customerId"] as number | undefined;
    if (customerId) {
      await db.update(customersTable)
        .set({ subscriptionPlan: planSlug, subscriptionStatus: "active", updatedAt: new Date() })
        .where(eq(customersTable.id, customerId))
        .catch(err => logger.warn({ err, customerId }, "Failed to update customer subscription after payment"));
      logger.info({ customerId, planSlug }, "Customer subscription updated after payment");
    }

    res.json({ success: true, paymentId: payment.id });
  } else {
    logger.warn({ error: result.errorMessage, planSlug }, "Payment failed");
    res.status(402).json({ success: false, error: result.errorMessage ?? "Ödeme başarısız" });
  }
});

export default router;
