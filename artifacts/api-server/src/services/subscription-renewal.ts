import cron from "node-cron";
import { db } from "@workspace/db";
import { customerServicesTable, serviceCatalogTable, customersTable } from "@workspace/db";
import { eq, and, lte, gte } from "drizzle-orm";
import { sendMail } from "./email";
import { logger } from "../lib/logger";

const MAX_RENEWAL_ATTEMPTS = 3;

async function sendRenewalFailureEmail(params: {
  email: string;
  companyName: string;
  serviceName: string;
  attempt: number;
}) {
  const messages: Record<number, string> = {
    1: "Abonelik yenileme ödemesi başarısız oldu. Lütfen ödeme bilgilerinizi güncelleyin.",
    2: "Son ödeme hatırlatması. Hesabınız 3 gün içinde askıya alınacak.",
    3: "Aboneliğiniz askıya alındı. Yeniden etkinleştirmek için ödeme yapın.",
  };

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;background:#f4f7fb;padding:32px">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:32px">
  <h2 style="color:#ef4444;margin-top:0">Ödeme Uyarısı</h2>
  <p>Sayın <strong>${params.companyName}</strong>,</p>
  <p><strong>${params.serviceName}</strong> servisiniz için yenileme ödemesi alınamadı.</p>
  <p style="background:#fef2f2;padding:12px;border-radius:6px;color:#b91c1c">${messages[params.attempt] ?? messages[1]}</p>
  <a href="https://cyberstep.io/hesabim/servislerim" style="display:inline-block;background:#0ea5e9;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;margin-top:16px">Ödemeyi Güncelle</a>
  <p style="color:#94a3b8;font-size:12px;margin-top:24px">CyberStep.io</p>
</div></body></html>`;

  await sendMail({ to: params.email, subject: `Ödeme Uyarısı: ${params.serviceName}`, html });
}

async function processRenewalFailure(cs: typeof customerServicesTable.$inferSelect, serviceName: string, email: string, companyName: string) {
  const attempt = (cs.renewalAttemptCount ?? 0) + 1;

  const updateData: Partial<typeof customerServicesTable.$inferInsert> = {
    renewalAttemptCount: attempt,
    lastRenewalFailedAt: new Date(),
  };

  if (attempt >= MAX_RENEWAL_ATTEMPTS) {
    updateData.status = "suspended";
    logger.warn({ customerId: cs.customerId, serviceName }, "Service suspended after max renewal attempts");
  }

  await db.update(customerServicesTable)
    .set(updateData)
    .where(eq(customerServicesTable.id, cs.id));

  setImmediate(() => {
    sendRenewalFailureEmail({ email, companyName, serviceName, attempt }).catch(() => {});
  });
}

export async function processSubscriptionRenewals() {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const renewals = await db
    .select({
      cs: customerServicesTable,
      service: serviceCatalogTable,
      customer: customersTable,
    })
    .from(customerServicesTable)
    .innerJoin(serviceCatalogTable, eq(customerServicesTable.serviceCatalogId, serviceCatalogTable.id))
    .innerJoin(customersTable, eq(customerServicesTable.customerId, customersTable.id))
    .where(
      and(
        eq(customerServicesTable.status, "active"),
        eq(customerServicesTable.autoRenew, true),
        lte(customerServicesTable.nextRenewalAt, tomorrow),
        gte(customerServicesTable.renewalAttemptCount, 0),
      )
    );

  logger.info({ count: renewals.length }, "Processing subscription renewals");

  for (const { cs, service, customer } of renewals) {
    try {
      // Iyzico stored card renewal would go here.
      // For now: log and mark for manual processing.
      logger.info({ csId: cs.id, serviceSlug: service.slug, customerId: cs.customerId }, "Renewal due — no stored card token yet");

      const now = new Date();
      const serviceType = service.serviceType ?? "monthly";
      const newExpiry = serviceType === "annual"
        ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
        : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

      await processRenewalFailure(cs, service.label, customer.email, customer.companyName ?? "Müşteri");

      void newExpiry;
    } catch (err) {
      logger.error({ err, csId: cs.id }, "Renewal processing error");
    }
  }
}

export function startRenewalCron() {
  cron.schedule("0 9 * * *", async () => {
    try {
      await processSubscriptionRenewals();
    } catch (err) {
      logger.error({ err }, "Subscription renewal cron error");
    }
  }, { timezone: "Europe/Istanbul" });

  logger.info("Subscription renewal cron registered (09:00 Istanbul)");
}
