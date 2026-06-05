/**
 * IOC Sorgu Kredi Yöneticisi
 */

import { db } from "@workspace/db";
import {
  iocQueryCreditsTable,
  iocCreditTransactionsTable,
  customerServiceSubscriptionsTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const PLAN_MONTHLY_CREDITS: Record<string, number> = {
  soc_lite:       10,
  soc_standard:   30,
  soc_pro:        100,
  soc_noc:        50,
  ciso_assistant: 20,
};

export async function resetMonthlyCredits(): Promise<void> {
  const subs = await db.select().from(customerServiceSubscriptionsTable)
    .where(eq(customerServiceSubscriptionsTable.status, "active"));

  let count = 0;
  for (const sub of subs) {
    const monthlyCredits = PLAN_MONTHLY_CREDITS[sub.serviceSlug || ""] || 0;
    if (monthlyCredits === 0) continue;

    await db.insert(iocQueryCreditsTable).values({
      customerId:       sub.customerId,
      creditsTotal:     monthlyCredits,
      creditsUsed:      0,
      creditsPurchased: 0,
      resetDate:        new Date().toISOString().slice(0, 10),
    }).onConflictDoUpdate({
      target: iocQueryCreditsTable.customerId,
      set: {
        creditsTotal:  monthlyCredits,
        creditsUsed:   0,
        resetDate:     new Date().toISOString().slice(0, 10),
        updatedAt:     new Date(),
      },
    });

    await db.insert(iocCreditTransactionsTable).values({
      customerId:  sub.customerId,
      amount:      monthlyCredits,
      type:        "monthly_reset",
      description: `${monthlyCredits} aylık sorgu kredisi`,
    });
    count++;
  }
  logger.info({ count }, "IOC aylık krediler sıfırlandı");
}

export async function useCredit(
  customerId: number,
  queryId: number,
): Promise<{ success: boolean; remaining: number }> {
  const [balance] = await db.select().from(iocQueryCreditsTable)
    .where(eq(iocQueryCreditsTable.customerId, customerId)).limit(1);

  const total     = (balance?.creditsTotal || 0) + (balance?.creditsPurchased || 0);
  const used      = balance?.creditsUsed || 0;
  const remaining = total - used;

  if (remaining <= 0) return { success: false, remaining: 0 };

  await db.update(iocQueryCreditsTable).set({
    creditsUsed: used + 1,
    updatedAt:   new Date(),
  }).where(eq(iocQueryCreditsTable.customerId, customerId));

  if (queryId > 0) {
    await db.insert(iocCreditTransactionsTable).values({
      customerId,
      amount:      -1,
      type:        "query_used",
      queryId,
      description: "IOC sorgusu",
    });
  }

  return { success: true, remaining: remaining - 1 };
}

export async function getCreditsBalance(customerId: number) {
  const [credits] = await db.select().from(iocQueryCreditsTable)
    .where(eq(iocQueryCreditsTable.customerId, customerId)).limit(1);
  const total     = (credits?.creditsTotal || 0) + (credits?.creditsPurchased || 0);
  const used      = credits?.creditsUsed || 0;
  return {
    monthly_included: credits?.creditsTotal || 0,
    purchased:        credits?.creditsPurchased || 0,
    used,
    remaining:        Math.max(0, total - used),
    reset_date:       credits?.resetDate,
  };
}

export async function addPurchasedCredits(customerId: number, credits: number): Promise<void> {
  await db.update(iocQueryCreditsTable).set({
    creditsPurchased: sql`credits_purchased + ${credits}`,
    updatedAt: new Date(),
  }).where(eq(iocQueryCreditsTable.customerId, customerId));

  await db.insert(iocCreditTransactionsTable).values({
    customerId,
    amount:      credits,
    type:        "purchase",
    description: `${credits} kredi satın alındı`,
  });
}
