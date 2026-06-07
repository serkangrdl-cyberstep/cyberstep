import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { domainScansTable, cisoLeadsTable, insertCisoLeadSchema, pricingPlansTable, partnerLeadsTable, insertPartnerLeadSchema, servicePricesTable, jobApplicationsTable, serviceCatalogTable, customerServiceSubscriptionsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { logger } from "../../lib/logger";
import { createPayment, createPaymentWithStoredCard } from "../../services/iyzico";
import { sendMail } from "../../services/email";

const router = Router();

const publicScoreLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Çok fazla istek, 1 dakika sonra tekrar deneyin." },
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? req.socket?.remoteAddress ?? "unknown"),
});

function scoreToGrade(score: number): string {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "F";
}

function scoreToRisk(score: number): string {
  if (score >= 80) return "good";
  if (score >= 60) return "medium";
  if (score >= 40) return "weak";
  return "critical";
}

// GET /api/public/domain-score/:domain
router.get("/public/domain-score/:domain", publicScoreLimiter, async (req: Request, res: Response) => {
  const rawParam = req.params["domain"];
  const raw = Array.isArray(rawParam) ? rawParam[0] : rawParam;
  if (!raw || raw.length > 253) {
    res.status(400).json({ error: "Geçersiz domain" });
    return;
  }

  const domain = raw.toLowerCase().replace(/^www\./, "");
  if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(domain)) {
    res.status(400).json({ error: "Geçersiz domain formatı" });
    return;
  }

  try {
    const [scan] = await db
      .select({
        id: domainScansTable.id,
        domain: domainScansTable.domain,
        overallScore: domainScansTable.overallScore,
        spfPass: domainScansTable.spfPass,
        dmarcPass: domainScansTable.dmarcPass,
        sslPass: domainScansTable.sslPass,
        blacklisted: domainScansTable.blacklisted,
        createdAt: domainScansTable.createdAt,
      })
      .from(domainScansTable)
      .where(eq(domainScansTable.domain, domain))
      .orderBy(desc(domainScansTable.createdAt))
      .limit(1);

    if (!scan) {
      res.json({ domain, status: "not_scanned" });
      return;
    }

    const score = scan.overallScore;
    res.json({
      domain: scan.domain,
      status: "scanned",
      score,
      grade: scoreToGrade(score),
      risk: scoreToRisk(score),
      lastScanAt: scan.createdAt,
      scanId: scan.id,
      summary: {
        spf: scan.spfPass,
        dmarc: scan.dmarcPass,
        ssl: scan.sslPass,
        blacklisted: scan.blacklisted,
      },
    });
  } catch (err) {
    logger.error({ err, domain }, "Public domain score lookup failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// GET /api/public/pricing — aktif fiyatlandırma planları (no auth)
router.get("/public/pricing", async (_req: Request, res: Response) => {
  try {
    const plans = await db.select().from(pricingPlansTable)
      .where(eq(pricingPlansTable.isActive, true))
      .orderBy(pricingPlansTable.sortOrder);
    res.json(plans);
  } catch (err) {
    logger.error({ err }, "Public pricing fetch failed");
    res.json([]);
  }
});

// POST /api/public/ciso-lead — save vCISO inquiry
const cisoLeadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Çok fazla talep gönderildi, lütfen daha sonra tekrar deneyin." },
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? req.socket?.remoteAddress ?? "unknown"),
});

router.post("/public/ciso-lead", cisoLeadLimiter, async (req: Request, res: Response) => {
  const parsed = insertCisoLeadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Geçersiz form verisi", details: parsed.error.issues });
    return;
  }

  try {
    const [lead] = await db.insert(cisoLeadsTable).values(parsed.data).returning({ id: cisoLeadsTable.id });
    logger.info({ leadId: lead?.id, company: parsed.data.company }, "New CISO lead submitted");
    res.status(201).json({ ok: true, message: "Talebiniz alındı" });
  } catch (err) {
    logger.error({ err }, "Failed to save CISO lead");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// POST /api/public/partner-lead — ERP / insurance / threat-intel / score-api leads
const partnerLeadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Çok fazla talep, lütfen daha sonra tekrar deneyin." },
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? req.socket?.remoteAddress ?? "unknown"),
});

router.post("/public/partner-lead", partnerLeadLimiter, async (req: Request, res: Response) => {
  const parsed = insertPartnerLeadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Geçersiz form verisi", details: parsed.error.issues });
    return;
  }

  try {
    const [lead] = await db.insert(partnerLeadsTable).values(parsed.data).returning({ id: partnerLeadsTable.id });
    logger.info({ leadId: lead?.id, leadType: parsed.data.leadType, company: parsed.data.company }, "New partner lead submitted");
    res.status(201).json({ ok: true, message: "Başvurunuz alındı" });
  } catch (err) {
    logger.error({ err }, "Failed to save partner lead");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// GET /api/public/prices — all service prices (public, no auth)
router.get("/public/prices", async (_req, res: Response) => {
  try {
    const rows = await db.select().from(servicePricesTable);
    const map: Record<string, { label: string; amount: number; unit: string }> = {};
    for (const r of rows) map[r.slug] = { label: r.label, amount: parseFloat(r.amountTl), unit: r.unit };
    res.json(map);
  } catch (err) {
    logger.error({ err }, "Failed to fetch service prices");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// GET /api/public/service-catalog — aktif kurumsal servisler (no auth)
router.get("/public/service-catalog", async (_req: Request, res: Response) => {
  try {
    const rows = await db
      .select()
      .from(serviceCatalogTable)
      .where(and(
        eq(serviceCatalogTable.isActive, true),
        eq(serviceCatalogTable.visibility, "public"),
      ))
      .orderBy(serviceCatalogTable.sortOrder);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "Failed to fetch public service catalog");
    res.json([]);
  }
});

// POST /api/public/job-application — career applications
const FREE_EMAIL_DOMAINS = ["gmail.com","hotmail.com","yahoo.com","outlook.com","yandex.com","icloud.com","live.com","msn.com","me.com","aol.com","protonmail.com","mail.com","zoho.com"];
function isCorporateEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return !!domain && !FREE_EMAIL_DOMAINS.includes(domain);
}

const jobAppLimiter = rateLimit({ windowMs: 60*60*1000, limit: 3, standardHeaders: true, legacyHeaders: false, message: { error: "Çok fazla başvuru." }, keyGenerator: (req) => ipKeyGenerator(req.ip ?? req.socket?.remoteAddress ?? "unknown") });

router.post("/public/job-application", jobAppLimiter, async (req: Request, res: Response) => {
  const { fullName, email, phone, cvFileName, cvFileData, position, message } = req.body as Record<string, string>;
  if (!fullName?.trim() || !email?.trim() || !phone?.trim()) {
    res.status(400).json({ error: "Ad soyad, e-posta ve telefon zorunludur." });
    return;
  }
  try {
    const corporate = isCorporateEmail(email);
    await db.insert(jobApplicationsTable).values({ fullName: fullName.trim(), email: email.trim().toLowerCase(), phone: phone.trim(), cvFileName: cvFileName ?? null, cvFileData: cvFileData ?? null, position: position ?? null, message: message ?? null, isCorporateEmail: corporate });
    if (corporate) {
      const domain = email.split("@")[1]!;
      await db.execute(sql.raw(`INSERT INTO lead_gen_leads (domain, score, discovery_method, status, created_at) VALUES ('${domain}', 40, 'job_application', 'new', now()) ON CONFLICT (domain) DO NOTHING`));
    }
    logger.info({ email, corporate }, "New job application");
    res.status(201).json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to save job application");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

const KDV_RATE = 0.20;
const ANNUAL_DISCOUNT = 0.15;

function calcRenewalPrices(monthlyTl: number, billingCycle: "monthly" | "annual") {
  const base = billingCycle === "annual"
    ? +(monthlyTl * 12 * (1 - ANNUAL_DISCOUNT)).toFixed(2)
    : +monthlyTl.toFixed(2);
  const kdv = +(base * KDV_RATE).toFixed(2);
  const total = +(base + kdv).toFixed(2);
  return { base, kdv, total };
}

function validateTokenParam(token: unknown): token is string {
  return typeof token === "string" && token.length === 64 && /^[0-9a-f]+$/.test(token);
}

// GET /api/public/renewal-token/:token
// Validates a renewal token and returns subscription info (no auth required)
router.get("/public/renewal-token/:token", async (req: Request, res: Response) => {
  const rawToken = req.params["token"];
  if (!rawToken || typeof rawToken !== "string" || rawToken.length !== 64 || !/^[0-9a-f]+$/.test(rawToken)) {
    res.status(400).json({ error: "Geçersiz token" });
    return;
  }
  try {
    const now = new Date();
    const [sub] = await db
      .select({
        id: customerServiceSubscriptionsTable.id,
        serviceSlug: customerServiceSubscriptionsTable.serviceSlug,
        serviceLabel: customerServiceSubscriptionsTable.serviceLabel,
        status: customerServiceSubscriptionsTable.status,
        expiresAt: customerServiceSubscriptionsTable.expiresAt,
        iyzicoCardUserKey: customerServiceSubscriptionsTable.iyzicoCardUserKey,
        iyzicoCardToken: customerServiceSubscriptionsTable.iyzicoCardToken,
        renewalTokenExpiresAt: customerServiceSubscriptionsTable.renewalTokenExpiresAt,
      })
      .from(customerServiceSubscriptionsTable)
      .where(
        eq(customerServiceSubscriptionsTable.renewalToken, rawToken),
      )
      .limit(1);

    if (!sub) {
      res.status(404).json({ error: "Token bulunamadı" });
      return;
    }

    if (!sub.renewalTokenExpiresAt || sub.renewalTokenExpiresAt < now) {
      res.status(410).json({ error: "Token süresi dolmuş" });
      return;
    }

    res.json({
      subscriptionId: sub.id,
      serviceSlug: sub.serviceSlug,
      serviceLabel: sub.serviceLabel,
      status: sub.status,
      expiresAt: sub.expiresAt,
      hasStoredCard: !!(sub.iyzicoCardUserKey && sub.iyzicoCardToken),
    });
  } catch (err) {
    logger.error({ err }, "renewal-token lookup error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// POST /api/public/renewal-token/:token/renew
// Processes renewal authorized by a valid renewal token — no session/login required
router.post("/public/renewal-token/:token/renew", async (req: Request, res: Response) => {
  const rawToken = req.params["token"];
  if (!validateTokenParam(rawToken)) {
    res.status(400).json({ error: "Geçersiz token" });
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

  try {
    const now = new Date();

    const [sub] = await db
      .select()
      .from(customerServiceSubscriptionsTable)
      .where(eq(customerServiceSubscriptionsTable.renewalToken, rawToken))
      .limit(1);

    if (!sub) {
      res.status(404).json({ error: "Token bulunamadı" });
      return;
    }

    if (!sub.renewalTokenExpiresAt || sub.renewalTokenExpiresAt < now) {
      res.status(410).json({ error: "Token süresi dolmuş. Lütfen hesabınıza giriş yaparak yenileme yapın." });
      return;
    }

    const useStoredCard = !!(sub.iyzicoCardUserKey && sub.iyzicoCardToken && !cardNumber);
    const useNewCard = !!(cardNumber && cardHolderName && expireMonth && expireYear && cvc);

    if (!useStoredCard && !useNewCard) {
      res.status(400).json({
        error: "Kart bilgileri gerekli",
        hasStoredCard: !!(sub.iyzicoCardUserKey && sub.iyzicoCardToken),
      });
      return;
    }

    const [catalogRow] = await db
      .select({ monthlyPriceTl: serviceCatalogTable.monthlyPriceTl })
      .from(serviceCatalogTable)
      .where(eq(serviceCatalogTable.slug, sub.serviceSlug));

    const monthlyTl = Number(catalogRow?.monthlyPriceTl ?? 0) || Number(sub.amountPaid ?? 0) / 1.2;
    const billingCycle = (sub.billingCycle ?? "monthly") as "monthly" | "annual";
    const { base, kdv, total } = calcRenewalPrices(monthlyTl, billingCycle);
    const conversationId = `renew-token-${sub.id}-${Date.now()}`;

    const nameParts = sub.contactName.trim().split(" ");
    const firstName = nameParts[0] ?? sub.contactName;
    const lastName = nameParts.slice(1).join(" ") || "-";

    const buyerInfo = {
      id: sub.email,
      name: firstName,
      surname: lastName,
      email: sub.email,
      identityNumber: "11111111111",
      registrationAddress: "Türkiye",
      city: "İstanbul",
      country: "Turkey",
      ip: ip ?? "127.0.0.1",
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
      logger.warn({ error: paymentResult.errorMessage, subId: sub.id }, "Token-based renewal payment failed");
      res.status(402).json({ success: false, error: paymentResult.errorMessage ?? "Ödeme başarısız" });
      return;
    }

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
        renewalToken: null,
        renewalTokenExpiresAt: null,
        ...(paymentResult.cardUserKey ? { iyzicoCardUserKey: paymentResult.cardUserKey } : {}),
        ...(paymentResult.cardToken ? { iyzicoCardToken: paymentResult.cardToken } : {}),
      })
      .where(eq(customerServiceSubscriptionsTable.id, sub.id));

    logger.info({ subId: sub.id, email: sub.email, newExpiresAt, useStoredCard }, "Subscription renewed via token");

    setImmediate(() => {
      const cycleLabel = billingCycle === "annual" ? "Yıllık" : "Aylık";
      const receiptHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;background:#f4f7fb;padding:32px">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
  <h2 style="color:#0ea5e9;margin-top:0">Abonelik Yenilendi</h2>
  <p>Sayın <strong>${sub.contactName}</strong>,</p>
  <p><strong>${sub.serviceLabel}</strong> aboneliğiniz başarıyla yenilendi.</p>
  <table style="width:100%;border-collapse:collapse;margin:24px 0">
    <tr style="border-bottom:1px solid #e2e8f0"><td style="padding:8px 0;color:#64748b">Servis</td><td style="padding:8px 0;text-align:right;font-weight:600">${sub.serviceLabel}</td></tr>
    <tr style="border-bottom:1px solid #e2e8f0"><td style="padding:8px 0;color:#64748b">Dönem</td><td style="padding:8px 0;text-align:right">${cycleLabel}</td></tr>
    <tr style="border-bottom:1px solid #e2e8f0"><td style="padding:8px 0;color:#64748b">Tutar (KDV hariç)</td><td style="padding:8px 0;text-align:right">${base.toLocaleString("tr-TR")} TL</td></tr>
    <tr style="border-bottom:1px solid #e2e8f0"><td style="padding:8px 0;color:#64748b">KDV (%20)</td><td style="padding:8px 0;text-align:right">${kdv.toLocaleString("tr-TR")} TL</td></tr>
    <tr><td style="padding:8px 0;font-weight:700">Toplam</td><td style="padding:8px 0;text-align:right;font-weight:700;color:#0ea5e9">₺${total.toLocaleString("tr-TR")}</td></tr>
  </table>
  <p style="color:#64748b;font-size:14px">Yeni bitiş tarihi: <strong>${newExpiresAt.toLocaleDateString("tr-TR")}</strong></p>
  ${paymentResult.paymentId ? `<p style="color:#94a3b8;font-size:12px">Ödeme Ref: ${paymentResult.paymentId}</p>` : ""}
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
  <p style="color:#64748b;font-size:13px">Sorularınız için <a href="mailto:info@cyberstep.io" style="color:#0ea5e9">info@cyberstep.io</a> adresine yazabilirsiniz.</p>
  <p style="color:#94a3b8;font-size:12px">CyberStep.io — işletme Siber Güvenlik Platformu</p>
</div></body></html>`;
      sendMail({ to: sub.email, subject: `Abonelik Yenileme Onayı: ${sub.serviceLabel}`, html: receiptHtml })
        .catch(err => logger.warn({ err, subId: sub.id }, "Token renewal receipt email failed"));
    });

    res.json({ success: true, newExpiresAt, serviceLabel: sub.serviceLabel });
  } catch (err) {
    logger.error({ err }, "Token-based renewal error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;
