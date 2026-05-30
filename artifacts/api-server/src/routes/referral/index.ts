import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  referralCodesTable,
  referralEventsTable,
  customersTable,
} from "@workspace/db";
import { eq, and, count, sql, desc, gte } from "drizzle-orm";
import { requireCustomer, getCustomerId, requireAdmin } from "../../middleware/auth";
import { logger } from "../../lib/logger";
import { sendMail } from "../../services/email";

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateCode(fullName: string): string {
  const firstName = fullName.split(" ")[0]?.toUpperCase().replace(/[^A-Z]/g, "") ?? "USER";
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return `${firstName.slice(0, 8)}-${suffix}`;
}

async function getOrCreateReferralCode(customerId: number): Promise<string> {
  const [existing] = await db.select()
    .from(referralCodesTable)
    .where(eq(referralCodesTable.customerId, customerId));
  if (existing) return existing.code;

  const [customer] = await db.select({ fullName: customersTable.fullName })
    .from(customersTable).where(eq(customersTable.id, customerId));
  if (!customer) throw new Error("Customer not found");

  let code = generateCode(customer.fullName);
  let attempts = 0;
  while (attempts < 10) {
    const [dup] = await db.select({ id: referralCodesTable.id })
      .from(referralCodesTable).where(eq(referralCodesTable.code, code));
    if (!dup) break;
    code = generateCode(customer.fullName);
    attempts++;
  }

  const [row] = await db.insert(referralCodesTable)
    .values({ customerId, code }).returning();
  return row!.code;
}

function getBaseUrl(): string {
  const domains = process.env["REPLIT_DOMAINS"];
  return domains ? `https://${domains.split(",")[0]?.trim()}` : "http://localhost:80";
}

// ─── Customer Routes ──────────────────────────────────────────────────────────

// GET /api/referral/my-code
router.get("/referral/my-code", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req) as number;
  const code = await getOrCreateReferralCode(customerId);
  const baseUrl = getBaseUrl();
  const link = `${baseUrl}/kayit?ref=${code}`;

  const [codeRow] = await db.select().from(referralCodesTable)
    .where(eq(referralCodesTable.customerId, customerId));

  res.json({ code, link, stats: codeRow ?? { totalUses: 0, totalRewardsGiven: 0 } });
});

// GET /api/referral/stats
router.get("/referral/stats", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req) as number;
  const [codeRow] = await db.select().from(referralCodesTable)
    .where(eq(referralCodesTable.customerId, customerId));
  if (!codeRow) {
    res.json({ sent: 0, registered: 0, converted: 0, rewarded: 0, rewardsEarned: 0, pending: [] });
    return;
  }

  const events = await db.select().from(referralEventsTable)
    .where(eq(referralEventsTable.referralCodeId, codeRow.id))
    .orderBy(desc(referralEventsTable.referredAt));

  const sent = events.length;
  const registered = events.filter(e => e.status !== "pending").length;
  const converted = events.filter(e => e.status === "converted" || e.status === "rewarded").length;
  const rewarded = events.filter(e => e.status === "rewarded").length;

  const pending = events
    .filter(e => e.status !== "rewarded")
    .slice(0, 10)
    .map(e => ({
      email: e.referredEmail,
      status: e.status,
      referredAt: e.referredAt,
    }));

  res.json({ sent, registered, converted, rewarded, rewardsEarned: codeRow.totalRewardsGiven, pending });
});

// POST /api/referral/validate/:code
router.post("/referral/validate/:code", async (req: Request, res: Response) => {
  const code = (req.params["code"] as string | undefined)?.toUpperCase();
  if (!code) { res.status(400).json({ valid: false, error: "Kod gerekli" }); return; }

  const [row] = await db.select({ id: referralCodesTable.id, isActive: referralCodesTable.isActive })
    .from(referralCodesTable).where(eq(referralCodesTable.code, code));

  if (!row || !row.isActive) {
    res.json({ valid: false, error: "Geçersiz referral kodu" });
    return;
  }
  res.json({ valid: true, reward: "Ilk ayiniz ucretsiz!" });
});

// GET /api/referral/leaderboard
router.get("/referral/leaderboard", async (_req: Request, res: Response) => {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const rows = await db
    .select({
      customerId: referralCodesTable.customerId,
      fullName: customersTable.fullName,
      converted: count(referralEventsTable.id),
    })
    .from(referralCodesTable)
    .innerJoin(customersTable, eq(customersTable.id, referralCodesTable.customerId))
    .leftJoin(referralEventsTable, and(
      eq(referralEventsTable.referralCodeId, referralCodesTable.id),
      gte(referralEventsTable.convertedAt, startOfMonth),
      sql`${referralEventsTable.status} IN ('converted','rewarded')`
    ))
    .groupBy(referralCodesTable.customerId, referralCodesTable.id, customersTable.fullName)
    .orderBy(desc(count(referralEventsTable.id)))
    .limit(10);

  const board = rows
    .filter(r => Number(r.converted) > 0)
    .map((r, i) => ({
      rank: i + 1,
      firstName: r.fullName.split(" ")[0] + " " + (r.fullName.split(" ")[1]?.[0] ?? "") + ".",
      referrals: Number(r.converted),
    }));

  res.json(board);
});

// ─── Reward Logic (called from payment flow) ──────────────────────────────────

export async function processReferralReward(referredCustomerId: number): Promise<void> {
  try {
    const [referred] = await db.select({
      id: customersTable.id,
      email: customersTable.email,
      fullName: customersTable.fullName,
      referralCodeUsed: customersTable.referralCodeUsed,
      nextBillingDate: customersTable.nextBillingDate,
    }).from(customersTable).where(eq(customersTable.id, referredCustomerId));

    if (!referred?.referralCodeUsed) return;

    const [codeRow] = await db.select().from(referralCodesTable)
      .where(eq(referralCodesTable.code, referred.referralCodeUsed));
    if (!codeRow) return;

    const [event] = await db.select().from(referralEventsTable)
      .where(and(
        eq(referralEventsTable.referralCodeId, codeRow.id),
        eq(referralEventsTable.referredCustomerId, referredCustomerId),
        sql`${referralEventsTable.status} = 'registered'`
      ));
    if (!event) return;

    // Mark converted
    await db.update(referralEventsTable)
      .set({ status: "rewarded", convertedAt: new Date(), rewardedAt: new Date(), rewardType: "free_month_both" })
      .where(eq(referralEventsTable.id, event.id));

    // Extend referrer billing by 30 days
    const [referrer] = await db.select({
      id: customersTable.id,
      email: customersTable.email,
      fullName: customersTable.fullName,
      nextBillingDate: customersTable.nextBillingDate,
    }).from(customersTable).where(eq(customersTable.id, codeRow.customerId));

    if (referrer) {
      const current = referrer.nextBillingDate ?? new Date();
      const extended = new Date(current);
      extended.setDate(extended.getDate() + 30);
      await db.update(customersTable)
        .set({ nextBillingDate: extended })
        .where(eq(customersTable.id, referrer.id));

      await db.update(referralCodesTable)
        .set({ totalRewardsGiven: sql`${referralCodesTable.totalRewardsGiven} + 1` })
        .where(eq(referralCodesTable.id, codeRow.id));

      // Reward emails
      const baseUrl = getBaseUrl();
      await sendMail({
        to: referrer.email,
        subject: "Davetiniz kabul edildi — 1 ay uzatildi",
        html: `<p>Merhaba ${referrer.fullName},</p>
<p>Davet ettiginiz kullanici CyberStep'e katildi ve odeme yapti.</p>
<p>Hesabiniza 1 aylik ucretsiz sure eklendi. Yeni bitis tarihiniz: <strong>${extended.toLocaleDateString("tr-TR")}</strong></p>
<p>CyberStep.io</p>`,
      });

      await sendMail({
        to: referred.email,
        subject: "1 ay ucretsiz — Referral odulunuz hazir",
        html: `<p>Merhaba ${referred.fullName},</p>
<p>${referrer.fullName} sayesinde ilk ayiniz ucretsiz.</p>
<p>Hesabinizi inceleyin: <a href="${baseUrl}/hesabim">${baseUrl}/hesabim</a></p>
<p>CyberStep.io</p>`,
      });
    }

    logger.info({ referredCustomerId, referrerId: codeRow.customerId }, "Referral rewarded");
  } catch (err) {
    logger.warn({ err, referredCustomerId }, "Referral reward processing failed");
  }
}

// POST /api/referral/send-invite — e-posta ile davet
router.post("/referral/send-invite", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req) as number;
  const { email: inviteeEmail } = req.body as { email?: string };
  if (!inviteeEmail || !inviteeEmail.includes("@")) {
    res.status(400).json({ error: "Gecerli bir e-posta adresi girin" });
    return;
  }

  const code = await getOrCreateReferralCode(customerId);
  const [customer] = await db.select({ fullName: customersTable.fullName })
    .from(customersTable).where(eq(customersTable.id, customerId));
  const baseUrl = getBaseUrl();
  const link = `${baseUrl}/kayit?ref=${code}`;

  await sendMail({
    to: inviteeEmail,
    subject: `${customer?.fullName ?? "Bir kullanici"} sizi CyberStep'e davet etti — ilk ay ucretsiz`,
    html: `<p>${customer?.fullName ?? "Bir kullanici"} sizi CyberStep.io'yu denemeye davet etti.</p>
<p>Sirketinizin siber guvenlik riskini 20 dakikada ogreyin.</p>
<p>Davet kodunuzu kullanarak kayit olun, ilk ayiniz ucretsiz:</p>
<p><a href="${link}" style="background:#10b981;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block">Kayit Ol</a></p>
<p>Veya bu linki kullanin: <a href="${link}">${link}</a></p>
<p>CyberStep.io</p>`,
  });

  // Track referral event
  const [codeRow] = await db.select().from(referralCodesTable)
    .where(eq(referralCodesTable.customerId, customerId));
  if (codeRow) {
    await db.insert(referralEventsTable).values({
      referralCodeId: codeRow.id,
      referrerCustomerId: customerId,
      referredEmail: inviteeEmail,
      status: "pending",
    });
    await db.update(referralCodesTable)
      .set({ totalUses: sql`${referralCodesTable.totalUses} + 1` })
      .where(eq(referralCodesTable.id, codeRow.id));
  }

  res.json({ ok: true });
});

// ─── Admin Routes ─────────────────────────────────────────────────────────────

// GET /api/admin/referrals
router.get("/admin/referrals", requireAdmin, async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(String(req.query["page"] ?? "1")));
  const limit = 50;
  const offset = (page - 1) * limit;

  const events = await db
    .select({
      id: referralEventsTable.id,
      status: referralEventsTable.status,
      referredEmail: referralEventsTable.referredEmail,
      referredAt: referralEventsTable.referredAt,
      registeredAt: referralEventsTable.registeredAt,
      convertedAt: referralEventsTable.convertedAt,
      rewardedAt: referralEventsTable.rewardedAt,
      referrerName: customersTable.fullName,
      referrerEmail: customersTable.email,
      code: referralCodesTable.code,
    })
    .from(referralEventsTable)
    .innerJoin(referralCodesTable, eq(referralCodesTable.id, referralEventsTable.referralCodeId))
    .innerJoin(customersTable, eq(customersTable.id, referralEventsTable.referrerCustomerId))
    .orderBy(desc(referralEventsTable.referredAt))
    .limit(limit).offset(offset);

  res.json(events);
});

// GET /api/admin/referrals/codes
router.get("/admin/referrals/codes", requireAdmin, async (_req: Request, res: Response) => {
  const codes = await db
    .select({
      id: referralCodesTable.id,
      customerId: referralCodesTable.customerId,
      code: referralCodesTable.code,
      totalReferrals: referralCodesTable.totalReferrals,
      successfulReferrals: referralCodesTable.successfulReferrals,
      pendingReferrals: referralCodesTable.pendingReferrals,
      totalRewardMonths: referralCodesTable.totalRewardMonths,
      createdAt: referralCodesTable.createdAt,
      customerName: customersTable.fullName,
      customerEmail: customersTable.email,
    })
    .from(referralCodesTable)
    .innerJoin(customersTable, eq(customersTable.id, referralCodesTable.customerId))
    .orderBy(desc(referralCodesTable.successfulReferrals));
  res.json(codes);
});

// GET /api/admin/referrals/stats
router.get("/admin/referrals/stats", requireAdmin, async (_req: Request, res: Response) => {
  const [totals] = await db.select({
    total: count(referralEventsTable.id),
  }).from(referralEventsTable);

  const [pending] = await db.select({ n: count() }).from(referralEventsTable)
    .where(eq(referralEventsTable.status, "pending"));
  const [converted] = await db.select({ n: count() }).from(referralEventsTable)
    .where(sql`${referralEventsTable.status} IN ('converted','rewarded')`);
  const [rewarded] = await db.select({ n: count() }).from(referralEventsTable)
    .where(eq(referralEventsTable.status, "rewarded"));
  const [codes] = await db.select({ n: count() }).from(referralCodesTable);

  res.json({
    totalEvents: Number(totals?.total ?? 0),
    pending: Number(pending?.n ?? 0),
    converted: Number(converted?.n ?? 0),
    rewarded: Number(rewarded?.n ?? 0),
    activeCodes: Number(codes?.n ?? 0),
  });
});

// PUT /api/admin/referrals/:id/override
router.put("/admin/referrals/:id/override", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  const { status } = req.body as { status?: string };
  if (!id || !status) { res.status(400).json({ error: "Gecersiz istek" }); return; }

  const valid = ["pending", "registered", "converted", "rewarded"];
  if (!valid.includes(status)) { res.status(400).json({ error: "Gecersiz durum" }); return; }

  await db.update(referralEventsTable).set({ status }).where(eq(referralEventsTable.id, id));
  res.json({ ok: true });
});

export default router;
