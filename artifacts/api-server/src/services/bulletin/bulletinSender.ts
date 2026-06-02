import { db, weeklyBulletinsTable, bulletinSubscribersTable } from "@workspace/db";
import { and, eq, or, sql } from "drizzle-orm";
import { sendMail } from "../email";
import { logger } from "../../lib/logger";

function getBaseUrl(): string {
  const domains = process.env["REPLIT_DOMAINS"];
  if (domains) return `https://${domains.split(",")[0]?.trim()}`;
  return "https://cyberstep.io";
}

function buildWelcomeEmail(name?: string | null): string {
  const base = getBaseUrl();
  const firstName = name?.split(" ")[0] ?? "Merhaba";
  return `
<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#060D1A;color:#E8EDF5;padding:32px;border-radius:12px">
  <div style="margin-bottom:24px">
    <span style="font-size:22px;font-weight:900;color:#E8EDF5">Cyber</span>
    <span style="font-size:22px;font-weight:900;color:#00C8FF">Step</span>
    <span style="font-size:13px;color:#7B8FAF">.io</span>
  </div>
  <h2 style="color:#00C8FF;font-size:20px;margin:0 0 16px">Haftalik Bultene Hos Geldiniz</h2>
  <p style="color:#A8B8D0;line-height:1.7">Merhaba ${firstName},</p>
  <p style="color:#A8B8D0;line-height:1.7">
    CyberStep Haftalik Istihbarat Bulteni'ne abone oldugunuz icin tesekkurler.
    Her Cuma, Turkiye'nin siber guvenlik gundemine dair 5 dakikada okunabilir ozet gelen kutunuza ulasacak.
  </p>
  <p style="color:#A8B8D0;line-height:1.7">
    Kapsam: Kritik CVE'ler, Turkiye etki verileri, mevzuat guncellemeleri, pratik tavsiyeler.
  </p>
  <a href="${base}" style="display:inline-block;background:#00C8FF;color:#060D1A;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;margin-top:16px">
    Ucretsiz Domain Taramasi Baslat
  </a>
  <p style="color:#5A6A80;font-size:12px;margin-top:24px">
    CyberStep.io · Turkiye'nin Bagimsiz Siber Guvenlik Platformu
  </p>
</div>`.trim();
}

export async function sendWeeklyBulletin(bulletinId: number): Promise<{ sent: number; failed: number }> {
  const [bulletin] = await db.select().from(weeklyBulletinsTable).where(eq(weeklyBulletinsTable.id, bulletinId));
  if (!bulletin) throw new Error("Bulten bulunamadi");
  if (bulletin.status !== "review") throw new Error("Bulten yayina hazir degil (status: review gerekli)");

  const subscribers = await db.select().from(bulletinSubscribersTable).where(
    and(
      eq(bulletinSubscribersTable.isActive, true),
      eq(bulletinSubscribersTable.countryCode, bulletin.countryCode ?? "TR"),
      or(
        eq(bulletinSubscribersTable.frequency, "weekly"),
        eq(bulletinSubscribersTable.frequency, "all"),
      ),
    )
  );

  let sent = 0;
  let failed = 0;

  for (const sub of subscribers) {
    try {
      const base = getBaseUrl();
      const unsubUrl = `${base}/api/bulletin/unsubscribe/${sub.id}`;
      const personalizedHtml = (bulletin.emailHtml ?? "")
        .replace("{UNSUBSCRIBE_URL}", unsubUrl)
        .replace("{SUBSCRIBER_NAME}", sub.name?.split(" ")[0] ?? "Merhaba");

      await sendMail({
        to: sub.email,
        subject: bulletin.emailSubject ?? `CyberStep Haftalik Bulten — Hafta ${bulletin.weekNumber}`,
        html: personalizedHtml,
      });

      await db.update(bulletinSubscribersTable).set({
        totalReceived: sql`total_received + 1`,
        updatedAt: new Date(),
      }).where(eq(bulletinSubscribersTable.id, sub.id));

      sent++;
      await new Promise(r => setTimeout(r, 80));
    } catch (err) {
      logger.error({ err, email: sub.email, bulletinId }, "Bulten gonderme hatasi");
      failed++;
    }
  }

  await db.update(weeklyBulletinsTable).set({
    status: "sent",
    sentAt: new Date(),
    recipientCount: sent,
    updatedAt: new Date(),
  }).where(eq(weeklyBulletinsTable.id, bulletinId));

  logger.info({ bulletinId, sent, failed }, "Haftalik bulten gonderildi");
  return { sent, failed };
}

export async function sendTestBulletin(bulletinId: number, testEmail: string): Promise<void> {
  const [bulletin] = await db.select().from(weeklyBulletinsTable).where(eq(weeklyBulletinsTable.id, bulletinId));
  if (!bulletin) throw new Error("Bulten bulunamadi");

  const html = (bulletin.emailHtml ?? "")
    .replace("{UNSUBSCRIBE_URL}", "#")
    .replace("{SUBSCRIBER_NAME}", "Test Kullanici");

  await sendMail({
    to: testEmail,
    subject: `[TEST] ${bulletin.emailSubject ?? `CyberStep Haftalik Bulten — Hafta ${bulletin.weekNumber}`}`,
    html,
  });
  logger.info({ bulletinId, testEmail }, "Test bulteni gonderildi");
}

export async function subscribeToBulletin(data: {
  email: string;
  name?: string;
  company?: string;
  title?: string;
  source?: string;
}): Promise<void> {
  const existing = await db.select({ id: bulletinSubscribersTable.id, isActive: bulletinSubscribersTable.isActive })
    .from(bulletinSubscribersTable)
    .where(eq(bulletinSubscribersTable.email, data.email))
    .limit(1);

  if (existing[0]) {
    if (!existing[0].isActive) {
      await db.update(bulletinSubscribersTable).set({
        isActive: true,
        unsubscribedAt: null,
        updatedAt: new Date(),
      }).where(eq(bulletinSubscribersTable.email, data.email));
    }
    return;
  }

  await db.insert(bulletinSubscribersTable).values({
    email: data.email,
    name: data.name,
    company: data.company,
    title: data.title,
    source: data.source ?? "website",
  });

  try {
    await sendMail({
      to: data.email,
      subject: "CyberStep Haftalik Bultene Abone Oldunuz",
      html: buildWelcomeEmail(data.name),
    });
  } catch (err) {
    logger.warn({ err, email: data.email }, "Hos geldin e-postasi gonderilemedi");
  }
}

export async function unsubscribeFromBulletin(subscriberId: number, reason?: string): Promise<void> {
  await db.update(bulletinSubscribersTable).set({
    isActive: false,
    unsubscribedAt: new Date(),
    unsubscribeReason: reason ?? "manuel",
    updatedAt: new Date(),
  }).where(eq(bulletinSubscribersTable.id, subscriberId));
}
