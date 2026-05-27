import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { blogPostsTable, newsletterSubscribersTable, socialMediaLinksTable } from "@workspace/db";
import { eq, desc, asc, and } from "drizzle-orm";
import { requireAdmin } from "./middleware";
import { logger } from "../../lib/logger";
import { sendNewsletterEmail } from "../../services/email";
import crypto from "crypto";

const router = Router();

// ─── Helper: generate URL-safe slug ───────────────────────────────────────────
function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
    .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

// ─── ADMIN: Blog Posts ─────────────────────────────────────────────────────────

router.get("/admin-panel/blog", requireAdmin, async (_req, res) => {
  const rows = await db
    .select({
      id: blogPostsTable.id,
      title: blogPostsTable.title,
      slug: blogPostsTable.slug,
      excerpt: blogPostsTable.excerpt,
      authorName: blogPostsTable.authorName,
      status: blogPostsTable.status,
      publishedAt: blogPostsTable.publishedAt,
      createdAt: blogPostsTable.createdAt,
      updatedAt: blogPostsTable.updatedAt,
    })
    .from(blogPostsTable)
    .orderBy(desc(blogPostsTable.createdAt));
  res.json(rows);
});

router.get("/admin-panel/blog/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(blogPostsTable).where(eq(blogPostsTable.id, id));
  if (!row) { res.status(404).json({ error: "Bulunamadı" }); return; }
  res.json(row);
});

router.post("/admin-panel/blog", requireAdmin, async (req: Request, res: Response) => {
  const { title, excerpt, content, coverImageBase64, authorName } = req.body as {
    title: string; excerpt: string; content: string;
    coverImageBase64?: string; authorName?: string;
  };
  if (!title || !excerpt || !content) {
    res.status(400).json({ error: "Başlık, özet ve içerik zorunludur" });
    return;
  }
  const baseSlug = toSlug(title);
  const suffix = Date.now().toString(36);
  const slug = `${baseSlug}-${suffix}`;

  const [row] = await db.insert(blogPostsTable).values({
    title, slug, excerpt, content,
    coverImageBase64: coverImageBase64 ?? null,
    authorName: authorName ?? "CyberStep.io",
    status: "draft",
  }).returning();
  logger.info({ id: row.id }, "Blog post created");
  res.status(201).json(row);
});

router.put("/admin-panel/blog/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { title, excerpt, content, coverImageBase64, authorName } = req.body as {
    title?: string; excerpt?: string; content?: string;
    coverImageBase64?: string; authorName?: string;
  };
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (title !== undefined) updateData.title = title;
  if (excerpt !== undefined) updateData.excerpt = excerpt;
  if (content !== undefined) updateData.content = content;
  if (coverImageBase64 !== undefined) updateData.coverImageBase64 = coverImageBase64;
  if (authorName !== undefined) updateData.authorName = authorName;

  const [row] = await db.update(blogPostsTable).set(updateData).where(eq(blogPostsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Bulunamadı" }); return; }
  res.json(row);
});

router.delete("/admin-panel/blog/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await db.delete(blogPostsTable).where(eq(blogPostsTable.id, id));
  logger.info({ id }, "Blog post deleted");
  res.json({ success: true });
});

router.post("/admin-panel/blog/:id/publish", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const [post] = await db.update(blogPostsTable)
    .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
    .where(eq(blogPostsTable.id, id))
    .returning();
  if (!post) { res.status(404).json({ error: "Bulunamadı" }); return; }

  // Send newsletter async (fire-and-forget)
  void (async () => {
    try {
      const subscribers = await db.select()
        .from(newsletterSubscribersTable)
        .where(eq(newsletterSubscribersTable.isActive, true));
      logger.info({ postId: id, count: subscribers.length }, "Sending newsletter");
      await sendNewsletterEmail({ post, subscribers });
    } catch (err) {
      logger.error({ err, postId: id }, "Newsletter send failed");
    }
  })();

  res.json({ success: true, post });
});

router.post("/admin-panel/blog/:id/unpublish", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const [row] = await db.update(blogPostsTable)
    .set({ status: "draft", publishedAt: null, updatedAt: new Date() })
    .where(eq(blogPostsTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Bulunamadı" }); return; }
  res.json({ success: true, post: row });
});

// ─── ADMIN: Newsletter Subscribers ────────────────────────────────────────────

router.get("/admin-panel/newsletter/subscribers", requireAdmin, async (_req, res) => {
  const rows = await db.select({
    id: newsletterSubscribersTable.id,
    email: newsletterSubscribersTable.email,
    isActive: newsletterSubscribersTable.isActive,
    subscribedAt: newsletterSubscribersTable.subscribedAt,
    unsubscribedAt: newsletterSubscribersTable.unsubscribedAt,
  }).from(newsletterSubscribersTable).orderBy(desc(newsletterSubscribersTable.subscribedAt));
  res.json(rows);
});

// ─── ADMIN: Social Media Links ─────────────────────────────────────────────────

router.get("/admin-panel/social-links", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(socialMediaLinksTable).orderBy(asc(socialMediaLinksTable.sortOrder));
  res.json(rows);
});

router.post("/admin-panel/social-links", requireAdmin, async (req: Request, res: Response) => {
  const { platform, label, url, sortOrder } = req.body as {
    platform: string; label: string; url: string; sortOrder?: number;
  };
  if (!platform || !label || !url) {
    res.status(400).json({ error: "Platform, etiket ve URL zorunludur" });
    return;
  }
  const [row] = await db.insert(socialMediaLinksTable)
    .values({ platform, label, url, sortOrder: sortOrder ?? 0 })
    .returning();
  logger.info({ id: row.id }, "Social media link created");
  res.status(201).json(row);
});

router.put("/admin-panel/social-links/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { platform, label, url, isActive, sortOrder } = req.body as {
    platform?: string; label?: string; url?: string; isActive?: boolean; sortOrder?: number;
  };
  const [row] = await db.update(socialMediaLinksTable)
    .set({
      ...(platform !== undefined && { platform }),
      ...(label !== undefined && { label }),
      ...(url !== undefined && { url }),
      ...(isActive !== undefined && { isActive }),
      ...(sortOrder !== undefined && { sortOrder }),
      updatedAt: new Date(),
    })
    .where(eq(socialMediaLinksTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Bulunamadı" }); return; }
  res.json(row);
});

router.delete("/admin-panel/social-links/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await db.delete(socialMediaLinksTable).where(eq(socialMediaLinksTable.id, id));
  logger.info({ id }, "Social media link deleted");
  res.json({ success: true });
});

// ─── PUBLIC: Blog Posts ────────────────────────────────────────────────────────

router.get("/public/blog", async (_req, res) => {
  const rows = await db.select({
    id: blogPostsTable.id,
    title: blogPostsTable.title,
    slug: blogPostsTable.slug,
    excerpt: blogPostsTable.excerpt,
    coverImageBase64: blogPostsTable.coverImageBase64,
    authorName: blogPostsTable.authorName,
    publishedAt: blogPostsTable.publishedAt,
  })
    .from(blogPostsTable)
    .where(eq(blogPostsTable.status, "published"))
    .orderBy(desc(blogPostsTable.publishedAt));
  res.json(rows);
});

router.get("/public/blog/:slug", async (req: Request, res: Response) => {
  const { slug } = req.params;
  const [row] = await db.select().from(blogPostsTable)
    .where(and(eq(blogPostsTable.slug, slug as string), eq(blogPostsTable.status, "published")));
  if (!row) { res.status(404).json({ error: "Yazı bulunamadı" }); return; }
  res.json(row);
});

// ─── PUBLIC: Newsletter Subscribe / Unsubscribe ────────────────────────────────

router.post("/public/newsletter/subscribe", async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Geçerli bir e-posta adresi girin" });
    return;
  }
  const normalized = email.toLowerCase().trim();
  const token = crypto.randomBytes(32).toString("hex");

  // Upsert: reactivate if already exists
  const existing = await db.select().from(newsletterSubscribersTable)
    .where(eq(newsletterSubscribersTable.email, normalized));

  if (existing.length > 0) {
    await db.update(newsletterSubscribersTable)
      .set({ isActive: true, unsubscribedAt: null })
      .where(eq(newsletterSubscribersTable.email, normalized));
    res.json({ success: true, message: "Abone oldunuz" });
    return;
  }

  await db.insert(newsletterSubscribersTable).values({
    email: normalized,
    unsubscribeToken: token,
    isActive: true,
  });
  logger.info({ email: normalized }, "Newsletter subscriber added");
  res.json({ success: true, message: "Abone oldunuz" });
});

router.get("/public/newsletter/unsubscribe/:token", async (req: Request, res: Response) => {
  const { token } = req.params;
  const [sub] = await db.select().from(newsletterSubscribersTable)
    .where(eq(newsletterSubscribersTable.unsubscribeToken, token as string));
  if (!sub) {
    res.status(404).send("Abonelik bulunamadı");
    return;
  }
  await db.update(newsletterSubscribersTable)
    .set({ isActive: false, unsubscribedAt: new Date() })
    .where(eq(newsletterSubscribersTable.unsubscribeToken, token as string));
  logger.info({ email: sub.email }, "Newsletter unsubscribe");
  res.send(`<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>Abonelikten Çıkıldı</title>
    <style>body{font-family:Arial,sans-serif;background:#f1f5f9;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
    .box{background:#fff;border-radius:12px;padding:40px;max-width:400px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.1)}
    h2{color:#0f172a;margin:0 0 12px}p{color:#64748b;font-size:14px}a{color:#10b981}</style></head>
    <body><div class="box"><h2>Abonelikten Çıkıldı</h2>
    <p>${sub.email} adresi CyberStep.io bülteninden çıkarıldı. Tekrar abone olmak için <a href="/">sitemizi ziyaret edin</a>.</p></div></body></html>`);
});

// ─── PUBLIC: Social Media Links ────────────────────────────────────────────────

router.get("/public/social-links", async (_req, res) => {
  const rows = await db.select().from(socialMediaLinksTable)
    .where(eq(socialMediaLinksTable.isActive, true))
    .orderBy(asc(socialMediaLinksTable.sortOrder));
  res.json(rows);
});

export default router;
