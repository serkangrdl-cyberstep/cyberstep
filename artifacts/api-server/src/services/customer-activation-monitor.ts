import { db, customerOnboardingTable, customersTable } from "@workspace/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { sendMail } from "./email";
import { logger } from "../lib/logger";

const ADMIN_EMAIL = process.env["ADMIN_EMAIL"] ?? "info@cyberstep.com";

function getBaseUrl(): string {
  const domains = process.env["REPLIT_DOMAINS"];
  if (domains) return `https://${domains.split(",")[0]?.trim()}`;
  return "https://cyberstep.io";
}

function buildActivationNudgeEmail(params: {
  fullName: string;
  companyName: string | null;
  daysSinceRegistration: number;
}): string {
  const baseUrl = getBaseUrl();
  const name = params.companyName ?? params.fullName;

  return `
<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#060D1A;color:#E8EDF5;padding:32px;border-radius:12px">
  <div style="margin-bottom:24px">
    <span style="color:#E8EDF5;font-weight:bold;font-size:22px">Cyber</span><span style="color:#00C8FF;font-weight:bold;font-size:22px">Step</span><span style="color:#7B8FAF;font-size:14px">.io</span>
  </div>

  <h2 style="color:#E8EDF5;margin:0 0 8px;font-size:20px">Merhaba ${name},</h2>
  <p style="color:#A8B8D0;line-height:1.7;margin:0 0 24px">
    CyberStep'e kaydolmanızın üzerinden ${params.daysSinceRegistration} gün geçti.
    Henüz ilk alan adı taramanızı gerçekleştirmediğinizi fark ettik.
  </p>

  <div style="background:rgba(0,200,255,0.05);border:1px solid rgba(0,200,255,0.2);border-radius:10px;padding:20px;margin-bottom:24px">
    <div style="color:#00C8FF;font-weight:bold;margin-bottom:12px">İlk tarama size ne sağlar?</div>
    <ul style="list-style:none;padding:0;margin:0">
      <li style="margin-bottom:8px;color:#A8B8D0">Alan adınızın güvenlik skoru ve zayıf noktaları</li>
      <li style="margin-bottom:8px;color:#A8B8D0">DNS, SPF, DMARC, SSL yapılandırma analizi</li>
      <li style="margin-bottom:8px;color:#A8B8D0">Veri ihlali ve kara liste kontrolü</li>
      <li style="margin-bottom:8px;color:#A8B8D0">AI destekli kişiselleştirilmiş aksiyon planı</li>
    </ul>
  </div>

  <p style="color:#A8B8D0;line-height:1.7;margin:0 0 24px">
    Tarama sadece 2 dakika sürer, sonuçlar anında hazır olur.
  </p>

  <a href="${baseUrl}/tarama" style="display:block;background:#00C8FF;color:#060D1A;text-align:center;padding:14px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;margin-bottom:12px">
    Ücretsiz Tarama Başlat
  </a>
  <a href="${baseUrl}/hesabim" style="display:block;background:transparent;color:#00C8FF;border:1px solid rgba(0,200,255,0.3);text-align:center;padding:12px;border-radius:8px;text-decoration:none;font-size:14px">
    Hesabıma Git
  </a>

  <p style="font-size:12px;color:#5A6A80;margin-top:24px;line-height:1.6">
    Sorularınız için destek@cyberstep.io adresine yazabilirsiniz.
  </p>
</div>`.trim();
}

export async function runCustomerActivationMonitor(): Promise<number> {
  logger.info("customer_activation_monitor: başladı");

  const fiveDaysAgo  = new Date(Date.now() - 5  * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const pending = await db
    .select({
      customerId:   customerOnboardingTable.customerId,
      registeredAt: customerOnboardingTable.registeredAt,
      email:        customersTable.email,
      fullName:     customersTable.fullName,
      companyName:  customersTable.companyName,
    })
    .from(customerOnboardingTable)
    .innerJoin(customersTable, eq(customersTable.id, customerOnboardingTable.customerId))
    .where(
      and(
        eq(customerOnboardingTable.stepFirstScan, false),
        isNull(customerOnboardingTable.nudge1SentAt),
        sql`${customerOnboardingTable.registeredAt} <= ${fiveDaysAgo}`,
        sql`${customerOnboardingTable.registeredAt} >= ${fourteenDaysAgo}`,
      ),
    )
    .limit(50);

  if (pending.length === 0) {
    logger.info("customer_activation_monitor: aktivasyon bekleyen müşteri yok");
    return 0;
  }

  logger.info({ count: pending.length }, "customer_activation_monitor: aktivasyon bekleyenler bulundu");

  let sent = 0;
  const adminLines: string[] = [];

  for (const row of pending) {
    try {
      const daysSince = row.registeredAt
        ? Math.floor((Date.now() - new Date(row.registeredAt).getTime()) / (24 * 60 * 60 * 1000))
        : 5;

      const html = buildActivationNudgeEmail({
        fullName: row.fullName,
        companyName: row.companyName,
        daysSinceRegistration: daysSince,
      });

      await sendMail({
        to: row.email,
        subject: "İlk taramanızı henüz yapmadınız — CyberStep",
        html,
      });

      await db
        .update(customerOnboardingTable)
        .set({ nudge1SentAt: new Date() })
        .where(eq(customerOnboardingTable.customerId, row.customerId!));

      adminLines.push(`${row.companyName ?? row.fullName} &lt;${row.email}&gt; (${daysSince} gün)`);
      sent++;
      await new Promise(r => setTimeout(r, 400));
    } catch (err) {
      logger.warn({ err, customerId: row.customerId }, "customer_activation_monitor: e-posta gönderilemedi");
    }
  }

  if (sent > 0 && adminLines.length > 0) {
    try {
      await sendMail({
        to: ADMIN_EMAIL,
        subject: `CyberStep Aktivasyon — ${sent} müşteriye nudge gönderildi`,
        html: `<div style="font-family:monospace;background:#0a0a0a;color:#e0e0e0;padding:24px;border-radius:8px">
<h3 style="color:#00c8ff">Aktivasyon Nudge Raporu</h3>
<p>İlk taramayı yapmamış <strong>${sent}</strong> müşteriye hatırlatma e-postası gönderildi.</p>
<ul>${adminLines.map(l => `<li>${l}</li>`).join("")}</ul>
</div>`,
      });
    } catch (err) {
      logger.warn({ err }, "customer_activation_monitor: admin bildirimi gönderilemedi");
    }
  }

  logger.info({ sent }, "customer_activation_monitor: tamamlandı");
  return sent;
}
