/**
 * Dunning Manager — Başarısız Ödeme Akışı
 *
 * Gün 0:  Anlık bildirim emaili
 * Gün 3:  Kart güncelleme isteği emaili
 * Gün 7:  Son uyarı emaili
 * Gün 10: Aboneliği askıya al (status = 'suspended')
 * Gün 30: Müşteriyi arşivle (subscriptionStatus = 'inactive')
 */

import { db } from "@workspace/db";
import {
  customersTable,
  customerServiceSubscriptionsTable,
  subscriptionChangesTable,
} from "@workspace/db";
import { eq, and, isNotNull, lte } from "drizzle-orm";
import { sendMail } from "./email";
import { logger } from "../lib/logger";

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

function daysSince(ts: Date | null | undefined): number {
  if (!ts) return 0;
  return Math.floor((Date.now() - new Date(ts).getTime()) / 86_400_000);
}

const BASE_URL = process.env["REPLIT_DOMAINS"]
  ? `https://${process.env["REPLIT_DOMAINS"].split(",")[0]?.trim()}`
  : "http://localhost:80";

// ─── Email içerikleri ─────────────────────────────────────────────────────────

function buildDunningEmail(
  customerName: string,
  day: "day0" | "day3" | "day7" | "day10",
): string {
  const billingUrl = `${BASE_URL}/portal/billing`;
  const subjects: Record<typeof day, string> = {
    day0: "Ödemeniz alınamadı",
    day3: "Kart bilgilerinizi güncelleyin",
    day7: "Son uyarı — servis 3 gün içinde duracak",
    day10: "CyberStep servisiniz durduruldu",
  };
  const bodies: Record<typeof day, string> = {
    day0: `Sayın ${customerName},<br><br>
Otomatik ödemeniz alınamadı. Aboneliğinizin devam etmesi için lütfen kart bilgilerinizi güncelleyin.<br><br>
<a href="${billingUrl}" style="background:#10b981;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px">Ödeme Yöntemini Güncelle</a>`,
    day3: `Sayın ${customerName},<br><br>
3 gündür ödemeniz alınamıyor. Lütfen kart bilgilerinizi güncelleyin.<br><br>
<a href="${billingUrl}" style="background:#f59e0b;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px">Kartı Güncelle</a>`,
    day7: `Sayın ${customerName},<br><br>
<strong>Son uyarı:</strong> 3 gün içinde ödeme alınamazsa servisiniz durdurulacak.<br><br>
<a href="${billingUrl}" style="background:#ef4444;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px">Hemen Güncelle</a>`,
    day10: `Sayın ${customerName},<br><br>
Ödeme alınamadığı için servisiniz geçici olarak durdurulmuştur.<br>
Aboneliğinizi yeniden başlatmak için kart bilgilerinizi güncelleyin.<br><br>
<a href="${billingUrl}" style="background:#6366f1;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px">Aboneliği Yeniden Başlat</a>`,
  };
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#111;max-width:600px;margin:0 auto;padding:20px">
<h2>${subjects[day]}</h2><p>${bodies[day]}</p>
<hr style="margin:30px 0"><p style="font-size:12px;color:#888">CyberStep.io — Siber Güvenlik</p>
</body></html>`;
}

// ─── Webhook tetikleyici (Iyzico payment_failed → burası çağrılır) ────────────

export async function handlePaymentFailure(
  customerId: number,
  failureReason: string,
): Promise<void> {
  const [customer] = await db.select().from(customersTable)
    .where(eq(customersTable.id, customerId)).limit(1);
  if (!customer) return;

  await db.update(customerServiceSubscriptionsTable).set({
    status: "suspended",
    paymentFailedAt: new Date(),
    paymentFailureReason: failureReason,
    paymentRetryCount: 1,
  }).where(
    and(
      eq(customerServiceSubscriptionsTable.customerId, customerId),
      eq(customerServiceSubscriptionsTable.status, "active"),
    )
  );

  await db.insert(subscriptionChangesTable).values({
    customerId,
    changeType: "payment_failed",
    reason: failureReason,
    performedBy: "system",
  });

  setImmediate(async () => {
    try {
      await sendMail({
        to: customer.email,
        subject: "CyberStep — Ödemeniz alınamadı",
        html: buildDunningEmail(customer.fullName, "day0"),
      });
      logger.info({ customerId }, "Dunning day0 email sent");
    } catch (err) {
      logger.warn({ err, customerId }, "Dunning day0 email failed");
    }
  });
}

// ─── Günlük dunning cron'u (index.ts'ten çağrılır) ───────────────────────────

export async function runDunningCron(): Promise<number> {
  const failedSubs = await db.select({
    sub: customerServiceSubscriptionsTable,
    customer: customersTable,
  }).from(customerServiceSubscriptionsTable)
    .innerJoin(customersTable, eq(customerServiceSubscriptionsTable.customerId, customersTable.id))
    .where(
      and(
        eq(customerServiceSubscriptionsTable.status, "suspended"),
        isNotNull(customerServiceSubscriptionsTable.paymentFailedAt),
      )
    );

  let actioned = 0;

  for (const { sub, customer } of failedSubs) {
    const days = daysSince(sub.paymentFailedAt);

    if (days === 3) {
      await sendMail({
        to: customer.email,
        subject: "CyberStep — Kart bilgilerinizi güncelleyin",
        html: buildDunningEmail(customer.fullName, "day3"),
      }).catch(err => logger.warn({ err, customerId: customer.id }, "Dunning day3 failed"));
      actioned++;
    }

    if (days === 7) {
      await sendMail({
        to: customer.email,
        subject: "CyberStep — Son uyarı, servis 3 gün içinde duracak",
        html: buildDunningEmail(customer.fullName, "day7"),
      }).catch(err => logger.warn({ err, customerId: customer.id }, "Dunning day7 failed"));
      actioned++;
    }

    if (days >= 10 && days < 11) {
      await db.update(customerServiceSubscriptionsTable).set({
        status: "cancelled",
        suspendedAt: new Date(),
      }).where(eq(customerServiceSubscriptionsTable.id, sub.id));

      await sendMail({
        to: customer.email,
        subject: "CyberStep — Servisiniz durduruldu",
        html: buildDunningEmail(customer.fullName, "day10"),
      }).catch(err => logger.warn({ err, customerId: customer.id }, "Dunning day10 failed"));
      actioned++;
    }

    if (days >= 30) {
      await db.update(customersTable).set({
        subscriptionStatus: "inactive",
        archivedAt: new Date(),
      }).where(eq(customersTable.id, customer.id));
      actioned++;
    }
  }

  return actioned;
}
