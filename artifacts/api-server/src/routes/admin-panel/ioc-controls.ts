import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import {
  iocEntriesTable,
  iocActionLogTable,
  systemSettingsTable,
  customerIpWhitelistTable,
} from "@workspace/db";
import { eq, and, desc, gte, count, sql } from "drizzle-orm";
import { requireAdmin } from "../../middleware/auth";
import { activateKillSwitch, deactivateKillSwitch } from "../../ioc/actionLogger";
import { isValidCIDR } from "../../ioc/ipUtils";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function since24h(): Date {
  return new Date(Date.now() - 24 * 60 * 60 * 1000);
}

// ─── IOC Stats ────────────────────────────────────────────────────────────────

router.get("/admin-panel/ioc/stats", requireAdmin, async (req: Request, res: Response) => {
  try {
    const from = since24h();

    const [totalRow] = await db
      .select({ cnt: count() })
      .from(iocActionLogTable)
      .where(gte(iocActionLogTable.createdAt, from));

    const actionCounts = await db
      .select({ action: iocActionLogTable.action, cnt: count() })
      .from(iocActionLogTable)
      .where(gte(iocActionLogTable.createdAt, from))
      .groupBy(iocActionLogTable.action);

    const byAction: Record<string, number> = {};
    for (const row of actionCounts) {
      if (row.action) byAction[row.action] = Number(row.cnt);
    }

    const [totalIoc] = await db.select({ cnt: count() }).from(iocEntriesTable);

    const settings = Object.fromEntries(
      (await db.select().from(systemSettingsTable)).map(r => [r.key, r.value]),
    );

    res.json({
      period: "24h",
      total: Number(totalRow?.cnt ?? 0),
      byAction,
      totalIocEntries: Number(totalIoc?.cnt ?? 0),
      settings,
    });
  } catch (err) {
    req.log.error({ err }, "ioc/stats failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── IOC Action Log ───────────────────────────────────────────────────────────

router.get("/admin-panel/ioc/log", requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(String(req.query["limit"] ?? "50"), 10), 200);
    const action = req.query["action"] as string | undefined;
    const customerId = req.query["customerId"] ? parseInt(String(req.query["customerId"]), 10) : undefined;

    const conditions = [];
    if (action) conditions.push(eq(iocActionLogTable.action, action));
    if (customerId) conditions.push(eq(iocActionLogTable.customerId, customerId));

    const rows = await db
      .select()
      .from(iocActionLogTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(iocActionLogTable.createdAt))
      .limit(limit);

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "ioc/log failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── IOC Log CSV Export ───────────────────────────────────────────────────────

router.get("/admin-panel/ioc/log/export", requireAdmin, async (req: Request, res: Response) => {
  try {
    const rows = await db
      .select()
      .from(iocActionLogTable)
      .orderBy(desc(iocActionLogTable.createdAt))
      .limit(5000);

    const header = "id,customer_id,ioc_value,ioc_type,action,confidence_score,sources,skip_reason,performed_by,created_at\n";
    const lines = rows.map(r =>
      [
        r.id,
        r.customerId ?? "",
        `"${r.iocValue}"`,
        r.iocType ?? "",
        r.action,
        r.confidenceScore ?? "",
        `"${(r.sources ?? []).join(";")}"`,
        r.skipReason ?? "",
        r.performedBy ?? "",
        r.createdAt?.toISOString() ?? "",
      ].join(","),
    );

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=ioc-action-log.csv");
    res.send(header + lines.join("\n"));
  } catch (err) {
    req.log.error({ err }, "ioc/log/export failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── IOC Entries List ─────────────────────────────────────────────────────────

router.get("/admin-panel/ioc/entries", requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(String(req.query["limit"] ?? "50"), 10), 200);
    const rows = await db
      .select()
      .from(iocEntriesTable)
      .where(eq(iocEntriesTable.isActive, true))
      .orderBy(desc(iocEntriesTable.lastSeenAt))
      .limit(limit);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "ioc/entries failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── System Settings ──────────────────────────────────────────────────────────

router.get("/admin-panel/ioc/settings", requireAdmin, async (req: Request, res: Response) => {
  try {
    const rows = await db.select().from(systemSettingsTable);
    res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
  } catch (err) {
    req.log.error({ err }, "ioc/settings GET failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.put("/admin-panel/ioc/settings/:key", requireAdmin, async (req: Request, res: Response) => {
  const key = String(req.params["key"]);
  const { value } = req.body as { value: string };

  const ALLOWED_KEYS = [
    "auto_block_enabled",
    "min_confidence_for_block",
    "min_sources_for_block",
    "ioc_report_confidence_threshold",
  ];

  if (!ALLOWED_KEYS.includes(key)) {
    res.status(400).json({ error: "Geçersiz ayar anahtarı" });
    return;
  }
  if (value === undefined || value === null) {
    res.status(400).json({ error: "Değer gerekli" });
    return;
  }

  try {
    await db
      .update(systemSettingsTable)
      .set({ value: String(value), updatedBy: "admin", updatedAt: new Date() })
      .where(eq(systemSettingsTable.key, key));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "ioc/settings PUT failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── Kill Switch ──────────────────────────────────────────────────────────────

router.post("/admin-panel/kill-switch/activate", requireAdmin, async (req: Request, res: Response) => {
  const { reason } = req.body as { reason?: string };
  try {
    await activateKillSwitch(reason ?? "admin isteği", "admin");
    res.json({ ok: true, status: "active" });
  } catch (err) {
    req.log.error({ err }, "kill-switch/activate failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.post("/admin-panel/kill-switch/deactivate", requireAdmin, async (req: Request, res: Response) => {
  try {
    await deactivateKillSwitch("admin");
    res.json({ ok: true, status: "inactive" });
  } catch (err) {
    req.log.error({ err }, "kill-switch/deactivate failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── Customer Whitelist (Admin) ───────────────────────────────────────────────

router.get("/admin-panel/customers/:id/whitelist", requireAdmin, async (req: Request, res: Response) => {
  const customerId = parseInt(String(req.params["id"]), 10);
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
    req.log.error({ err }, "admin whitelist GET failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.post("/admin-panel/customers/:id/whitelist", requireAdmin, async (req: Request, res: Response) => {
  const customerId = parseInt(String(req.params["id"]), 10);
  const { ipCidr, label, reason } = req.body as {
    ipCidr: string;
    label?: string;
    reason?: string;
  };

  if (!ipCidr || !isValidCIDR(ipCidr)) {
    res.status(400).json({ error: "Geçerli bir IP veya CIDR adresi girin" });
    return;
  }

  try {
    const [row] = await db
      .insert(customerIpWhitelistTable)
      .values({
        customerId,
        ipCidr,
        label: label ?? null,
        reason: reason ?? "other",
        addedBy: "admin",
      })
      .onConflictDoNothing()
      .returning();
    if (!row) {
      res.status(409).json({ error: "Bu IP zaten whitelist'te" });
      return;
    }
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "admin whitelist POST failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.delete("/admin-panel/customers/:id/whitelist/:entryId", requireAdmin, async (req: Request, res: Response) => {
  const customerId = parseInt(String(req.params["id"]), 10);
  const entryId = parseInt(String(req.params["entryId"]), 10);
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
    req.log.error({ err }, "admin whitelist DELETE failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;
