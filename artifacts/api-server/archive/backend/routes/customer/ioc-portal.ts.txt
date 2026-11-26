import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { customerIpWhitelistTable, iocActionLogTable } from "@workspace/db";
import { eq, and, isNull, gte, or, desc } from "drizzle-orm";
import { requireCustomer, getCustomerId } from "../../middleware/auth";
import { isValidCIDR } from "../../ioc/ipUtils";

const router = Router();

// ─── Portal: Whitelist ────────────────────────────────────────────────────────

router.get("/customer/whitelist", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req) as number;
  try {
    const rows = await db
      .select()
      .from(customerIpWhitelistTable)
      .where(
        and(
          eq(customerIpWhitelistTable.customerId, customerId),
          eq(customerIpWhitelistTable.isActive, true),
        ),
      )
      .orderBy(desc(customerIpWhitelistTable.createdAt));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "portal/whitelist GET failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.post("/customer/whitelist", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req) as number;
  const { ipCidr, label, reason } = req.body as {
    ipCidr: string;
    label?: string;
    reason?: string;
  };

  if (!ipCidr || !isValidCIDR(ipCidr)) {
    res.status(400).json({ error: "Geçerli bir IP veya CIDR adresi girin (örn: 185.1.2.3 veya 185.1.2.0/24)" });
    return;
  }

  const VALID_REASONS = ["payment_provider", "office_ip", "backup_server", "cdn", "monitoring", "other"];
  const safeReason = VALID_REASONS.includes(reason ?? "") ? reason : "other";

  try {
    const [row] = await db
      .insert(customerIpWhitelistTable)
      .values({
        customerId,
        ipCidr,
        label: label ?? null,
        reason: safeReason,
        addedBy: `customer:${customerId}`,
      })
      .onConflictDoNothing()
      .returning();

    if (!row) {
      res.status(409).json({ error: "Bu IP zaten whitelist'te" });
      return;
    }
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "portal/whitelist POST failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.delete("/customer/whitelist/:id", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req) as number;
  const entryId = parseInt(String(req.params["id"]), 10);

  try {
    await db
      .update(customerIpWhitelistTable)
      .set({ isActive: false })
      .where(
        and(
          eq(customerIpWhitelistTable.id, entryId),
          eq(customerIpWhitelistTable.customerId, customerId),
        ),
      );
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "portal/whitelist DELETE failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── Portal: IOC Log ──────────────────────────────────────────────────────────

router.get("/customer/ioc-log", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req) as number;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  try {
    const rows = await db
      .select()
      .from(iocActionLogTable)
      .where(
        and(
          eq(iocActionLogTable.customerId, customerId),
          gte(iocActionLogTable.createdAt, thirtyDaysAgo),
        ),
      )
      .orderBy(desc(iocActionLogTable.createdAt))
      .limit(200);

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "portal/ioc-log GET failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.get("/customer/ioc-log/export", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req) as number;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  try {
    const rows = await db
      .select()
      .from(iocActionLogTable)
      .where(
        and(
          eq(iocActionLogTable.customerId, customerId),
          gte(iocActionLogTable.createdAt, thirtyDaysAgo),
        ),
      )
      .orderBy(desc(iocActionLogTable.createdAt))
      .limit(2000);

    const header = "tarih,tehdit,tip,aksiyon,guven_skoru,kaynaklar,atlama_nedeni\n";
    const lines = rows.map(r =>
      [
        r.createdAt?.toISOString() ?? "",
        `"${r.iocValue}"`,
        r.iocType ?? "",
        r.action,
        r.confidenceScore ?? "",
        `"${(r.sources ?? []).join(";")}"`,
        r.skipReason ?? "",
      ].join(","),
    );

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=tehdit-log.csv");
    res.send(header + lines.join("\n"));
  } catch (err) {
    req.log.error({ err }, "portal/ioc-log/export failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;
