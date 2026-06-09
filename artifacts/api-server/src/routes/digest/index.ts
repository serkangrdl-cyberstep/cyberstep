import { Router } from "express";
import { db } from "@workspace/db";
import {
  newsSourcesTable,
  newsItemsTable,
  weeklyDigestsTable,
} from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { collectRSSFeeds, seedDefaultSources } from "./rss-collector";
import { generateWeeklyDigest } from "./claude-processor";
import { sendMail, sendDigestWeeklyEmail } from "../../services/email";
import { newsletterSubscribersTable } from "@workspace/db";
import { logger } from "../../lib/logger";
import { z } from "zod";

const router = Router();

// ─── News Sources ─────────────────────────────────────────────────────────────

router.get("/sources", async (req, res) => {
  const sources = await db
    .select()
    .from(newsSourcesTable)
    .orderBy(newsSourcesTable.name);
  res.json(sources);
});

router.post("/sources", async (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    url: z.string().url(),
    type: z.string().optional().default("rss"),
    language: z.string().optional().default("tr"),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Geçersiz kaynak verisi" });
    return;
  }
  const [source] = await db
    .insert(newsSourcesTable)
    .values(parsed.data)
    .returning();
  res.status(201).json(source);
});

router.patch("/sources/:id", async (req, res) => {
  const id = parseInt(req.params["id"]!, 10);
  const schema = z.object({
    name: z.string().min(1).optional(),
    isActive: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Geçersiz veri" });
    return;
  }
  const [updated] = await db
    .update(newsSourcesTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(newsSourcesTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Kaynak bulunamadı" });
    return;
  }
  res.json(updated);
});

router.delete("/sources/:id", async (req, res) => {
  const id = parseInt(req.params["id"]!, 10);
  await db.delete(newsSourcesTable).where(eq(newsSourcesTable.id, id));
  res.status(204).end();
});

// ─── News Items ───────────────────────────────────────────────────────────────

router.get("/news", async (req, res) => {
  const weekYear = req.query["weekYear"] ? parseInt(req.query["weekYear"] as string, 10) : undefined;
  const weekNumber = req.query["weekNumber"] ? parseInt(req.query["weekNumber"] as string, 10) : undefined;
  const page = parseInt((req.query["page"] as string) ?? "1", 10);
  const limit = Math.min(parseInt((req.query["limit"] as string) ?? "50", 10), 100);
  const offset = (page - 1) * limit;

  const turkeyOnly = req.query["turkeyOnly"] !== "false";
  const conditions: ReturnType<typeof eq>[] = [];
  if (turkeyOnly) conditions.push(eq(newsItemsTable.isTurkeyRelated, true));
  if (weekYear) conditions.push(eq(newsItemsTable.weekYear, weekYear));
  if (weekNumber) conditions.push(eq(newsItemsTable.weekNumber, weekNumber));

  const items = await db
    .select()
    .from(newsItemsTable)
    .where(and(...conditions))
    .orderBy(desc(newsItemsTable.publishedAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(newsItemsTable)
    .where(and(...conditions));

  res.json({ items, total, page, limit });
});

// ─── Digests ──────────────────────────────────────────────────────────────────

router.get("/digests", async (req, res) => {
  const digests = await db
    .select()
    .from(weeklyDigestsTable)
    .orderBy(desc(weeklyDigestsTable.weekYear), desc(weeklyDigestsTable.weekNumber));
  res.json(digests);
});

router.get("/digests/:id", async (req, res) => {
  const id = parseInt(req.params["id"]!, 10);
  const [digest] = await db
    .select()
    .from(weeklyDigestsTable)
    .where(eq(weeklyDigestsTable.id, id))
    .limit(1);
  if (!digest) {
    res.status(404).json({ error: "Digest bulunamadı" });
    return;
  }
  res.json(digest);
});

router.put("/digests/:id", async (req, res) => {
  const id = parseInt(req.params["id"]!, 10);
  const schema = z.object({
    contentSummary: z.string().optional(),
    contentLinkedin: z.string().optional(),
    contentTwitter: z.string().optional(),
    contentInstagram: z.string().optional(),
    contentStory: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Geçersiz veri" });
    return;
  }
  const [updated] = await db
    .update(weeklyDigestsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(weeklyDigestsTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Digest bulunamadı" });
    return;
  }
  res.json(updated);
});

router.post("/digests/:id/approve", async (req, res) => {
  const id = parseInt(req.params["id"]!, 10);
  const [digest] = await db
    .select()
    .from(weeklyDigestsTable)
    .where(eq(weeklyDigestsTable.id, id))
    .limit(1);
  if (!digest) {
    res.status(404).json({ error: "Digest bulunamadı" });
    return;
  }

  await db
    .update(weeklyDigestsTable)
    .set({ status: "approved", approvedAt: new Date(), updatedAt: new Date() })
    .where(eq(weeklyDigestsTable.id, id));

  const adminEmail = process.env["ADMIN_EMAIL"] ?? process.env["SMTP_USER"];
  if (adminEmail) {
    const weekLabel = `${digest.weekYear} / Hafta ${digest.weekNumber}`;
    const baseUrl = process.env["REPLIT_DOMAINS"]
      ? `https://${process.env["REPLIT_DOMAINS"].split(",")[0]?.trim()}`
      : "http://localhost:80";

    await sendMail({
      to: adminEmail,
      subject: `[CyberStep Digest] ${weekLabel} Onaylandı`,
      html: `
        <h2>Haftalık Digest Onaylandı</h2>
        <p><strong>${weekLabel}</strong> digest'i onaylandı.</p>
        <p><a href="${baseUrl}/digest/">Digest panelini görüntüle</a></p>
        <hr/>
        <h3>Özet</h3>
        <pre style="white-space:pre-wrap">${digest.contentSummary ?? "-"}</pre>
      `,
    });
  }

  // Digest abonelerine haftalık bülten gönder
  try {
    const digestSubs = await db
      .select({ email: newsletterSubscribersTable.email, unsubscribeToken: newsletterSubscribersTable.unsubscribeToken })
      .from(newsletterSubscribersTable)
      .where(
        and(
          eq(newsletterSubscribersTable.isActive, true),
          eq(newsletterSubscribersTable.subscribeToDigest, true)
        )
      );
    if (digestSubs.length > 0) {
      await sendDigestWeeklyEmail({ digest, subscribers: digestSubs });
      logger.info({ id, count: digestSubs.length }, "Digest weekly email sent to subscribers");
    }
  } catch (err) {
    logger.warn({ err }, "Digest subscriber email send failed but approval succeeded");
  }

  const webhookUrl = process.env["DIGEST_WEBHOOK_URL"];
  if (webhookUrl) {
    try {
      const { default: axios } = await import("axios");
      await axios.post(webhookUrl, {
        event: "digest.approved",
        digestId: id,
        weekYear: digest.weekYear,
        weekNumber: digest.weekNumber,
      });
    } catch (err) {
      logger.warn({ err }, "Webhook call failed but approval succeeded");
    }
  }

  res.json({ success: true });
});

// ─── Manual triggers ──────────────────────────────────────────────────────────

router.post("/collect", async (req, res) => {
  collectRSSFeeds().catch((err) => logger.error({ err }, "Manual RSS collection failed"));
  res.json({ message: "Haber toplama başlatıldı" });
});

router.post("/enrich", async (req, res) => {
  import("../../services/news/newsEnricher")
    .then(({ enrichNewsItems }) => enrichNewsItems())
    .catch((err) => logger.error({ err }, "Manual enrichment failed"));
  res.json({ message: "AI zenginleştirme başlatıldı (özet + CVE çıkarma)" });
});

router.post("/generate", async (req, res) => {
  const { weekYear, weekNumber } = req.body as {
    weekYear?: number;
    weekNumber?: number;
  };
  generateWeeklyDigest(weekYear, weekNumber)
    .then((id) => logger.info({ id }, "Manual digest generation complete"))
    .catch((err) => logger.error({ err }, "Manual digest generation failed"));
  res.json({ message: "Digest oluşturma başlatıldı" });
});

// ─── Stats ────────────────────────────────────────────────────────────────────

router.get("/stats", async (req, res) => {
  const [sourcesCount] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(newsSourcesTable)
    .where(eq(newsSourcesTable.isActive, true));

  const [newsCount] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(newsItemsTable)
    .where(eq(newsItemsTable.isTurkeyRelated, true));

  const [digestsCount] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(weeklyDigestsTable);

  const latestDigest = await db
    .select()
    .from(weeklyDigestsTable)
    .orderBy(desc(weeklyDigestsTable.weekYear), desc(weeklyDigestsTable.weekNumber))
    .limit(1);

  res.json({
    activeSources: sourcesCount?.total ?? 0,
    totalNewsItems: newsCount?.total ?? 0,
    totalDigests: digestsCount?.total ?? 0,
    latestDigest: latestDigest[0] ?? null,
  });
});

export { router as digestRouter, seedDefaultSources };
