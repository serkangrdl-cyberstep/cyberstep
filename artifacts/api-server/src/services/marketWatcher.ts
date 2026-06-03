/**
 * Rekabet ve Pazar İzleme
 *
 * Her 4 saatte bir RSS feed'leri kontrol eder.
 * Her Cuma 09:00'da Claude ile haftalık özet emaili gönderir.
 */

import { db } from "@workspace/db";
import { marketWatchItemsTable } from "@workspace/db";
import { isNull, gte, and } from "drizzle-orm";
import { sendMail } from "./email";
import { getClaudeAiFn } from "./ai-client";
import { logger } from "../lib/logger";

// ─── RSS kaynakları ────────────────────────────────────────────────────────────

const MARKET_FEEDS = [
  { url: "https://bthaber.com/feed/",                           label: "BThaber",         type: "tr_news" },
  { url: "https://webrazzi.com/feed/",                          label: "Webrazzi",         type: "tr_news" },
  { url: "https://feeds.feedburner.com/TheHackersNews",         label: "HackerNews",       type: "security" },
  { url: "https://www.bleepingcomputer.com/feed/",              label: "BleepingComputer", type: "security" },
  { url: "https://echocti.com/feed/",                           label: "EchoCTI",          type: "competitor" },
];

const RELEVANT_KEYWORDS = [
  "türkiye", "kvkk", "btk", "usom", "echocti",
  "siber güvenlik", "fortinet", "fidye yazılımı", "veri ihlali",
  "cybersecurity", "ransomware", "data breach", "vulnerability",
];

function isRelevant(text: string): boolean {
  const lower = text.toLowerCase();
  return RELEVANT_KEYWORDS.some(k => lower.includes(k));
}

// ─── Feed parser (yerleşik XML ayrıştırma) ─────────────────────────────────────

interface FeedItem {
  title: string;
  url: string;
  summary: string;
  publishedAt: Date | null;
}

async function parseFeed(feedUrl: string): Promise<FeedItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(feedUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "CyberStep-MarketWatcher/1.0" },
    });
    clearTimeout(timer);

    if (!res.ok) return [];
    const xml = await res.text();

    const items: FeedItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1] ?? "";
      const title = (/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/.exec(block)?.[1] ?? "").trim();
      const link  = (/<link>([\s\S]*?)<\/link>/.exec(block)?.[1] ?? "").trim();
      const desc  = (/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description>([\s\S]*?)<\/description>/.exec(block)?.[1] ?? "").replace(/<[^>]+>/g, "").slice(0, 300).trim();
      const pubRaw = (/<pubDate>([\s\S]*?)<\/pubDate>/.exec(block)?.[1] ?? "").trim();
      const pubAt  = pubRaw ? new Date(pubRaw) : null;

      if (title && link) items.push({ title, url: link, summary: desc, publishedAt: pubAt });
    }

    return items;
  } catch {
    clearTimeout(timer);
    return [];
  }
}

// ─── Ana toplayıcı ─────────────────────────────────────────────────────────────

export async function runMarketWatcher(): Promise<number> {
  const seenSet = new Set<string>();
  const existing = await db.select({ url: marketWatchItemsTable.url }).from(marketWatchItemsTable);
  existing.forEach(r => seenSet.add(r.url));

  const newItems: Array<FeedItem & { source: string; feedType: string }> = [];

  for (const feed of MARKET_FEEDS) {
    try {
      const items = await parseFeed(feed.url);
      for (const item of items) {
        if (seenSet.has(item.url)) continue;
        if (!isRelevant(item.title + " " + item.summary)) continue;
        newItems.push({ ...item, source: feed.label, feedType: feed.type });
        seenSet.add(item.url);
      }
    } catch (err) {
      logger.warn({ err, feed: feed.url }, "Market feed parse failed");
    }
  }

  if (newItems.length === 0) return 0;

  await db.insert(marketWatchItemsTable).values(
    newItems.map(item => ({
      title: item.title,
      url: item.url,
      source: item.source,
      itemType: item.feedType,
      summary: item.summary,
      publishedAt: item.publishedAt,
    }))
  ).onConflictDoNothing();

  logger.info({ count: newItems.length }, "Market watcher: new items saved");
  return newItems.length;
}

// ─── Haftalık özet emaili (Her Cuma 09:00) ────────────────────────────────────

export async function sendWeeklyMarketSummary(): Promise<void> {
  const since = new Date(Date.now() - 7 * 86_400_000);
  const weekItems = await db.select()
    .from(marketWatchItemsTable)
    .where(
      and(
        gte(marketWatchItemsTable.createdAt, since),
        isNull(marketWatchItemsTable.weekSummarySentAt),
      )
    );

  if (weekItems.length === 0) {
    logger.info("Market watcher: no new items for weekly summary");
    return;
  }

  const ai = getClaudeAiFn("claude-haiku-4-5");

  const prompt = `Bu hafta Türkiye siber güvenlik piyasasında şu gelişmeler oldu:

${weekItems.map(i => `- ${i.source}: ${i.title}`).join("\n")}

Önemli gelişmeleri 5 maddede özetle.
CyberStep.io'yu etkileyen varsa belirt.
Rakip EchoCTI ile ilgili varsa özellikle vurgula.
Türkçe, kısa, madde madde.`;

  const summary = await ai(prompt).catch(err => {
    logger.warn({ err }, "Market watcher Claude summary failed");
    return weekItems.map(i => `• ${i.source}: ${i.title}`).join("\n");
  });

  const adminEmail = process.env["SMTP_USER"];
  if (!adminEmail) {
    logger.warn("Market watcher: no SMTP_USER, skipping weekly email");
    return;
  }

  const itemsHtml = weekItems.map(i =>
    `<li><strong>${i.source}</strong>: <a href="${i.url}">${i.title}</a></li>`
  ).join("");

  await sendMail({
    to: adminEmail,
    subject: `Haftalık Pazar Özeti — ${new Date().toLocaleDateString("tr-TR")}`,
    html: `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:700px;margin:0 auto;padding:20px">
<h2>Haftalık Pazar Özeti</h2>
<div style="background:#f0fdf4;border-left:4px solid #10b981;padding:16px;margin-bottom:24px">
${summary.replace(/\n/g, "<br>")}
</div>
<h3>Bu Haftanın Haberleri (${weekItems.length} başlık)</h3>
<ul>${itemsHtml}</ul>
<hr><p style="font-size:12px;color:#888">CyberStep.io — Market Intelligence</p>
</body></html>`,
  });

  await db.update(marketWatchItemsTable)
    .set({ weekSummarySentAt: new Date() })
    .where(gte(marketWatchItemsTable.createdAt, since));

  logger.info({ itemCount: weekItems.length }, "Market watcher: weekly summary sent");
}
