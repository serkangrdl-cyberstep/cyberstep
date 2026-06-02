import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../../lib/logger";

const MODEL = "claude-sonnet-4-6";
const BATCH_SIZE = 15;
const CVE_RE = /CVE-\d{4}-\d{4,7}/gi;

interface RawItem { id: number; title: string; summary: string | null }

interface EnrichedResult {
  id: number;
  aiSummary: string;
  cveIds: string[];
  category: string;
  relevanceScore: number;
}

export const NEWS_CATEGORIES = [
  "cve_vulnerability",
  "threat_intel",
  "data_breach",
  "regulation_kvkk",
  "vendor_security",
  "turkey_news",
  "sector_news",
  "general",
] as const;

export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

async function enrichBatch(items: RawItem[]): Promise<EnrichedResult[]> {
  if (items.length === 0) return [];

  const itemsText = items
    .map((it, i) =>
      `[${i + 1}] ID:${it.id}\nBAŞLIK: ${it.title}\nİÇERİK: ${(it.summary ?? "").slice(0, 400)}`
    )
    .join("\n\n---\n\n");

  const systemPrompt = `Sen CyberStep.io'nun siber güvenlik haber analistisisin.
Türk KOBİ CISO'ları ve IT direktörleri için haberleri analiz et.
Yanıtın kesinlikle geçerli JSON dizisi olmalı — başka hiçbir şey yazma.`;

  const userPrompt = `Şu ${items.length} haberi analiz et:

${itemsText}

Her haber için:
- id: orijinal ID (değiştirme)
- summary: 1-2 cümle Türkçe özet (iş riski odaklı, teknik jargon yok)
- cve_ids: metinde geçen CVE ID'leri dizisi (CVE-YYYY-NNNNN formatında, yoksa [])
- category: "cve_vulnerability" | "threat_intel" | "data_breach" | "regulation_kvkk" | "vendor_security" | "turkey_news" | "sector_news" | "general"
- relevance: 1-10 Türk KOBİ için önem (10=acil/kritik, 7+=bültene alınır, 1=alakasız)

Yanıt formatı: [{"id":X,"summary":"...","cve_ids":[],"category":"...","relevance":N},...]`;

  try {
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 3000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const rawText = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "[]";
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      logger.warn({ rawText: rawText.slice(0, 200) }, "newsEnricher: Claude JSON parse edilemedi");
      return [];
    }
    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      id: number;
      summary: string;
      cve_ids: string[];
      category: string;
      relevance: number;
    }>;
    return parsed.map((p) => {
      const cveFromText = ((p.summary ?? "") + " " + (p.cve_ids ?? []).join(" "))
        .match(CVE_RE) ?? [];
      const uniqueCves = [...new Set([
        ...(p.cve_ids ?? []).filter((c) => /CVE-\d{4}-\d{4,7}/.test(c)),
        ...cveFromText,
      ])];
      return {
        id: p.id,
        aiSummary: (p.summary ?? "").slice(0, 500),
        cveIds: uniqueCves,
        category: NEWS_CATEGORIES.includes(p.category as NewsCategory) ? p.category : "general",
        relevanceScore: Math.min(10, Math.max(1, Math.round(p.relevance ?? 5))),
      };
    });
  } catch (err) {
    logger.warn({ err }, "newsEnricher: Claude batch enrichment başarısız");
    return [];
  }
}

export async function ensureNewsItemColumns(): Promise<void> {
  try {
    await db.execute(sql`
      ALTER TABLE news_items
        ADD COLUMN IF NOT EXISTS ai_summary TEXT,
        ADD COLUMN IF NOT EXISTS cve_ids TEXT[] DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS category VARCHAR(50),
        ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMP
    `);
    logger.info("newsEnricher: news_items kolonları hazır");
  } catch (err) {
    logger.warn({ err }, "newsEnricher: ALTER TABLE uyarısı (genellikle zararsız)");
  }
}

export async function enrichNewsItems(): Promise<void> {
  const cutoff = new Date(Date.now() - 14 * 24 * 3600 * 1000);

  const rows = await db.execute<{ id: number; title: string; summary: string | null }>(
    sql`
      SELECT id, title, summary
      FROM news_items
      WHERE enriched_at IS NULL
        AND published_at >= ${cutoff}
      ORDER BY published_at DESC
      LIMIT 60
    `
  );

  const items: RawItem[] = (rows.rows ?? []) as RawItem[];

  if (items.length === 0) {
    logger.info("newsEnricher: Zenginleştirilecek yeni haber yok");
    return;
  }

  logger.info({ count: items.length }, "newsEnricher: Haberler Claude ile zenginleştiriliyor");

  let totalEnriched = 0;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const results = await enrichBatch(batch);

    for (const e of results) {
      await db.execute(sql`
        UPDATE news_items SET
          ai_summary   = ${e.aiSummary},
          cve_ids      = ${sql.raw(`ARRAY[${e.cveIds.map((c) => `'${c.replace(/'/g, "''")}'`).join(",") || ""}]::text[]`)},
          category     = ${e.category},
          relevance_score = ${e.relevanceScore.toString()},
          is_included  = ${e.relevanceScore >= 7},
          enriched_at  = NOW()
        WHERE id = ${e.id}
      `);
    }

    totalEnriched += results.length;
    logger.info(
      { batchIndex: i / BATCH_SIZE + 1, batchEnriched: results.length },
      "newsEnricher: Batch tamamlandı"
    );

    if (i + BATCH_SIZE < items.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  logger.info({ totalEnriched }, "newsEnricher: Zenginleştirme tamamlandı");
}

export interface TopNewsItem {
  id: number;
  title: string;
  url: string;
  aiSummary: string | null;
  category: string | null;
  relevanceScore: number;
  sourceName: string | null;
  cveIds: string[];
  publishedAt: Date | null;
}

export async function getTopNewsItems(
  weekStart: Date,
  weekEnd: Date,
  limit = 5
): Promise<TopNewsItem[]> {
  const rows = await db.execute<{
    id: number;
    title: string;
    url: string;
    ai_summary: string | null;
    category: string | null;
    relevance_score: string | null;
    source_name: string | null;
    cve_ids: string[] | null;
    published_at: Date | null;
  }>(sql`
    SELECT
      ni.id,
      ni.title,
      ni.url,
      ni.ai_summary,
      ni.category,
      ni.relevance_score,
      ns.name AS source_name,
      ni.cve_ids,
      ni.published_at
    FROM news_items ni
    LEFT JOIN news_sources ns ON ns.id = ni.source_id
    WHERE ni.is_included = true
      AND ni.enriched_at IS NOT NULL
      AND ni.published_at >= ${weekStart}
      AND ni.published_at <= ${weekEnd}
    ORDER BY ni.relevance_score DESC, ni.published_at DESC
    LIMIT ${limit}
  `);

  return ((rows.rows ?? []) as typeof rows.rows).map((r) => ({
    id: r.id,
    title: r.title,
    url: r.url,
    aiSummary: r.ai_summary,
    category: r.category,
    relevanceScore: Number(r.relevance_score ?? 0),
    sourceName: r.source_name,
    cveIds: Array.isArray(r.cve_ids) ? r.cve_ids : [],
    publishedAt: r.published_at,
  }));
}
