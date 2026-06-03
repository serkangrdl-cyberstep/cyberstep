// ─── Sosyal Medya API Rotaları ─────────────────────────────────────────────────

import { Router } from "express";
import { db } from "@workspace/db";
import {
  socialMediaPostsTable,
  contentCalendarTable,
  specialDaysTable,
  socialMediaAccountsTable,
} from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAdmin } from "../../middleware/auth";
import { logger } from "../../lib/logger";

const router = Router();

// ─── Takvim ───────────────────────────────────────────────────────────────────

router.get("/api/admin/social/calendar", requireAdmin, async (req, res) => {
  const calendars = await db.select()
    .from(contentCalendarTable)
    .orderBy(desc(contentCalendarTable.weekStart))
    .limit(10);
  res.json(calendars);
});

router.post("/api/admin/social/generate-week", requireAdmin, async (req, res) => {
  const { weekStart } = req.body as { weekStart?: string };
  if (!weekStart) { res.status(400).json({ error: "weekStart zorunlu" }); return; }

  const d = new Date(weekStart);
  if (isNaN(d.getTime())) { res.status(400).json({ error: "Geçersiz tarih" }); return; }

  const [calendar] = await db.insert(contentCalendarTable).values({
    weekStart: d.toISOString().split("T")[0],
  }).returning();

  res.json({ calendarId: calendar.id, message: "İçerik üretimi başladı" });

  setImmediate(async () => {
    try {
      const { generateWeeklyContent } = await import("./contentGenerator");
      await generateWeeklyContent(d, calendar.id);
      logger.info({ calendarId: calendar.id }, "Haftalık sosyal medya içeriği tamamlandı");
    } catch (err) {
      logger.error({ err, calendarId: calendar.id }, "Haftalık içerik üretim hatası");
    }
  });
});

// ─── Postlar ──────────────────────────────────────────────────────────────────

router.get("/api/admin/social/posts", requireAdmin, async (req, res) => {
  const { platform, status, calendarId } = req.query as Record<string, string>;

  let query = db.select().from(socialMediaPostsTable).$dynamic();

  const conditions = [];
  if (platform) conditions.push(eq(socialMediaPostsTable.platform, platform));
  if (status) conditions.push(eq(socialMediaPostsTable.status, status));
  if (calendarId) conditions.push(eq(socialMediaPostsTable.calendarId, Number(calendarId)));

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const posts = await query.orderBy(desc(socialMediaPostsTable.createdAt)).limit(100);
  res.json(posts);
});

router.get("/api/admin/social/posts/pending", requireAdmin, async (req, res) => {
  const posts = await db.select()
    .from(socialMediaPostsTable)
    .where(eq(socialMediaPostsTable.status, "draft"))
    .orderBy(desc(socialMediaPostsTable.createdAt))
    .limit(50);
  res.json(posts);
});

router.get("/api/admin/social/posts/:id", requireAdmin, async (req, res) => {
  const [post] = await db.select()
    .from(socialMediaPostsTable)
    .where(eq(socialMediaPostsTable.id, Number(req.params["id"])));
  if (!post) { res.status(404).json({ error: "Bulunamadı" }); return; }
  res.json(post);
});

router.put("/api/admin/social/posts/:id", requireAdmin, async (req, res) => {
  const { caption, hashtags } = req.body as { caption?: string; hashtags?: string[] };
  await db.update(socialMediaPostsTable).set({
    caption,
    hashtags,
    updatedAt: new Date(),
  }).where(eq(socialMediaPostsTable.id, Number(req.params["id"])));
  res.json({ ok: true });
});

router.post("/api/admin/social/posts/:id/approve", requireAdmin, async (req, res) => {
  await db.update(socialMediaPostsTable).set({
    status: "approved",
    approvedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(socialMediaPostsTable.id, Number(req.params["id"])));

  await db.execute(sql`
    UPDATE content_calendar cc
    SET approved_posts = (
      SELECT COUNT(*) FROM social_media_posts
      WHERE calendar_id = cc.id AND status = 'approved'
    )
    WHERE cc.id = (SELECT calendar_id FROM social_media_posts WHERE id = ${Number(req.params["id"])})
  `);

  res.json({ ok: true });
});

router.post("/api/admin/social/posts/:id/reject", requireAdmin, async (req, res) => {
  await db.update(socialMediaPostsTable).set({
    status: "rejected",
    updatedAt: new Date(),
  }).where(eq(socialMediaPostsTable.id, Number(req.params["id"])));
  res.json({ ok: true });
});

router.post("/api/admin/social/posts/:id/revise", requireAdmin, async (req, res) => {
  const { revisionNote } = req.body as { revisionNote?: string };
  if (!revisionNote?.trim()) { res.status(400).json({ error: "revisionNote zorunlu" }); return; }

  res.json({ ok: true, message: "Revizyon başladı" });

  setImmediate(async () => {
    try {
      const { revisePost } = await import("./contentGenerator");
      await revisePost(Number(req.params["id"]), revisionNote);
      logger.info({ postId: req.params["id"] }, "Post revize edildi");
    } catch (err) {
      logger.error({ err, postId: req.params["id"] }, "Revizyon hatası");
    }
  });
});

router.post("/api/admin/social/posts/:id/publish", requireAdmin, async (req, res) => {
  await db.update(socialMediaPostsTable).set({
    status: "published",
    publishedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(socialMediaPostsTable.id, Number(req.params["id"])));

  await db.execute(sql`
    UPDATE content_calendar cc
    SET published_posts = (
      SELECT COUNT(*) FROM social_media_posts
      WHERE calendar_id = cc.id AND status = 'published'
    )
    WHERE cc.id = (SELECT calendar_id FROM social_media_posts WHERE id = ${Number(req.params["id"])})
  `);

  res.json({ ok: true });
});

// ─── Spontane İçerik ──────────────────────────────────────────────────────────

router.post("/api/admin/social/generate", requireAdmin, async (req, res) => {
  const { platform, topic, notes } = req.body as {
    platform?: "linkedin" | "instagram" | "x";
    topic?: string;
    notes?: string;
  };
  if (!platform || !topic) { res.status(400).json({ error: "platform ve topic zorunlu" }); return; }

  res.json({ ok: true, message: "İçerik üretimi başladı" });

  setImmediate(async () => {
    try {
      const { generateSpontaneous } = await import("./contentGenerator");
      const id = await generateSpontaneous({ platform, topic, notes });
      logger.info({ id, platform, topic }, "Spontane içerik üretildi");
    } catch (err) {
      logger.error({ err }, "Spontane üretim hatası");
    }
  });
});

// ─── Özel Günler ──────────────────────────────────────────────────────────────

router.get("/api/admin/social/special-days", requireAdmin, async (_req, res) => {
  const days = await db.select().from(specialDaysTable).orderBy(specialDaysTable.month, specialDaysTable.day);
  res.json(days);
});

router.post("/api/admin/social/special-days", requireAdmin, async (req, res) => {
  const body = req.body as {
    name: string;
    day?: number;
    month?: number;
    category?: string;
    tone?: string;
    cybersecurityAngle?: string;
  };
  const [day] = await db.insert(specialDaysTable).values(body).returning();
  res.json(day);
});

router.put("/api/admin/social/special-days/:id", requireAdmin, async (req, res) => {
  await db.update(specialDaysTable).set(req.body as Partial<typeof specialDaysTable.$inferInsert>)
    .where(eq(specialDaysTable.id, Number(req.params["id"])));
  res.json({ ok: true });
});

// ─── Hesap Durumu ──────────────────────────────────────────────────────────────

router.get("/api/admin/social/accounts", requireAdmin, async (_req, res) => {
  const accounts = await db.select().from(socialMediaAccountsTable);
  res.json(accounts);
});

// ─── Özet İstatistik ──────────────────────────────────────────────────────────

router.get("/api/admin/social/stats", requireAdmin, async (_req, res) => {
  const [total, pending, approved, published] = await Promise.all([
    db.execute(sql`SELECT COUNT(*) FROM social_media_posts`),
    db.execute(sql`SELECT COUNT(*) FROM social_media_posts WHERE status = 'draft'`),
    db.execute(sql`SELECT COUNT(*) FROM social_media_posts WHERE status = 'approved'`),
    db.execute(sql`SELECT COUNT(*) FROM social_media_posts WHERE status = 'published'`),
  ]);
  res.json({
    total:     Number((total.rows[0] as Record<string, unknown>)["count"] ?? 0),
    pending:   Number((pending.rows[0] as Record<string, unknown>)["count"] ?? 0),
    approved:  Number((approved.rows[0] as Record<string, unknown>)["count"] ?? 0),
    published: Number((published.rows[0] as Record<string, unknown>)["count"] ?? 0),
  });
});

export default router;
