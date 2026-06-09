import RSSParser from "rss-parser";
import { db } from "@workspace/db";
import { newsSourcesTable, newsItemsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";

const parser = new RSSParser({
  timeout: 10000,
  headers: { "User-Agent": "CyberStep-NewsBot/1.0" },
});

const TURKEY_KEYWORDS = [
  "türkiye", "turkey", "türk", "turkish", "ankara", "istanbul",
  "btk", "usom", "tib", "tr ", ".tr", "kddk", "kvkk",
  "bankacılık", "bddk", "epdk", "tcmb",
];

export function isTurkeyRelated(title: string, snippet: string): boolean {
  const text = (title + " " + snippet).toLowerCase();
  return TURKEY_KEYWORDS.some((kw) => text.includes(kw));
}

export function getISOWeek(date: Date): { weekYear: number; weekNumber: number } {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNumber =
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    );
  return { weekYear: d.getFullYear(), weekNumber };
}

export async function collectRSSFeeds(): Promise<void> {
  const sources = await db
    .select()
    .from(newsSourcesTable)
    .where(eq(newsSourcesTable.isActive, true));

  logger.info({ count: sources.length }, "Starting RSS collection");

  for (const source of sources) {
    try {
      const feed = await parser.parseURL(source.url);

      let fetched = 0;
      let skipped = 0;

      for (const item of feed.items) {
        const title = item.title?.trim() ?? "";
        const url = item.link?.trim() ?? "";
        if (!title || !url) continue;

        const content = item.contentSnippet ?? item.content ?? item.summary ?? "";
        const snippet = content.slice(0, 200);

        const turkeyRelated = source.language === "tr" || isTurkeyRelated(title, snippet);

        const publishedAt = item.pubDate ? new Date(item.pubDate) : new Date();
        const { weekYear, weekNumber } = getISOWeek(publishedAt);

        try {
          await db
            .insert(newsItemsTable)
            .values({
              sourceId: source.id,
              title,
              url,
              summary: content.slice(0, 1000) || null,
              content: content || null,
              publishedAt,
              isTurkeyRelated: turkeyRelated,
              weekYear,
              weekNumber,
            })
            .onConflictDoNothing({ target: newsItemsTable.url });
          fetched++;
        } catch {
          skipped++;
        }
      }

      await db
        .update(newsSourcesTable)
        .set({ lastFetchedAt: new Date(), updatedAt: new Date() })
        .where(eq(newsSourcesTable.id, source.id));

      logger.info({ source: source.name, fetched, skipped }, "RSS feed collected");
    } catch (err) {
      logger.error({ err, source: source.name, url: source.url }, "RSS feed fetch failed");
    }
  }
}

export async function seedDefaultSources(): Promise<void> {
  const [{ cnt }] = await db
    .select({ cnt: sql<number>`count(*)::int` })
    .from(newsSourcesTable);
  if (cnt > 0) return;

  const defaults = [
    { name: "BTK Haberler", url: "https://www.btk.gov.tr/haberler/rss", language: "tr" },
    { name: "USOM TR-CERT", url: "https://www.usom.gov.tr/rss/duyuru.rss", language: "tr" },
    { name: "BilgiGuvenligi.org", url: "https://bilgiguvenligi.org/feed/", language: "tr" },
    { name: "BleepingComputer Security", url: "https://www.bleepingcomputer.com/feed/", language: "en" },
    { name: "The Hacker News", url: "https://feeds.feedburner.com/TheHackersNews", language: "en" },
    { name: "Krebs on Security", url: "https://krebsonsecurity.com/feed/", language: "en" },
    { name: "Dark Reading", url: "https://www.darkreading.com/rss/all.xml", language: "en" },
    { name: "SecurityWeek", url: "https://feeds.feedburner.com/securityweek", language: "en" },
    { name: "Threatpost", url: "https://threatpost.com/feed/", language: "en" },
    { name: "CISA Alerts", url: "https://www.cisa.gov/uscert/ncas/alerts.xml", language: "en" },
  ];

  await db.insert(newsSourcesTable).values(defaults).onConflictDoNothing();
  logger.info("Default RSS sources seeded");
}
