import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { blogPostsTable, newsletterSubscribersTable, socialMediaLinksTable, blogContentCalendarTable } from "@workspace/db";
import { eq, desc, asc, and } from "drizzle-orm";
import { requireAdmin } from "./middleware";
import { logger } from "../../lib/logger";
import { sendNewsletterEmail } from "../../services/email";
import { getBlogAutopilotStatus, generateAndPublishBlogPost, generateAndSaveDraft, BLOG_PLAN } from "../../services/blog-autopilot";
import { generateImage } from "@workspace/integrations-gemini-ai/image";
import crypto from "crypto";

function buildCoverImagePrompt(title: string, excerpt: string | null): string {
  return [
    "Professional cybersecurity blog article cover image.",
    "Modern, dark blue and teal color scheme, abstract digital security visualization.",
    `Theme: "${title}".`,
    excerpt ? `Context: ${excerpt.slice(0, 120)}.` : "",
    "No text, no letters, no words. Clean, high-quality, cinematic lighting. 16:9 landscape format.",
  ].filter(Boolean).join(" ");
}

const router = Router();

interface CarouselSlide { slide: number; text: string; }
interface VisualPrompts { blog: string; linkedin: string; instagram: string; x: string; }
interface BlogRef { title: string; url: string; }

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

type BlogBodyFull = {
  title?: string; excerpt?: string; content?: string;
  titleEn?: string; excerptEn?: string; contentEn?: string;
  socialTextTr?: string; socialTextEn?: string;
  linkedinPostTr?: string; linkedinPostEn?: string;
  seoTitle?: string; seoTitleEn?: string;
  metaDescription?: string; metaDescriptionEn?: string;
  focusKeyword?: string; focusKeywordEn?: string;
  seoTags?: string[]; seoTagsEn?: string[];
  instagramCarouselTr?: CarouselSlide[]; instagramCarouselEn?: CarouselSlide[];
  instagramCaptionTr?: string; instagramCaptionEn?: string;
  visualPromptsTr?: VisualPrompts; visualPromptsEn?: VisualPrompts;
  refsJson?: BlogRef[];
  coverImageBase64?: string; authorName?: string;
};

// ─── ADMIN: Blog Autopilot ─────────────────────────────────────────────────────

router.get("/admin-panel/blog-autopilot/status", requireAdmin, async (_req, res) => {
  const status = await getBlogAutopilotStatus();
  res.json(status);
});

router.post("/admin-panel/blog-autopilot/run-now", requireAdmin, async (_req, res) => {
  res.json({ success: true, message: "Yazı üretimi arka planda başlatıldı" });
  void (async () => {
    try {
      await generateAndPublishBlogPost();
      logger.info("Blog autopilot: manuel tetikleme tamamlandı");
    } catch (err) {
      logger.error({ err }, "Blog autopilot: manuel tetikleme başarısız");
    }
  })();
});

router.post("/admin-panel/blog-autopilot/generate-draft", requireAdmin, async (_req, res) => {
  res.json({ success: true, message: "Taslak üretimi arka planda başlatıldı" });
  void (async () => {
    try {
      const result = await generateAndSaveDraft();
      logger.info({ postId: result.postId, title: result.title }, "Blog autopilot: taslak üretildi");
    } catch (err) {
      logger.error({ err }, "Blog autopilot: taslak üretimi başarısız");
    }
  })();
});

router.get("/admin-panel/blog-autopilot/plan", requireAdmin, (_req, res) => {
  res.json(BLOG_PLAN.map((t, i) => ({
    index: i,
    ...t,
    categoryCode: t.category.startsWith("Sektör:") ? "SE"
      : t.category === "KVKK & Uyumluluk" ? "DU"
      : ["Siber Tehditler", "Phishing & Sosyal Mühendislik", "Sosyal Mühendislik", "Yapay Zeka & Siber Güvenlik", "Fidye Yazılımı", "Tedarik Zinciri"].includes(t.category) ? "FA"
      : "RE",
  })));
});

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
      titleEn: blogPostsTable.titleEn,
      coverImageBase64: blogPostsTable.coverImageBase64,
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
  const body = req.body as BlogBodyFull;
  const { title, excerpt, content } = body;
  if (!title || !excerpt || !content) {
    res.status(400).json({ error: "Başlık, özet ve içerik zorunludur" });
    return;
  }
  const baseSlug = toSlug(title);
  const suffix = Date.now().toString(36);
  const slug = `${baseSlug}-${suffix}`;

  const [row] = await db.insert(blogPostsTable).values({
    title, slug, excerpt, content,
    titleEn: body.titleEn || null,
    excerptEn: body.excerptEn || null,
    contentEn: body.contentEn || null,
    socialTextTr: body.socialTextTr || null,
    socialTextEn: body.socialTextEn || null,
    linkedinPostTr: body.linkedinPostTr || null,
    linkedinPostEn: body.linkedinPostEn || null,
    seoTitle: body.seoTitle || null,
    seoTitleEn: body.seoTitleEn || null,
    metaDescription: body.metaDescription || null,
    metaDescriptionEn: body.metaDescriptionEn || null,
    focusKeyword: body.focusKeyword || null,
    focusKeywordEn: body.focusKeywordEn || null,
    seoTags: body.seoTags?.length ? body.seoTags : null,
    seoTagsEn: body.seoTagsEn?.length ? body.seoTagsEn : null,
    instagramCarouselTr: body.instagramCarouselTr?.length ? body.instagramCarouselTr : null,
    instagramCarouselEn: body.instagramCarouselEn?.length ? body.instagramCarouselEn : null,
    instagramCaptionTr: body.instagramCaptionTr || null,
    instagramCaptionEn: body.instagramCaptionEn || null,
    visualPromptsTr: body.visualPromptsTr ?? null,
    visualPromptsEn: body.visualPromptsEn ?? null,
    refsJson: body.refsJson?.length ? body.refsJson : null,
    coverImageBase64: body.coverImageBase64 ?? null,
    authorName: body.authorName ?? "CyberStep.io",
    status: "draft",
  }).returning();
  logger.info({ id: row.id }, "Blog post created");
  res.status(201).json(row);
});

router.put("/admin-panel/blog/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const body = req.body as BlogBodyFull;
  const u: Record<string, unknown> = { updatedAt: new Date() };

  if (body.title !== undefined) u.title = body.title;
  if (body.excerpt !== undefined) u.excerpt = body.excerpt;
  if (body.content !== undefined) u.content = body.content;
  if (body.titleEn !== undefined) u.titleEn = body.titleEn || null;
  if (body.excerptEn !== undefined) u.excerptEn = body.excerptEn || null;
  if (body.contentEn !== undefined) u.contentEn = body.contentEn || null;
  if (body.socialTextTr !== undefined) u.socialTextTr = body.socialTextTr || null;
  if (body.socialTextEn !== undefined) u.socialTextEn = body.socialTextEn || null;
  if (body.linkedinPostTr !== undefined) u.linkedinPostTr = body.linkedinPostTr || null;
  if (body.linkedinPostEn !== undefined) u.linkedinPostEn = body.linkedinPostEn || null;
  if (body.seoTitle !== undefined) u.seoTitle = body.seoTitle || null;
  if (body.seoTitleEn !== undefined) u.seoTitleEn = body.seoTitleEn || null;
  if (body.metaDescription !== undefined) u.metaDescription = body.metaDescription || null;
  if (body.metaDescriptionEn !== undefined) u.metaDescriptionEn = body.metaDescriptionEn || null;
  if (body.focusKeyword !== undefined) u.focusKeyword = body.focusKeyword || null;
  if (body.focusKeywordEn !== undefined) u.focusKeywordEn = body.focusKeywordEn || null;
  if (body.seoTags !== undefined) u.seoTags = body.seoTags?.length ? body.seoTags : null;
  if (body.seoTagsEn !== undefined) u.seoTagsEn = body.seoTagsEn?.length ? body.seoTagsEn : null;
  if (body.instagramCarouselTr !== undefined) u.instagramCarouselTr = body.instagramCarouselTr?.length ? body.instagramCarouselTr : null;
  if (body.instagramCarouselEn !== undefined) u.instagramCarouselEn = body.instagramCarouselEn?.length ? body.instagramCarouselEn : null;
  if (body.instagramCaptionTr !== undefined) u.instagramCaptionTr = body.instagramCaptionTr || null;
  if (body.instagramCaptionEn !== undefined) u.instagramCaptionEn = body.instagramCaptionEn || null;
  if (body.visualPromptsTr !== undefined) u.visualPromptsTr = body.visualPromptsTr ?? null;
  if (body.visualPromptsEn !== undefined) u.visualPromptsEn = body.visualPromptsEn ?? null;
  if (body.refsJson !== undefined) u.refsJson = body.refsJson?.length ? body.refsJson : null;
  if (body.coverImageBase64 !== undefined) u.coverImageBase64 = body.coverImageBase64;
  if (body.authorName !== undefined) u.authorName = body.authorName;

  const [row] = await db.update(blogPostsTable).set(u).where(eq(blogPostsTable.id, id)).returning();
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

  // Auto-generate cover image if none exists
  if (!post.coverImageBase64) {
    void (async () => {
      try {
        const prompt = buildCoverImagePrompt(post.title, post.excerpt);
        const { b64_json, mimeType } = await generateImage(prompt);
        const dataUrl = `data:${mimeType};base64,${b64_json}`;
        await db.update(blogPostsTable)
          .set({ coverImageBase64: dataUrl })
          .where(eq(blogPostsTable.id, id));
        logger.info({ postId: id }, "Auto-generated cover image on publish");
      } catch (err) {
        logger.warn({ err, postId: id }, "Auto cover image generation failed");
      }
    })();
  }

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
    subscribeToBlog: newsletterSubscribersTable.subscribeToBlog,
    subscribeToDigest: newsletterSubscribersTable.subscribeToDigest,
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
    titleEn: blogPostsTable.titleEn,
    slug: blogPostsTable.slug,
    excerpt: blogPostsTable.excerpt,
    excerptEn: blogPostsTable.excerptEn,
    content: blogPostsTable.content,
    contentEn: blogPostsTable.contentEn,
    coverImageBase64: blogPostsTable.coverImageBase64,
    authorName: blogPostsTable.authorName,
    publishedAt: blogPostsTable.publishedAt,
    seoTitle: blogPostsTable.seoTitle,
    seoTitleEn: blogPostsTable.seoTitleEn,
    metaDescription: blogPostsTable.metaDescription,
    metaDescriptionEn: blogPostsTable.metaDescriptionEn,
    focusKeyword: blogPostsTable.focusKeyword,
    seoTags: blogPostsTable.seoTags,
  })
    .from(blogPostsTable)
    .where(eq(blogPostsTable.status, "published"))
    .orderBy(desc(blogPostsTable.publishedAt));

  const result = rows.map(r => {
    const stripHtml = (html: string) => html.replace(/<[^>]+>/g, " ");
    const trWords = stripHtml(r.content).trim().split(/\s+/).filter(Boolean).length;
    const enWords = r.contentEn ? stripHtml(r.contentEn).trim().split(/\s+/).filter(Boolean).length : 0;
    return {
      id: r.id, title: r.title, titleEn: r.titleEn, slug: r.slug,
      excerpt: r.excerpt, excerptEn: r.excerptEn,
      coverImageBase64: r.coverImageBase64, authorName: r.authorName, publishedAt: r.publishedAt,
      seoTitle: r.seoTitle, seoTitleEn: r.seoTitleEn,
      metaDescription: r.metaDescription, metaDescriptionEn: r.metaDescriptionEn,
      focusKeyword: r.focusKeyword, seoTags: r.seoTags,
      readingMinutesTr: Math.max(1, Math.round(trWords / 200)),
      readingMinutesEn: enWords > 0 ? Math.max(1, Math.round(enWords / 200)) : Math.max(1, Math.round(trWords / 200)),
    };
  });
  res.json(result);
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
  const { email, subscribeToBlog, subscribeToDigest } = req.body as {
    email?: string;
    subscribeToBlog?: boolean;
    subscribeToDigest?: boolean;
  };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Geçerli bir e-posta adresi girin" });
    return;
  }
  if (subscribeToBlog === false && subscribeToDigest === false) {
    res.status(400).json({ error: "En az bir içerik türü seçin" });
    return;
  }
  const toBlog = subscribeToBlog !== false;
  const toDigest = subscribeToDigest === true;
  const normalized = email.toLowerCase().trim();
  const token = crypto.randomBytes(32).toString("hex");

  const existing = await db.select().from(newsletterSubscribersTable)
    .where(eq(newsletterSubscribersTable.email, normalized));

  if (existing.length > 0) {
    await db.update(newsletterSubscribersTable)
      .set({ isActive: true, unsubscribedAt: null, subscribeToBlog: toBlog, subscribeToDigest: toDigest })
      .where(eq(newsletterSubscribersTable.email, normalized));
    res.json({ success: true, message: "Aboneliğiniz güncellendi" });
    return;
  }

  await db.insert(newsletterSubscribersTable).values({
    email: normalized,
    unsubscribeToken: token,
    isActive: true,
    subscribeToBlog: toBlog,
    subscribeToDigest: toDigest,
  });
  logger.info({ email: normalized, toBlog, toDigest }, "Newsletter subscriber added");
  res.json({ success: true, message: "Abone oldunuz" });
});

// GET /public/newsletter/unsubscribe/:token — tüm aboneliklerden çık
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
  logger.info({ email: sub.email }, "Newsletter full unsubscribe");
  res.send(unsubscribePageHtml(sub.email, "all"));
});

// GET /public/newsletter/unsubscribe/:token/:type — belirli türden çık (blog | digest)
router.get("/public/newsletter/unsubscribe/:token/:type", async (req: Request, res: Response) => {
  const { token, type } = req.params;
  if (type !== "blog" && type !== "digest") {
    res.status(400).send("Geçersiz tür");
    return;
  }
  const [sub] = await db.select().from(newsletterSubscribersTable)
    .where(eq(newsletterSubscribersTable.unsubscribeToken, token as string));
  if (!sub) {
    res.status(404).send("Abonelik bulunamadı");
    return;
  }
  const updates = type === "blog"
    ? { subscribeToBlog: false }
    : { subscribeToDigest: false };
  const remaining = type === "blog" ? sub.subscribeToDigest : sub.subscribeToBlog;
  if (!remaining) {
    await db.update(newsletterSubscribersTable)
      .set({ ...updates, isActive: false, unsubscribedAt: new Date() })
      .where(eq(newsletterSubscribersTable.unsubscribeToken, token as string));
  } else {
    await db.update(newsletterSubscribersTable)
      .set(updates)
      .where(eq(newsletterSubscribersTable.unsubscribeToken, token as string));
  }
  logger.info({ email: sub.email, type }, "Newsletter partial unsubscribe");
  res.send(unsubscribePageHtml(sub.email, type));
});

function unsubscribePageHtml(email: string, type: "all" | "blog" | "digest"): string {
  const label = type === "all"
    ? "tüm CyberStep.io bültenlerinden"
    : type === "blog"
    ? "blog yazıları bülteninden"
    : "Haftalık Siber Olaylar bülteninden";
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>Abonelikten Çıkıldı</title>
    <style>body{font-family:Arial,sans-serif;background:#f1f5f9;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
    .box{background:#fff;border-radius:12px;padding:40px;max-width:420px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.1)}
    h2{color:#0f172a;margin:0 0 12px}p{color:#64748b;font-size:14px;line-height:1.6}a{color:#10b981}</style></head>
    <body><div class="box"><h2>Abonelikten Çıkıldı</h2>
    <p><strong>${email}</strong> adresi ${label} çıkarıldı.</p>
    <p>Tekrar abone olmak için <a href="/">sitemizi ziyaret edin</a>.</p></div></body></html>`;
}

// ─── PUBLIC: Social Media Links ────────────────────────────────────────────────

router.get("/public/social-links", async (_req, res) => {
  const rows = await db.select().from(socialMediaLinksTable)
    .where(eq(socialMediaLinksTable.isActive, true))
    .orderBy(asc(socialMediaLinksTable.sortOrder));
  res.json(rows);
});

// ─── Content Calendar ──────────────────────────────────────────────────────────

router.get("/admin-panel/blog-calendar", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { category, audience, status } = req.query as Record<string, string>;
    let query = db.select().from(blogContentCalendarTable).$dynamic();
    const conditions = [];
    if (category) conditions.push(eq(blogContentCalendarTable.category, category));
    if (audience) conditions.push(eq(blogContentCalendarTable.targetAudience, audience));
    if (status) conditions.push(eq(blogContentCalendarTable.status, status));
    if (conditions.length > 0) {
      const { and: andFn } = await import("drizzle-orm");
      query = query.where(andFn(...conditions));
    }
    const rows = await query.orderBy(asc(blogContentCalendarTable.sortOrder));
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "blog-calendar: liste alınamadı");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.patch("/admin-panel/blog-calendar/:id/status", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body as { status: string };
    const valid = ["planned", "in_progress", "published", "archived"];
    if (!valid.includes(status)) return void res.status(400).json({ error: "Geçersiz durum" });
    await db.update(blogContentCalendarTable)
      .set({ status, ...(status === "published" ? { publishedAt: new Date() } : {}) })
      .where(eq(blogContentCalendarTable.id, id));
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "blog-calendar: durum güncellenemedi");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── Dinamik Sitemap ────────────────────────────────────────────────────────────

router.get("/public/sitemap.xml", async (_req, res) => {
  const BASE_URL = "https://cyberstep.io";
  const today = new Date().toISOString().split("T")[0];

  const staticPages = [
    { url: "/", priority: "1.0", changefreq: "weekly" },
    { url: "/degerlendirme", priority: "0.9", changefreq: "monthly" },
    { url: "/fiyatlar", priority: "0.9", changefreq: "weekly" },
    { url: "/domain-tarama", priority: "0.9", changefreq: "monthly" },
    { url: "/blog", priority: "0.8", changefreq: "daily" },
    { url: "/tum-araclar", priority: "0.8", changefreq: "monthly" },
    { url: "/ai-guvenlik-degerlendirmesi", priority: "0.8", changefreq: "monthly" },
    { url: "/pentest-lite", priority: "0.8", changefreq: "monthly" },
    { url: "/phishing-sim", priority: "0.8", changefreq: "monthly" },
    { url: "/kvkk-ceza-sim", priority: "0.8", changefreq: "monthly" },
    { url: "/sifre-guvenligi", priority: "0.8", changefreq: "monthly" },
    { url: "/veri-sizintisi-kontrolu", priority: "0.8", changefreq: "monthly" },
    { url: "/rakip-karsilastirma", priority: "0.7", changefreq: "weekly" },
    { url: "/hakkimizda", priority: "0.7", changefreq: "monthly" },
    { url: "/iletisim", priority: "0.7", changefreq: "monthly" },
    { url: "/cozum-ortakligi", priority: "0.6", changefreq: "monthly" },
    { url: "/yatirim-paketi", priority: "0.6", changefreq: "monthly" },
    { url: "/sektor/saglik", priority: "0.7", changefreq: "monthly" },
    { url: "/sektor/finans", priority: "0.7", changefreq: "monthly" },
    { url: "/sektor/perakende", priority: "0.7", changefreq: "monthly" },
    { url: "/sektor/bilisim", priority: "0.7", changefreq: "monthly" },
    { url: "/sektor/imalat", priority: "0.7", changefreq: "monthly" },
    { url: "/kvkk", priority: "0.3", changefreq: "yearly" },
    { url: "/gizlilik-politikasi", priority: "0.3", changefreq: "yearly" },
    { url: "/kullanim-kosullari", priority: "0.3", changefreq: "yearly" },
    { url: "/cerez-politikasi", priority: "0.3", changefreq: "yearly" },
  ];

  // Blog yazılarını DB'den çek
  let blogPages: { url: string; lastmod: string; priority: string; changefreq: string }[] = [];
  try {
    const blogs = await db
      .select({ slug: blogPostsTable.slug, publishedAt: blogPostsTable.publishedAt })
      .from(blogPostsTable)
      .where(eq(blogPostsTable.status, "published"))
      .orderBy(desc(blogPostsTable.publishedAt));
    blogPages = blogs.map(b => ({
      url: `/blog/${b.slug}`,
      lastmod: b.publishedAt ? new Date(b.publishedAt).toISOString().split("T")[0] : today,
      priority: "0.7",
      changefreq: "monthly",
    }));
  } catch {
    // DB hatasında statik sayfalarla devam et
  }

  const allPages = [
    ...staticPages.map(p => ({ ...p, lastmod: today })),
    ...blogPages,
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${allPages.map(p => `  <url>
    <loc>${BASE_URL}${p.url}</loc>
    <lastmod>${p.lastmod}</lastmod>
    <xhtml:link rel="alternate" hreflang="tr" href="${BASE_URL}${p.url}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}${p.url}"/>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join("\n")}
</urlset>`;

  res.set("Content-Type", "application/xml");
  res.set("Cache-Control", "public, max-age=3600");
  res.send(xml);
});

export default router;
