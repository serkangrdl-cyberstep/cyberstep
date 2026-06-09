import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db } from "@workspace/db";
import { newsItemsTable, weeklyDigestsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { getISOWeek } from "./rss-collector";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 8192;

async function callClaude(systemPrompt: string, userPrompt: string): Promise<string> {
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  const block = msg.content[0];
  if (block?.type === "text") return block.text;
  return "";
}

async function scoreNewsItems(
  items: Array<{ id: number; title: string; summary: string | null }>
): Promise<void> {
  if (items.length === 0) return;

  const itemsText = items
    .map((it, i) => `${i + 1}. [ID:${it.id}] ${it.title}\n${it.summary?.slice(0, 300) ?? ""}`)
    .join("\n\n");

  const system = `Sen bir Türk siber güvenlik uzmanısın. Haber başlıklarını ve özetlerini analiz ederek 
Türk işletmeler için önem skorunu 1-10 arasında değerlendiriyorsun.
Yanıtını kesinlikle şu formatta ver (her satırda bir haber):
ID:SAYI SKOR:SAYI
Örnek: ID:42 SKOR:8`;

  const user = `Aşağıdaki ${items.length} haberi Türk işletmeler için önem açısından değerlendir:

${itemsText}

Her haber için ID ve SKOR satırı döndür.`;

  const response = await callClaude(system, user);

  const lines = response.split("\n").filter((l) => l.includes("ID:") && l.includes("SKOR:"));
  for (const line of lines) {
    const idMatch = line.match(/ID:(\d+)/);
    const scoreMatch = line.match(/SKOR:(\d+)/);
    if (!idMatch || !scoreMatch) continue;
    const id = parseInt(idMatch[1]!, 10);
    const score = Math.min(10, Math.max(1, parseInt(scoreMatch[1]!, 10)));
    await db
      .update(newsItemsTable)
      .set({ relevanceScore: score.toString() })
      .where(eq(newsItemsTable.id, id));
  }
}

export async function generateWeeklyDigest(
  weekYear?: number,
  weekNumber?: number
): Promise<number> {
  const now = new Date();
  const week = weekYear && weekNumber ? { weekYear, weekNumber } : getISOWeek(now);

  const items = await db
    .select()
    .from(newsItemsTable)
    .where(
      and(
        eq(newsItemsTable.weekYear, week.weekYear),
        eq(newsItemsTable.weekNumber, week.weekNumber)
      )
    )
    .orderBy(desc(newsItemsTable.publishedAt))
    .limit(50);

  if (items.length === 0) {
    logger.warn({ week }, "No news items found for digest generation");
  }

  const unscored = items.filter((it) => it.relevanceScore === null);
  if (unscored.length > 0) {
    await scoreNewsItems(
      unscored.map((it) => ({ id: it.id, title: it.title, summary: it.summary }))
    );
  }

  const scored = await db
    .select()
    .from(newsItemsTable)
    .where(
      and(
        eq(newsItemsTable.weekYear, week.weekYear),
        eq(newsItemsTable.weekNumber, week.weekNumber)
      )
    )
    .orderBy(desc(newsItemsTable.relevanceScore), desc(newsItemsTable.publishedAt))
    .limit(20);

  const top = scored.slice(0, 10);
  const newsContext = top
    .map(
      (it, i) =>
        `${i + 1}. ${it.title}\n   Kaynak: ${it.url}\n   Özet: ${it.summary?.slice(0, 400) ?? "-"}`
    )
    .join("\n\n");

  const weekLabel = `${week.weekYear} Yılı ${week.weekNumber}. Hafta`;

  const systemBase = `Sen CyberStep.io için çalışan bir Türk siber güvenlik içerik uzmanısın.
Hedef kitle: Türkiye'deki işletme sahipleri ve IT sorumluları.
Dil: Türkçe. Ton: Profesyonel ama anlaşılır. Teknik jargondan kaçın.
Emoji kullanma.`;

  const [summary, linkedin, twitter, instagram, story] = await Promise.all([
    callClaude(
      systemBase,
      `${weekLabel} için siber güvenlik haftalık özeti yaz. Maksimum 600 kelime. 
Öne çıkan olayları, Türkiye'ye etkisini ve işletme önerilerini içermeli.
Haber listesi:
${newsContext}`
    ),

    callClaude(
      systemBase + "\nLinkedIn paylaşımı yazıyorsun. Maksimum 3000 karakter.",
      `${weekLabel} siber güvenlik özetini LinkedIn için yaz.
Başlık, 3-5 madde öne çıkan olay, işletmelere 2-3 öneri, kapanış CTA.
Haber listesi:
${newsContext}`
    ),

    callClaude(
      systemBase + "\nTwitter/X thread yazıyorsun. Her tweet maksimum 280 karakter. 5-8 tweet.",
      `${weekLabel} siber güvenlik özetini Twitter thread olarak yaz.
Format: Her tweeti '1/' '2/' gibi numaralandır. Son tweet CyberStep.io mention içersin.
Haber listesi:
${newsContext}`
    ),

    callClaude(
      systemBase + "\nInstagram caption yazıyorsun. Maksimum 2200 karakter.",
      `${weekLabel} siber güvenlik özetini Instagram gönderisi için yaz.
Dikkat çekici açılış, 3-4 madde, hashtag'ler (#SiberGüvenlik #işletme #CyberStep #Türkiye).
Haber listesi:
${newsContext}`
    ),

    callClaude(
      systemBase + "\nInstagram/TikTok Story slaytları için metin yazıyorsun. 5-7 slayt.",
      `${weekLabel} için Instagram Story slayt metinleri yaz.
Her slaytı '=== SLAYT N ===' ile ayır. Kısa, impactful cümleler. Görsel açıklama ekle.
Haber listesi:
${newsContext}`
    ),
  ]);

  const [existing] = await db
    .select()
    .from(weeklyDigestsTable)
    .where(
      and(
        eq(weeklyDigestsTable.weekYear, week.weekYear),
        eq(weeklyDigestsTable.weekNumber, week.weekNumber)
      )
    )
    .limit(1);

  let digestId: number;

  if (existing) {
    await db
      .update(weeklyDigestsTable)
      .set({
        contentSummary: summary,
        contentLinkedin: linkedin,
        contentTwitter: twitter,
        contentInstagram: instagram,
        contentStory: story,
        status: "draft",
        updatedAt: new Date(),
      })
      .where(eq(weeklyDigestsTable.id, existing.id));
    digestId = existing.id;
  } else {
    const [inserted] = await db
      .insert(weeklyDigestsTable)
      .values({
        weekYear: week.weekYear,
        weekNumber: week.weekNumber,
        status: "draft",
        contentSummary: summary,
        contentLinkedin: linkedin,
        contentTwitter: twitter,
        contentInstagram: instagram,
        contentStory: story,
      })
      .returning({ id: weeklyDigestsTable.id });
    digestId = inserted!.id;
  }

  await db
    .update(newsItemsTable)
    .set({ isIncluded: true })
    .where(
      and(
        eq(newsItemsTable.weekYear, week.weekYear),
        eq(newsItemsTable.weekNumber, week.weekNumber),
        eq(newsItemsTable.isTurkeyRelated, true)
      )
    );

  logger.info({ digestId, week, itemCount: top.length }, "Weekly digest generated");
  return digestId;
}
