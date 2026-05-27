import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { specialDayMessagesTable, newsletterSubscribersTable } from "@workspace/db";
import { eq, and, lte, gte, sql } from "drizzle-orm";
import { requireAdmin } from "./middleware";
import { logger } from "../../lib/logger";
import { sendSpecialDayEmail } from "../../services/email";

const router = Router();

// ─── ADMIN: Special Day Messages ──────────────────────────────────────────────

router.get("/admin-panel/special-messages", requireAdmin, async (_req: Request, res: Response) => {
  const rows = await db
    .select()
    .from(specialDayMessagesTable)
    .orderBy(sql`${specialDayMessagesTable.startAt} DESC`);
  res.json(rows);
});

router.get("/admin-panel/special-messages/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(specialDayMessagesTable).where(eq(specialDayMessagesTable.id, id));
  if (!row) { res.status(404).json({ error: "Bulunamadı" }); return; }
  res.json(row);
});

router.post("/admin-panel/special-messages", requireAdmin, async (req: Request, res: Response) => {
  const { title, messageTr, messageEn, imageBase64, bgColor, textColor, startAt, endAt, isActive, sendNewsletter, tags } = req.body as {
    title: string; messageTr: string; messageEn?: string;
    imageBase64?: string; bgColor?: string; textColor?: string;
    startAt: string; endAt: string; isActive?: boolean; sendNewsletter?: boolean; tags?: string[];
  };
  if (!title || !messageTr || !startAt || !endAt) {
    res.status(400).json({ error: "Başlık, mesaj, başlangıç ve bitiş tarihi zorunludur" }); return;
  }
  const [row] = await db.insert(specialDayMessagesTable).values({
    title,
    messageTr,
    messageEn: messageEn || null,
    imageBase64: imageBase64 || null,
    bgColor: bgColor || "#0f172a",
    textColor: textColor || "#ffffff",
    startAt: new Date(startAt),
    endAt: new Date(endAt),
    isActive: isActive ?? true,
    sendNewsletter: sendNewsletter ?? false,
    tags: tags ?? [],
  }).returning();
  logger.info({ id: row.id }, "Special day message created");
  res.status(201).json(row);
});

router.put("/admin-panel/special-messages/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { title, messageTr, messageEn, imageBase64, bgColor, textColor, startAt, endAt, isActive, sendNewsletter, tags } = req.body as {
    title?: string; messageTr?: string; messageEn?: string;
    imageBase64?: string; bgColor?: string; textColor?: string;
    startAt?: string; endAt?: string; isActive?: boolean; sendNewsletter?: boolean; tags?: string[];
  };
  const [existing] = await db.select().from(specialDayMessagesTable).where(eq(specialDayMessagesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Bulunamadı" }); return; }

  const [row] = await db.update(specialDayMessagesTable)
    .set({
      ...(title !== undefined && { title }),
      ...(messageTr !== undefined && { messageTr }),
      ...(messageEn !== undefined && { messageEn: messageEn || null }),
      ...(imageBase64 !== undefined && { imageBase64: imageBase64 || null }),
      ...(bgColor !== undefined && { bgColor }),
      ...(textColor !== undefined && { textColor }),
      ...(startAt !== undefined && { startAt: new Date(startAt) }),
      ...(endAt !== undefined && { endAt: new Date(endAt) }),
      ...(isActive !== undefined && { isActive }),
      ...(sendNewsletter !== undefined && { sendNewsletter }),
      ...(tags !== undefined && { tags }),
      updatedAt: new Date(),
    })
    .where(eq(specialDayMessagesTable.id, id))
    .returning();
  logger.info({ id }, "Special day message updated");
  res.json(row);
});

router.delete("/admin-panel/special-messages/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await db.delete(specialDayMessagesTable).where(eq(specialDayMessagesTable.id, id));
  logger.info({ id }, "Special day message deleted");
  res.json({ success: true });
});

// POST /admin-panel/special-messages/:id/send-newsletter
router.post("/admin-panel/special-messages/:id/send-newsletter", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const [msg] = await db.select().from(specialDayMessagesTable).where(eq(specialDayMessagesTable.id, id));
  if (!msg) { res.status(404).json({ error: "Bulunamadı" }); return; }
  if (msg.newsletterSent) { res.status(409).json({ error: "Bu mesaj için bülten zaten gönderildi" }); return; }

  const subscribers = await db.select({ email: newsletterSubscribersTable.email, unsubscribeToken: newsletterSubscribersTable.unsubscribeToken })
    .from(newsletterSubscribersTable)
    .where(eq(newsletterSubscribersTable.isActive, true));

  if (subscribers.length === 0) {
    res.json({ success: true, sent: 0, message: "Aktif abone bulunamadı" }); return;
  }

  // Fire and forget
  void (async () => {
    try {
      await sendSpecialDayEmail({ message: msg, subscribers });
      await db.update(specialDayMessagesTable)
        .set({ newsletterSent: true, updatedAt: new Date() })
        .where(eq(specialDayMessagesTable.id, id));
      logger.info({ id, count: subscribers.length }, "Special day newsletter sent");
    } catch (err) {
      logger.error({ err, id }, "Special day newsletter send failed");
    }
  })();

  res.json({ success: true, sent: subscribers.length });
});

// ─── PUBLIC: Active Special Day Message ───────────────────────────────────────

router.get("/public/special-messages/active", async (_req: Request, res: Response) => {
  const now = new Date();
  const [msg] = await db.select({
    id: specialDayMessagesTable.id,
    title: specialDayMessagesTable.title,
    messageTr: specialDayMessagesTable.messageTr,
    messageEn: specialDayMessagesTable.messageEn,
    imageBase64: specialDayMessagesTable.imageBase64,
    bgColor: specialDayMessagesTable.bgColor,
    textColor: specialDayMessagesTable.textColor,
    startAt: specialDayMessagesTable.startAt,
    endAt: specialDayMessagesTable.endAt,
  })
    .from(specialDayMessagesTable)
    .where(
      and(
        eq(specialDayMessagesTable.isActive, true),
        lte(specialDayMessagesTable.startAt, now),
        gte(specialDayMessagesTable.endAt, now),
      )
    )
    .orderBy(sql`${specialDayMessagesTable.startAt} DESC`)
    .limit(1);

  if (!msg) { res.json(null); return; }
  res.json(msg);
});

export default router;
