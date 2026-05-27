import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { paymentsTable, pricingPlansTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createPayment } from "../../services/iyzico";
import { logger } from "../../lib/logger";

const router = Router();

const KDV_RATE = 0.20; // %20 KDV

// POST /api/payments/initiate — start a payment
// GET /api/payments/status/:assessmentId — check if an assessment has been paid
router.get("/payments/status/:assessmentId", async (req: Request, res: Response) => {
  const assessmentId = Number(req.params.assessmentId);
  if (!assessmentId) { res.status(400).json({ paid: false }); return; }
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
    res.json({ success: true, paymentId: payment.id });
  } else {
    logger.warn({ error: result.errorMessage, planSlug }, "Payment failed");
    res.status(402).json({ success: false, error: result.errorMessage ?? "Ödeme başarısız" });
  }
});

export default router;
