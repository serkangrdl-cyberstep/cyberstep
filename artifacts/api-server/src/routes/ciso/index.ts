/**
 * CISO Asistan Paketi rotaları
 *
 * Public:
 *   POST /api/public/vciso-early-access  — vCISO erken erişim listesi kaydı
 *
 * Portal (requireCustomer):
 *   GET  /api/portal/ciso/compliance         — Uyum skoru + checklist
 *   PUT  /api/portal/ciso/profile            — Profil güncelle
 *   GET  /api/portal/ciso/board-reports      — Rapor listesi
 *   POST /api/portal/ciso/board-reports/:id/send — Raporu email ile gönder
 *   GET  /api/portal/ciso/policies           — Politika listesi
 *   POST /api/portal/ciso/policies/:type/approve — Politikayı onayla
 *
 * Admin (requireAdmin):
 *   GET  /api/admin/ciso/subscriptions
 *   POST /api/admin/ciso/generate-report/:customerId
 *   POST /api/admin/ciso/generate-policies/:customerId
 *   GET  /api/admin/vciso-early-access
 */

import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { db } from "@workspace/db";
import {
  cisoAssistantSubscriptionsTable,
  complianceScoresTable,
  securityPoliciesTable,
  vcisoEarlyAccessTable,
  boardReportsTable,
  customersTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireCustomer, requireAdmin } from "../../middleware/auth";
import { sendMail } from "../../services/email";
import { logger } from "../../lib/logger";

const router = Router();

function ipKeyGenerator(ip: string) {
  return ip;
}

// ─── Rate limiter ──────────────────────────────────────────────────────────────
const earlyAccessLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Çok fazla talep, lütfen daha sonra tekrar deneyin." },
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? req.socket?.remoteAddress ?? "unknown"),
});

// ─── PUBLIC ───────────────────────────────────────────────────────────────────

// POST /api/public/vciso-early-access
router.post(
  "/public/vciso-early-access",
  earlyAccessLimiter,
  async (req: Request, res: Response) => {
    const { email, name, company, title, employeeCount, currentCiso } = req.body as {
      email?: string;
      name?: string;
      company?: string;
      title?: string;
      employeeCount?: string;
      currentCiso?: boolean;
    };

    if (!email || !company) {
      res.status(400).json({ error: "Email ve şirket zorunlu" });
      return;
    }

    try {
      await db
        .insert(vcisoEarlyAccessTable)
        .values({
          email,
          name: name ?? null,
          company,
          title: title ?? null,
          employeeCount: employeeCount ?? null,
          currentCiso: currentCiso === true,
          source: "website",
        })
        .onConflictDoNothing();

      const BASE_URL = process.env["REPLIT_DOMAINS"]
        ? `https://${process.env["REPLIT_DOMAINS"].split(",")[0]?.trim()}`
        : "https://cyberstep.io";

      setImmediate(() => {
        void sendMail({
          to: email,
          subject: "vCISO Erken Erişim Listesine Eklendiniz — CyberStep.io",
          html: `
            <p>Merhaba${name ? ` ${name.split(" ")[0]}` : ""},</p>
            <p><strong>${company}</strong> için vCISO programı erken erişim listemize eklendiniz.</p>
            <p>2027 yılında program başladığında ilk haberdar edenler arasında olacaksınız.</p>
            <p>Bu süreçte <strong>CISO Asistan Paketi</strong> (2.500 TL/ay) rutin raporlama yükünüzü şimdiden otomatikleştirebilir:</p>
            <ul>
              <li>Aylık yönetim kurulu raporu</li>
              <li>Haftalık kişiselleştirilmiş tehdit özeti</li>
              <li>7545 ve KVKK uyum skoru</li>
              <li>7 güvenlik politikası şablonu</li>
            </ul>
            <a href="${BASE_URL}/sanal-ciso" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:8px">CISO Asistan Paketini İncele</a>
            <br><br>
            <small style="color:#888">CyberStep.io — <a href="mailto:info@cyberstep.io">info@cyberstep.io</a></small>
          `,
        });
      });

      res.json({ ok: true });
    } catch (err) {
      logger.error({ err }, "vCISO erken erişim kayıt hatası");
      res.status(500).json({ error: "Kayıt başarısız" });
    }
  }
);

// ─── PORTAL ───────────────────────────────────────────────────────────────────

// GET /api/portal/ciso/compliance
router.get(
  "/portal/ciso/compliance",
  requireCustomer,
  async (req: Request, res: Response) => {
    const customerId = (req.session as { customerId?: number }).customerId;
    if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

    const [sub] = await db
      .select()
      .from(cisoAssistantSubscriptionsTable)
      .where(eq(cisoAssistantSubscriptionsTable.customerId, customerId))
      .limit(1);

    const [latest] = await db
      .select()
      .from(complianceScoresTable)
      .where(eq(complianceScoresTable.customerId, customerId))
      .orderBy(desc(complianceScoresTable.calculatedAt))
      .limit(1);

    res.json({ subscription: sub ?? null, complianceScore: latest ?? null });
  }
);

// PUT /api/portal/ciso/profile
router.put(
  "/portal/ciso/profile",
  requireCustomer,
  async (req: Request, res: Response) => {
    const customerId = (req.session as { customerId?: number }).customerId;
    if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

    const {
      hasDedicatedCiso, cisoName, boardReportEmail,
      hasIncidentResponsePlan, hasDataInventory, kvkkVerbisRegistered,
      employeeCount, sector,
    } = req.body as Record<string, unknown>;

    const setFields: Record<string, unknown> = { updatedAt: new Date() };
    if (hasDedicatedCiso !== undefined) setFields["hasDedicatedCiso"] = hasDedicatedCiso;
    if (cisoName !== undefined) setFields["cisoName"] = cisoName;
    if (boardReportEmail !== undefined) setFields["boardReportEmail"] = boardReportEmail;
    if (hasIncidentResponsePlan !== undefined) setFields["hasIncidentResponsePlan"] = hasIncidentResponsePlan;
    if (hasDataInventory !== undefined) setFields["hasDataInventory"] = hasDataInventory;
    if (kvkkVerbisRegistered !== undefined) setFields["kvkkVerbisRegistered"] = kvkkVerbisRegistered;
    if (employeeCount !== undefined) setFields["employeeCount"] = Number(employeeCount);
    if (sector !== undefined) setFields["sector"] = sector;

    const existing = await db
      .select({ id: cisoAssistantSubscriptionsTable.id })
      .from(cisoAssistantSubscriptionsTable)
      .where(eq(cisoAssistantSubscriptionsTable.customerId, customerId))
      .limit(1);

    if (existing[0]) {
      await db
        .update(cisoAssistantSubscriptionsTable)
        .set(setFields)
        .where(eq(cisoAssistantSubscriptionsTable.customerId, customerId));
    } else {
      await db.insert(cisoAssistantSubscriptionsTable).values({
        customerId,
        ...setFields,
      });
    }

    res.json({ ok: true });
  }
);

// GET /api/portal/ciso/board-reports
router.get(
  "/portal/ciso/board-reports",
  requireCustomer,
  async (req: Request, res: Response) => {
    const customerId = (req.session as { customerId?: number }).customerId;
    if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

    const reports = await db
      .select()
      .from(boardReportsTable)
      .where(eq(boardReportsTable.customerId, customerId))
      .orderBy(desc(boardReportsTable.reportYear), desc(boardReportsTable.reportMonth))
      .limit(24);

    res.json(reports);
  }
);

// POST /api/portal/ciso/board-reports/:id/send
router.post(
  "/portal/ciso/board-reports/:id/send",
  requireCustomer,
  async (req: Request, res: Response) => {
    const customerId = (req.session as { customerId?: number }).customerId;
    if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

    const reportId = parseInt(String(req.params["id"] ?? "0"), 10);
    const [report] = await db
      .select()
      .from(boardReportsTable)
      .where(
        and(
          eq(boardReportsTable.id, reportId),
          eq(boardReportsTable.customerId, customerId)
        )
      )
      .limit(1);

    if (!report) { res.status(404).json({ error: "Rapor bulunamadı" }); return; }

    const [customer] = await db
      .select()
      .from(customersTable)
      .where(eq(customersTable.id, customerId))
      .limit(1);

    const [sub] = await db
      .select()
      .from(cisoAssistantSubscriptionsTable)
      .where(eq(cisoAssistantSubscriptionsTable.customerId, customerId))
      .limit(1);

    const sendTo = sub?.boardReportEmail ?? customer?.email;
    if (!sendTo) { res.status(400).json({ error: "Gönderilecek email adresi yok" }); return; }

    await sendMail({
      to: sendTo,
      subject: `${customer?.companyName ?? ""} — Güvenlik Raporu (${report.reportMonth}/${report.reportYear})`,
      html: `
        <p>Merhaba,</p>
        <p>İstediğiniz güvenlik raporu ekte bulunmaktadır.</p>
        <hr style="margin:16px 0">
        <p><strong>Güvenlik Skoru:</strong> ${report.currentScore ?? "-"}/100</p>
        <p>${report.executiveSummary ?? ""}</p>
        <br>
        <small style="color:#888">CyberStep CISO Asistan — <a href="mailto:info@cyberstep.io">info@cyberstep.io</a></small>
      `,
    });

    await db
      .update(boardReportsTable)
      .set({ status: "sent", sentToEmails: [sendTo] })
      .where(eq(boardReportsTable.id, reportId));

    res.json({ ok: true });
  }
);

// GET /api/portal/ciso/policies
router.get(
  "/portal/ciso/policies",
  requireCustomer,
  async (req: Request, res: Response) => {
    const customerId = (req.session as { customerId?: number }).customerId;
    if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

    const policies = await db
      .select()
      .from(securityPoliciesTable)
      .where(eq(securityPoliciesTable.customerId, customerId))
      .orderBy(securityPoliciesTable.policyType);

    res.json(policies);
  }
);

// POST /api/portal/ciso/policies/:type/approve
router.post(
  "/portal/ciso/policies/:type/approve",
  requireCustomer,
  async (req: Request, res: Response) => {
    const customerId = (req.session as { customerId?: number }).customerId;
    if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

    const policyType = String(req.params["type"] ?? "");

    await db
      .update(securityPoliciesTable)
      .set({ status: "approved", approvedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(securityPoliciesTable.customerId, customerId),
          eq(securityPoliciesTable.policyType, policyType)
        )
      );

    res.json({ ok: true });
  }
);

// ─── ADMIN ────────────────────────────────────────────────────────────────────

// GET /api/admin/ciso/subscriptions
router.get(
  "/admin/ciso/subscriptions",
  requireAdmin,
  async (req: Request, res: Response) => {
    const subs = await db
      .select({
        sub: cisoAssistantSubscriptionsTable,
        customer: {
          id: customersTable.id,
          email: customersTable.email,
          companyName: customersTable.companyName,
        },
      })
      .from(cisoAssistantSubscriptionsTable)
      .leftJoin(customersTable, eq(cisoAssistantSubscriptionsTable.customerId, customersTable.id))
      .orderBy(desc(cisoAssistantSubscriptionsTable.startedAt));

    res.json(subs);
  }
);

// POST /api/admin/ciso/generate-report/:customerId
router.post(
  "/admin/ciso/generate-report/:customerId",
  requireAdmin,
  async (req: Request, res: Response) => {
    const customerId = parseInt(String(req.params["customerId"] ?? "0"), 10);
    res.json({ ok: true, message: "Rapor arka planda üretiliyor..." });

    setImmediate(async () => {
      try {
        const { generateBoardReport } = await import("../../services/ciso/boardReportGenerator");
        await generateBoardReport(customerId);
        logger.info({ customerId }, "Manuel board raporu üretildi");
      } catch (err) {
        logger.error({ err, customerId }, "Manuel board raporu hatası");
      }
    });
  }
);

// POST /api/admin/ciso/generate-policies/:customerId
router.post(
  "/admin/ciso/generate-policies/:customerId",
  requireAdmin,
  async (req: Request, res: Response) => {
    const customerId = parseInt(String(req.params["customerId"] ?? "0"), 10);
    res.json({ ok: true, message: "Politikalar arka planda üretiliyor..." });

    setImmediate(async () => {
      try {
        const { generatePolicyLibrary } = await import("../../services/ciso/policyGenerator");
        const count = await generatePolicyLibrary(customerId);
        logger.info({ customerId, count }, "Manuel politika üretimi tamamlandı");
      } catch (err) {
        logger.error({ err, customerId }, "Manuel politika üretimi hatası");
      }
    });
  }
);

// GET /api/admin/vciso-early-access
router.get(
  "/admin/vciso-early-access",
  requireAdmin,
  async (req: Request, res: Response) => {
    const list = await db
      .select()
      .from(vcisoEarlyAccessTable)
      .orderBy(desc(vcisoEarlyAccessTable.subscribedAt));

    res.json({
      total: list.length,
      withCiso: list.filter((r) => r.currentCiso).length,
      withoutCiso: list.filter((r) => !r.currentCiso).length,
      list,
    });
  }
);

export default router;
