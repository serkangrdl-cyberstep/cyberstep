/**
 * Upsell Otomasyonu
 *
 * Her gece 23:00 çalışır, tetikleyicileri kontrol eder ve
 * uygun müşterilere kişiselleştirilmiş yükseltme emaili gönderir.
 *
 * Kural → Gerçek alan adı eşleştirmesi:
 *   subscription.plan   → serviceSlug
 *   subscription.startedAt → startedAt
 */

import { db } from "@workspace/db";
import {
  customersTable,
  customerServiceSubscriptionsTable,
  upsellLogTable,
} from "@workspace/db";
import { eq, and, gte, count, sql } from "drizzle-orm";
import { sendMail } from "./email";
import { logger } from "../lib/logger";

const BASE_URL = process.env["REPLIT_DOMAINS"]
  ? `https://${process.env["REPLIT_DOMAINS"].split(",")[0]?.trim()}`
  : "http://localhost:80";

// ─── Yardımcı: son N günde bu kural için mesaj gönderildi mi ─────────────────

async function hasRecentUpsell(
  customerId: number,
  ruleId: string,
  days: number,
): Promise<boolean> {
  const since = new Date(Date.now() - days * 86_400_000);
  const [row] = await db.select({ cnt: count() }).from(upsellLogTable)
    .where(
      and(
        eq(upsellLogTable.customerId, customerId),
        eq(upsellLogTable.ruleId, ruleId),
        gte(upsellLogTable.sentAt, since),
      )
    );
  return (row?.cnt ?? 0) > 0;
}

// ─── Alarm sayısı (SOC olaylarından) ─────────────────────────────────────────

async function getAlarmCount(customerId: number, days: number): Promise<number> {
  const since = new Date(Date.now() - days * 86_400_000);
  try {
    const result = await db.execute<{ cnt: string }>(sql`
      SELECT COUNT(*) AS cnt
      FROM soc_cases
      WHERE customer_id = ${customerId}
        AND created_at >= ${since}
    `);
    return Number(result.rows[0]?.cnt ?? 0);
  } catch {
    return 0;
  }
}

// ─── Abonelik helper ──────────────────────────────────────────────────────────

async function getActiveSubscription(customerId: number) {
  const [sub] = await db.select().from(customerServiceSubscriptionsTable)
    .where(
      and(
        eq(customerServiceSubscriptionsTable.customerId, customerId),
        eq(customerServiceSubscriptionsTable.status, "active"),
      )
    ).limit(1);
  return sub;
}

// ─── Email builder ────────────────────────────────────────────────────────────

function buildUpsellEmail(params: {
  subject: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
  customerName: string;
}): string {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#111;max-width:600px;margin:0 auto;padding:20px">
<p>Sayın ${params.customerName},</p>
<p>${params.body.replace(/\n/g, "<br>")}</p>
<p><a href="${BASE_URL}${params.ctaUrl}" style="background:#10b981;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;margin-top:8px">${params.ctaText}</a></p>
<hr style="margin:30px 0"><p style="font-size:12px;color:#888">CyberStep.io — Siber Güvenlik</p>
</body></html>`;
}

// ─── Kurallar ─────────────────────────────────────────────────────────────────

interface UpsellRule {
  id: string;
  trigger: (customerId: number) => Promise<boolean>;
  message: (c: { companyName: string | null; fullName: string; alarmCount?: number }) => {
    subject: string;
    body: string;
    ctaText: string;
    ctaUrl: string;
  };
}

const UPSELL_RULES: UpsellRule[] = [
  {
    id: "soc_lite_to_standard",
    trigger: async (customerId) => {
      const sub = await getActiveSubscription(customerId);
      if (!sub?.serviceSlug?.includes("soc_lite")) return false;
      const alarmCount = await getAlarmCount(customerId, 30);
      return alarmCount >= 20;
    },
    message: (c) => ({
      subject: `${c.companyName ?? c.fullName} — SOC kapasitenizi artırın`,
      body: `Bu ay 20+ güvenlik alarmı izledik.\nSOC Lite planı 20 alarm kapasiteli.\nSOC Standart ile 3x daha fazla izleme ve öncelikli müdahale. Fark: günde sadece 150 TL.`,
      ctaText: "SOC Standart'a Geç",
      ctaUrl: "/portal/upgrade",
    }),
  },
  {
    id: "assessment_to_monitoring",
    trigger: async (customerId) => {
      const sub = await getActiveSubscription(customerId);
      if (!sub?.serviceSlug?.includes("assessment")) return false;
      try {
        const result = await db.execute<{ cnt: string }>(sql`
          SELECT COUNT(*) AS cnt FROM reports r
          JOIN assessments a ON a.id = r.assessment_id
          WHERE a.customer_email = (SELECT email FROM customers WHERE id = ${customerId})
            AND r.created_at >= NOW() - INTERVAL '30 days'
        `);
        return Number(result.rows[0]?.cnt ?? 0) >= 3;
      } catch {
        return false;
      }
    },
    message: (c) => ({
      subject: `${c.companyName ?? c.fullName} — Raporunuzu 3 kez indirdiniz, sürekli izleme zamanı`,
      body: `Güvenlik durumunuzu düzenli takip ettiğinizi görüyoruz.\nAylık manuel kontrol yerine sürekli izleme ile değişiklikler anında gelsin.`,
      ctaText: "CVE İzlemeyi Başlat",
      ctaUrl: "/portal/upgrade",
    }),
  },
  {
    id: "soc_to_soc_noc",
    trigger: async (customerId) => {
      const subs = await db.select().from(customerServiceSubscriptionsTable)
        .where(
          and(
            eq(customerServiceSubscriptionsTable.customerId, customerId),
            eq(customerServiceSubscriptionsTable.status, "active"),
          )
        );
      const hasSOC = subs.some(s => s.serviceSlug.includes("soc"));
      const hasNOC = subs.some(s => s.serviceSlug.includes("noc"));
      if (!hasSOC || hasNOC) return false;
      const socSub = subs.find(s => s.serviceSlug.includes("soc"));
      if (!socSub) return false;
      const daysActive = Math.floor((Date.now() - new Date(socSub.startedAt).getTime()) / 86_400_000);
      return daysActive >= 60;
    },
    message: (c) => ({
      subject: `${c.companyName ?? c.fullName} — SOC + NOC kombinasyonuyla tam koruma`,
      body: `60 gündür SOC servisimizi kullanıyorsunuz.\nSOC saldırıları izliyor, NOC ağ performansını.\nİkisi birlikte %30 indirimle.`,
      ctaText: "NOC Ekle — %30 İndirim",
      ctaUrl: "/portal/upgrade",
    }),
  },
];

// ─── Ana motor ────────────────────────────────────────────────────────────────

export async function runUpsellEngine(): Promise<number> {
  const customers = await db.select().from(customersTable)
    .where(eq(customersTable.subscriptionStatus, "active"));

  let sent = 0;

  for (const customer of customers) {
    for (const rule of UPSELL_RULES) {
      const recentlySent = await hasRecentUpsell(customer.id, rule.id, 30).catch(() => true);
      if (recentlySent) continue;

      const shouldTrigger = await rule.trigger(customer.id).catch(() => false);
      if (!shouldTrigger) continue;

      const msg = rule.message(customer);

      try {
        await sendMail({
          to: customer.email,
          subject: msg.subject,
          html: buildUpsellEmail({ ...msg, customerName: customer.fullName }),
        });

        await db.insert(upsellLogTable).values({
          customerId: customer.id,
          ruleId: rule.id,
        });

        logger.info({ customerId: customer.id, ruleId: rule.id }, "Upsell email sent");
        sent++;
      } catch (err) {
        logger.warn({ err, customerId: customer.id, ruleId: rule.id }, "Upsell email failed");
      }
    }
  }

  return sent;
}
