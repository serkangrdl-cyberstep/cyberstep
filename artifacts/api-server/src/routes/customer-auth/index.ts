import { Router } from "express";
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import { db } from "@workspace/db";
import { customersTable, assessmentsTable, reportsTable, domainScansTable, referralCodesTable, referralEventsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { generateTotpSecret, generateTotpQrUrl, verifyTotp } from "../../services/auth";
import { logger } from "../../lib/logger";
import { requireCustomer, getCustomerId } from "../../middleware/auth";
import { sendPasswordResetEmail, sendMail } from "../../services/email";

// Re-export for other modules that import from here
export { requireCustomer };

const router = Router();

function getSession(req: Request) {
  return req.session as unknown as Record<string, unknown>;
}

// POST /api/auth/register
router.post("/auth/register", async (req: Request, res: Response) => {
  const { email, password, fullName, companyName } = req.body as {
    email?: string; password?: string; fullName?: string; companyName?: string;
  };

  if (!email || !password || !fullName) {
    res.status(400).json({ error: "Ad soyad, e-posta ve şifre zorunludur" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Şifre en az 8 karakter olmalıdır" });
    return;
  }

  const [existing] = await db.select({ id: customersTable.id })
    .from(customersTable).where(eq(customersTable.email, email.toLowerCase()));
  if (existing) {
    res.status(409).json({ error: "Bu e-posta adresi zaten kullanılıyor" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const refCode = (req.body as Record<string, unknown>)["referralCode"] as string | undefined;

  const [customer] = await db.insert(customersTable)
    .values({
      email: email.toLowerCase(),
      passwordHash,
      fullName,
      companyName: companyName ?? null,
      referralCodeUsed: refCode?.toUpperCase() ?? null,
    })
    .returning();

  // If referral code provided, link the event
  if (refCode) {
    const code = refCode.toUpperCase();
    const [codeRow] = await db.select().from(referralCodesTable)
      .where(eq(referralCodesTable.code, code));
    if (codeRow) {
      // Check if there's a pending event for this email (invited via send-invite)
      const [existing] = await db.select().from(referralEventsTable)
        .where(eq(referralEventsTable.referralCodeId, codeRow.id));
      if (existing) {
        await db.update(referralEventsTable)
          .set({ referredCustomerId: customer.id, status: "registered", registeredAt: new Date() })
          .where(eq(referralEventsTable.id, existing.id));
      } else {
        await db.insert(referralEventsTable).values({
          referralCodeId: codeRow.id,
          referrerCustomerId: codeRow.customerId,
          referredEmail: email.toLowerCase(),
          referredCustomerId: customer.id,
          status: "registered",
          registeredAt: new Date(),
        });
        await db.update(referralCodesTable)
          .set({ totalUses: sql`${referralCodesTable.totalUses} + 1` })
          .where(eq(referralCodesTable.id, codeRow.id));
      }
    }
  }

  getSession(req)["customerId"] = customer.id;
  logger.info({ customerId: customer.id }, "Customer registered");

  // Fire-and-forget admin notification
  const intendedService = (req.body as Record<string, unknown>)["intendedService"] as string | undefined;
  setImmediate(async () => {
    try {
      const adminEmail = process.env["SMTP_USER"] ?? "info@cyberstep.io";
      const serviceLabel = intendedService ? ` — İlgilenilen Servis: ${intendedService}` : "";
      await sendMail({
        to: adminEmail,
        subject: `Yeni Kayıt: ${customer.fullName}${serviceLabel}`,
        html: `<p><strong>Ad Soyad:</strong> ${customer.fullName}</p>
<p><strong>E-posta:</strong> ${customer.email}</p>
<p><strong>Şirket:</strong> ${customer.companyName ?? "—"}</p>
${intendedService ? `<p><strong>İlgilenilen Servis:</strong> ${intendedService}</p>` : ""}
<p><strong>Kayıt Tarihi:</strong> ${new Date().toLocaleString("tr-TR")}</p>`,
      });
    } catch (err) {
      logger.warn({ err }, "Failed to send admin registration notification");
    }
  });

  const { passwordHash: _, totpSecret: __, ...safe } = customer;
  res.status(201).json(safe);
});

// POST /api/auth/login
router.post("/auth/login", async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: "E-posta ve şifre gerekli" });
    return;
  }

  const [customer] = await db.select().from(customersTable)
    .where(eq(customersTable.email, email.toLowerCase()));
  if (!customer) {
    res.status(401).json({ error: "Geçersiz e-posta veya şifre" });
    return;
  }

  const ok = await bcrypt.compare(password, customer.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Geçersiz e-posta veya şifre" });
    return;
  }

  if (customer.totpEnabled) {
    getSession(req)["pendingCustomerId"] = customer.id;
    res.json({ requiresTotp: true });
    return;
  }

  getSession(req)["customerId"] = customer.id;
  logger.info({ customerId: customer.id }, "Customer login");

  const { passwordHash: _, totpSecret: __, ...safe } = customer;
  res.json({ success: true, customer: safe });
});

// POST /api/auth/totp-verify (during login)
router.post("/auth/totp-verify", async (req: Request, res: Response) => {
  const pendingId = getSession(req)["pendingCustomerId"] as number | undefined;
  if (!pendingId) { res.status(401).json({ error: "Önce giriş yapın" }); return; }

  const { token } = req.body as { token?: string };
  if (!token) { res.status(400).json({ error: "TOTP kodu gerekli" }); return; }

  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, pendingId));
  if (!customer?.totpSecret) { res.status(400).json({ error: "TOTP yapılandırılmamış" }); return; }

  const valid = await verifyTotp(customer.totpSecret, token);
  if (!valid) { res.status(401).json({ error: "Geçersiz kod" }); return; }

  getSession(req)["customerId"] = customer.id;
  getSession(req)["pendingCustomerId"] = undefined;
  logger.info({ customerId: customer.id }, "Customer TOTP login");

  const { passwordHash: _, totpSecret: __, ...safe } = customer;
  res.json({ success: true, customer: safe });
});

// GET /api/auth/me
router.get("/auth/me", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req) as number;
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, customerId));
  if (!customer) { res.status(404).json({ error: "Kullanıcı bulunamadı" }); return; }
  const { passwordHash: _, totpSecret: __, ...safe } = customer;
  res.json(safe);
});

// POST /api/auth/logout
router.post("/auth/logout", (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) logger.error({ err }, "Session destroy error on customer logout");
    res.clearCookie("cstep.sid");
    res.json({ success: true });
  });
});

// POST /api/auth/totp-setup
router.post("/auth/totp-setup", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req) as number;
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, customerId));
  if (!customer) { res.status(404).json({ error: "Kullanıcı bulunamadı" }); return; }

  const secret = await generateTotpSecret();
  const otpauthUrl = await generateTotpQrUrl(customer.email, secret);
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

  getSession(req)["pendingTotpSecret"] = secret;
  res.json({ secret, qrDataUrl });
});

// POST /api/auth/totp-confirm
router.post("/auth/totp-confirm", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req) as number;
  const secret = getSession(req)["pendingTotpSecret"] as string | undefined;
  if (!secret) { res.status(400).json({ error: "Önce TOTP kurulumu başlatın" }); return; }

  const { token } = req.body as { token?: string };
  if (!token) { res.status(400).json({ error: "Doğrulama kodu gerekli" }); return; }

  const valid = await verifyTotp(secret, token);
  if (!valid) { res.status(401).json({ error: "Geçersiz kod. Tekrar deneyin." }); return; }

  await db.update(customersTable)
    .set({ totpSecret: secret, totpEnabled: true })
    .where(eq(customersTable.id, customerId));

  getSession(req)["pendingTotpSecret"] = undefined;
  logger.info({ customerId }, "Customer TOTP enabled");
  res.json({ success: true });
});

// POST /api/auth/totp-disable
router.post("/auth/totp-disable", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req) as number;
  await db.update(customersTable)
    .set({ totpSecret: null, totpEnabled: false })
    .where(eq(customersTable.id, customerId));
  logger.info({ customerId }, "Customer TOTP disabled");
  res.json({ success: true });
});

// POST /api/auth/forgot-password — şifre sıfırlama e-postası gönder
router.post("/auth/forgot-password", async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };
  if (!email) { res.status(400).json({ error: "E-posta adresi gerekli" }); return; }

  const [customer] = await db.select({
    id: customersTable.id,
    email: customersTable.email,
    fullName: customersTable.fullName,
  }).from(customersTable).where(eq(customersTable.email, email.toLowerCase()));

  // Güvenlik: kullanıcı bulunamasa bile aynı mesajı döndür
  if (!customer) {
    res.json({ success: true });
    return;
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 saat

  await db.update(customersTable)
    .set({ passwordResetToken: token, passwordResetExpiresAt: expiresAt })
    .where(eq(customersTable.id, customer.id));

  const domains = process.env["REPLIT_DOMAINS"];
  const base = domains ? `https://${domains.split(",")[0]?.trim()}` : "http://localhost:80";
  const resetUrl = `${base}/sifre-sifirla?token=${token}`;

  await sendPasswordResetEmail({ email: customer.email, fullName: customer.fullName, resetUrl });
  logger.info({ customerId: customer.id }, "Password reset email sent");
  res.json({ success: true });
});

// POST /api/auth/reset-password — token ile yeni şifre belirle
router.post("/auth/reset-password", async (req: Request, res: Response) => {
  const { token, password } = req.body as { token?: string; password?: string };
  if (!token || !password) { res.status(400).json({ error: "Token ve yeni şifre gerekli" }); return; }
  if (password.length < 8) { res.status(400).json({ error: "Şifre en az 8 karakter olmalıdır" }); return; }

  const [customer] = await db.select({
    id: customersTable.id,
    passwordResetToken: customersTable.passwordResetToken,
    passwordResetExpiresAt: customersTable.passwordResetExpiresAt,
  }).from(customersTable).where(eq(customersTable.passwordResetToken, token));

  if (!customer) { res.status(400).json({ error: "Geçersiz veya süresi dolmuş bağlantı" }); return; }
  if (!customer.passwordResetExpiresAt || new Date(customer.passwordResetExpiresAt) < new Date()) {
    res.status(400).json({ error: "Bu bağlantının süresi dolmuş. Lütfen yeni bir talep oluşturun." }); return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await db.update(customersTable)
    .set({ passwordHash, passwordResetToken: null, passwordResetExpiresAt: null })
    .where(eq(customersTable.id, customer.id));

  logger.info({ customerId: customer.id }, "Password reset successful");
  res.json({ success: true });
});

// ─── GET /api/customer/assessments ──────────────────────────────────────────
router.get("/customer/assessments", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req) as number;
  const [customer] = await db.select({ email: customersTable.email })
    .from(customersTable).where(eq(customersTable.id, customerId));
  if (!customer) { res.status(404).json({ error: "Kullanıcı bulunamadı" }); return; }

  const rows = await db
    .select({
      id: assessmentsTable.id,
      companyName: assessmentsTable.companyName,
      sector: assessmentsTable.sector,
      employeeCount: assessmentsTable.employeeCount,
      assessmentType: assessmentsTable.assessmentType,
      status: assessmentsTable.status,
      createdAt: assessmentsTable.createdAt,
      completedAt: assessmentsTable.completedAt,
      riskLevel: reportsTable.riskLevel,
      scorePercent: reportsTable.scorePercent,
      totalScore: reportsTable.totalScore,
      maxScore: reportsTable.maxScore,
      redAlarmCount: reportsTable.redAlarmCount,
      reportId: reportsTable.id,
    })
    .from(assessmentsTable)
    .leftJoin(reportsTable, eq(reportsTable.assessmentId, assessmentsTable.id))
    .where(eq(assessmentsTable.email, customer.email))
    .orderBy(desc(assessmentsTable.createdAt))
    .limit(50);

  res.json(rows);
});

// ─── GET /api/customer/domain-scans ─────────────────────────────────────────
router.get("/customer/domain-scans", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req) as number;
  const [customer] = await db.select({ email: customersTable.email })
    .from(customersTable).where(eq(customersTable.id, customerId));
  if (!customer) { res.status(404).json({ error: "Kullanıcı bulunamadı" }); return; }

  const rows = await db
    .select({
      id: domainScansTable.id,
      domain: domainScansTable.domain,
      overallScore: domainScansTable.overallScore,
      spfPass: domainScansTable.spfPass,
      dmarcPass: domainScansTable.dmarcPass,
      dkimPass: domainScansTable.dkimPass,
      mxPass: domainScansTable.mxPass,
      sslPass: domainScansTable.sslPass,
      hibpBreachCount: domainScansTable.hibpBreachCount,
      blacklisted: domainScansTable.blacklisted,
      shadowItServices: domainScansTable.shadowItServices,
      urlhausListed: domainScansTable.urlhausListed,
      usomListed: domainScansTable.usomListed,
      httpHeadersScore: domainScansTable.httpHeadersScore,
      ctSubdomainCount: domainScansTable.ctSubdomainCount,
      virusTotalReputation: domainScansTable.virusTotalReputation,
      virusTotalMalicious: domainScansTable.virusTotalMalicious,
      abuseIpdbScore: domainScansTable.abuseIpdbScore,
      abuseIpdbTotalReports: domainScansTable.abuseIpdbTotalReports,
      shodanOpenPorts: domainScansTable.shodanOpenPorts,
      shodanVulnCount: domainScansTable.shodanVulnCount,
      createdAt: domainScansTable.createdAt,
    })
    .from(domainScansTable)
    .where(eq(domainScansTable.email, customer.email))
    .orderBy(desc(domainScansTable.createdAt))
    .limit(50);

  res.json(rows);
});

export default router;
