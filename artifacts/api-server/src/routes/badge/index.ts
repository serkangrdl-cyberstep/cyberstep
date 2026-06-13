import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { customersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireCustomer, getCustomerId } from "../../middleware/auth";
import { logger } from "../../lib/logger";

const router = Router();

const BADGE_SVG_DARK = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="44" viewBox="0 0 160 44"><rect width="160" height="44" rx="7" fill="#060D1A" stroke="#00C8FF" stroke-width="1.5"/><path d="M15 13 L22 10 L29 13 L29 24 C29 29 22 33 22 33 C22 33 15 29 15 24 Z" fill="#00C8FF22" stroke="#00C8FF" stroke-width="1.5" stroke-linejoin="round"/><path d="M19 22 L21.5 24.5 L26 19" stroke="#00C8FF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/><text x="36" y="19" font-family="Arial, Helvetica, sans-serif" font-size="11.5" font-weight="700" fill="#E8EDF5" letter-spacing="0.3">CyberStep</text><text x="36" y="33" font-family="Arial, Helvetica, sans-serif" font-size="10" fill="#00C8FF">ile Korunuyor</text></svg>`;

const BADGE_SVG_GENERIC = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="44" viewBox="0 0 160 44"><rect width="160" height="44" rx="7" fill="#060D1A" stroke="#5A6A80" stroke-width="1.5"/><path d="M15 13 L22 10 L29 13 L29 24 C29 29 22 33 22 33 C22 33 15 29 15 24 Z" fill="#5A6A8022" stroke="#5A6A80" stroke-width="1.5" stroke-linejoin="round"/><text x="36" y="19" font-family="Arial, Helvetica, sans-serif" font-size="11.5" font-weight="700" fill="#E8EDF5" letter-spacing="0.3">CyberStep</text><text x="36" y="33" font-family="Arial, Helvetica, sans-serif" font-size="10" fill="#7B8FAF">Güvenlik Platformu</text></svg>`;

router.get("/badge/:token", async (req: Request, res: Response) => {
  const token = String(req.params["token"] ?? "");
  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=60");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (!token || token.length < 10) { res.send(BADGE_SVG_GENERIC); return; }

  const [customer] = await db
    .select({ id: customersTable.id, badgeEnabled: customersTable.badgeEnabled, subscriptionStatus: customersTable.subscriptionStatus })
    .from(customersTable)
    .where(eq(customersTable.badgeToken, token));

  if (!customer || !customer.badgeEnabled || customer.subscriptionStatus !== "active") {
    res.send(BADGE_SVG_GENERIC);
    return;
  }

  setImmediate(() => {
    db.execute(sql`UPDATE customers SET badge_impression_count = COALESCE(badge_impression_count, 0) + 1 WHERE id = ${customer.id}`)
      .catch((e: unknown) => logger.warn({ err: String(e) }, "Badge impression count update failed"));
  });

  res.send(BADGE_SVG_DARK);
});

router.get("/customer/badge", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Yetkisiz" }); return; }

  const [customer] = await db
    .select({
      subscriptionPlan: customersTable.subscriptionPlan,
      subscriptionStatus: customersTable.subscriptionStatus,
      badgeToken: customersTable.badgeToken,
      badgeEnabled: customersTable.badgeEnabled,
      badgeImpressionCount: customersTable.badgeImpressionCount,
    })
    .from(customersTable)
    .where(eq(customersTable.id, customerId));

  if (!customer) { res.status(404).json({ error: "Müşteri bulunamadı" }); return; }

  const isPaid = (customer.subscriptionPlan === "full" || customer.subscriptionPlan === "premium") && customer.subscriptionStatus === "active";
  if (!isPaid) { res.status(403).json({ error: "Bu özellik ücretli plan gerektiriyor" }); return; }

  if (!customer.badgeToken) {
    const newToken = randomUUID().replace(/-/g, "");
    await db.execute(sql`UPDATE customers SET badge_token = ${newToken} WHERE id = ${customerId}`);
    res.json({ badgeToken: newToken, badgeEnabled: true, badgeImpressionCount: 0 });
    return;
  }

  res.json({
    badgeToken: customer.badgeToken,
    badgeEnabled: customer.badgeEnabled ?? true,
    badgeImpressionCount: customer.badgeImpressionCount ?? 0,
  });
});

router.post("/customer/badge/toggle", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Yetkisiz" }); return; }

  const [current] = await db.select({ badgeEnabled: customersTable.badgeEnabled }).from(customersTable).where(eq(customersTable.id, customerId));
  const newEnabled = !(current?.badgeEnabled ?? true);
  await db.execute(sql`UPDATE customers SET badge_enabled = ${newEnabled} WHERE id = ${customerId}`);
  res.json({ badgeEnabled: newEnabled });
});

export default router;
