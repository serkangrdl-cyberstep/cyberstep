import { Router } from "express";
import { db } from "@workspace/db";
import { scanLeadsTable } from "@workspace/db";
import { eq, and, lte, isNotNull } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { sendScanLeadDripEmail } from "../../services/email";
import crypto from "node:crypto";

const router = Router();

// Unsubscribe token: base64url(email:domain) — keyin SHA256 hex truncated
function makeUnsubToken(email: string, domain: string): string {
  return crypto.createHash("sha256").update(`${email}:${domain}:unsub`).digest("hex").slice(0, 32);
}

// POST /api/scan-leads — kayıt ol ve ilk e-postayı gönder
router.post("/scan-leads", async (req, res) => {
  const { email, domain, scanId, overallScore } = req.body as {
    email?: unknown; domain?: unknown; scanId?: unknown; overallScore?: unknown;
  };

  if (typeof email !== "string" || !email.includes("@") || typeof domain !== "string" || domain.length < 3) {
    res.status(400).json({ error: "Geçersiz veri" });
    return;
  }

  try {
    // Upsert — aynı email+domain için yeni kayıt açma
    const existing = await db.select({ id: scanLeadsTable.id, unsubscribed: scanLeadsTable.unsubscribed })
      .from(scanLeadsTable)
      .where(and(eq(scanLeadsTable.email, email), eq(scanLeadsTable.domain, domain)))
      .limit(1);

    if (existing[0]?.unsubscribed) {
      res.json({ ok: true, status: "unsubscribed" });
      return;
    }

    if (existing[0]) {
      res.json({ ok: true, status: "exists" });
      return;
    }

    // Yeni lead: adım 0 anında gönder, adım 1 = 2 gün sonra
    const day2 = new Date();
    day2.setDate(day2.getDate() + 2);

    const scanIdNum = typeof scanId === "number" ? scanId : null;
    const scoreNum = typeof overallScore === "number" ? overallScore : null;

    await db.insert(scanLeadsTable).values({
      email,
      domain,
      scanId: scanIdNum,
      overallScore: scoreNum,
      sequenceStep: 1,
      nextSendAt: day2,
      lastSentAt: new Date(),
    });

    const unsubToken = makeUnsubToken(email, domain);
    const sent = await sendScanLeadDripEmail({ email, domain, overallScore: scoreNum ?? 0, step: 0, unsubToken });
    req.log?.info({ email, domain, sent }, "Scan lead registered");

    res.json({ ok: true, status: "created", sent });
  } catch (err) {
    req.log?.error({ err }, "scan-leads POST error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// GET /api/scan-leads/unsubscribe/:token — çıkış linki
router.get("/scan-leads/unsubscribe/:token", async (req, res) => {
  const { token } = req.params;

  try {
    // Token'a göre satırı bul — brute-force koruması: yalnızca token sütunuyla arama yapamayız çünkü
    // token email:domain'den türetiliyor; tüm aktif leadleri yükleyip eşleştiriyoruz
    const leads = await db.select({ id: scanLeadsTable.id, email: scanLeadsTable.email, domain: scanLeadsTable.domain })
      .from(scanLeadsTable)
      .where(eq(scanLeadsTable.unsubscribed, false))
      .limit(500);

    const match = leads.find(l => makeUnsubToken(l.email, l.domain) === token);

    if (!match) {
      res.send(`<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>Abonelik</title></head><body style="font-family:sans-serif;text-align:center;padding:80px 20px"><h2>Bu bağlantı geçersiz veya süresi dolmuş.</h2></body></html>`);
      return;
    }

    await db.update(scanLeadsTable).set({ unsubscribed: true }).where(eq(scanLeadsTable.id, match.id));
    logger.info({ email: match.email, domain: match.domain }, "Scan lead unsubscribed");

    res.send(`<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>Abonelikten Çıkıldı</title></head>
<body style="font-family:sans-serif;text-align:center;padding:80px 20px;background:#f8fafc">
  <div style="max-width:480px;margin:auto;background:#fff;border-radius:12px;padding:40px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <div style="font-size:40px;margin-bottom:16px">✓</div>
    <h2 style="margin:0 0 8px;color:#0f172a">Abonelikten çıkıldınız</h2>
    <p style="color:#64748b;font-size:14px;margin:0 0 24px">${match.domain} ile ilgili e-postalar artık gönderilmeyecek.</p>
    <a href="/" style="color:#10b981;font-size:14px;font-weight:600;text-decoration:none">CyberStep.io'ya Dön</a>
  </div>
</body></html>`);
  } catch (err) {
    logger.error({ err }, "Unsubscribe error");
    res.status(500).send("Hata oluştu.");
  }
});

// ─── Drip cron helper (index.ts'ten çağrılır) ─────────────────────────────────
export async function runScanLeadDripCron(): Promise<void> {
  const now = new Date();

  const due = await db.select()
    .from(scanLeadsTable)
    .where(and(
      eq(scanLeadsTable.unsubscribed, false),
      isNotNull(scanLeadsTable.nextSendAt),
      lte(scanLeadsTable.nextSendAt, now),
    ))
    .limit(50);

  logger.info({ count: due.length }, "Scan lead drip cron: due leads");

  for (const lead of due) {
    const step = lead.sequenceStep;
    if (step > 3) continue; // dizin bitti

    const unsubToken = makeUnsubToken(lead.email, lead.domain);
    await sendScanLeadDripEmail({
      email: lead.email,
      domain: lead.domain,
      overallScore: lead.overallScore ?? 0,
      step,
      unsubToken,
    });

    // Sonraki adım zamanını hesapla
    let nextStep: number | null = null;
    let nextSendAt: Date | null = null;

    const SCHEDULE_DAYS = [2, 4, 7]; // adım 1→2→3 için gün aralıkları adım 0'dan sonra
    const stepOffsets: Record<number, number> = { 1: 2, 2: 4, 3: 7 };

    if (step + 1 <= 3) {
      nextStep = step + 1;
      const daysFromNow = stepOffsets[nextStep] ?? 2;
      nextSendAt = new Date();
      nextSendAt.setDate(nextSendAt.getDate() + (daysFromNow - (stepOffsets[step] ?? 0)));
    }

    await db.update(scanLeadsTable).set({
      sequenceStep: nextStep ?? step + 1,
      lastSentAt: now,
      nextSendAt,
    }).where(eq(scanLeadsTable.id, lead.id));
  }
}

export default router;
