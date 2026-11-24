import { anthropic } from "@workspace/integrations-anthropic-ai";
import { getModel } from "@workspace/ai";
import { db, blogPostsTable } from "@workspace/db";
import { eq, and, or, isNull, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { logAiCost } from "./aiCostTracker";
import { buildTranslatePrompt, parseTranslation, sameLinks } from "./blogTranslateParse";

const MODEL = getModel("blog");

/** Bir yazının İngilizce çevirisini üretip kaydeder. Başarısızlıkta yazıya dokunmaz (Türkçe yayın etkilenmez). */
export async function translatePostToEnglish(postId: number): Promise<boolean> {
  const [post] = await db.select().from(blogPostsTable).where(eq(blogPostsTable.id, postId));
  if (!post) return false;
  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 16000,
      messages: [{ role: "user", content: buildTranslatePrompt({ title: post.title, excerpt: post.excerpt, content: post.content, seoTitle: post.seoTitle, metaDescription: post.metaDescription, focusKeyword: post.focusKeyword }) }],
    });
    logAiCost({ service: "blog_autopilot", model: MODEL, inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens, metadata: { postId, step: "translate-en" } }).catch(() => {});
    const block = message.content[0];
    const parsed = parseTranslation(block?.type === "text" ? block.text : "");
    if (!parsed) { logger.warn({ postId }, "Blog çeviri: çıktı kullanılamadı"); return false; }
    if (!sameLinks(post.content, parsed.contentEn)) { logger.warn({ postId }, "Blog çeviri: bağlantılar değişmiş, kaydedilmedi"); return false; }
    await db.update(blogPostsTable).set({
      titleEn: parsed.titleEn, excerptEn: parsed.excerptEn, contentEn: parsed.contentEn,
      seoTitleEn: parsed.seoTitleEn, metaDescriptionEn: parsed.metaDescriptionEn, focusKeywordEn: parsed.focusKeywordEn,
    }).where(eq(blogPostsTable.id, postId));
    logger.info({ postId }, "Blog çeviri: İngilizce kaydedildi");
    return true;
  } catch (err) {
    logger.warn({ err: String(err).slice(0, 300), postId }, "Blog çeviri başarısız");
    return false;
  }
}

/** İngilizcesi olmayan yazıları (yayında ve taslak) sırayla çevirir. */
export async function translateMissingPosts(limit = 5): Promise<{ done: number; failed: number; remaining: number }> {
  const missing = await db.select({ id: blogPostsTable.id }).from(blogPostsTable)
    .where(or(isNull(blogPostsTable.contentEn), eq(blogPostsTable.contentEn, "")))
    .orderBy(sql`${blogPostsTable.id} DESC`);
  let done = 0, failed = 0;
  for (const m of missing.slice(0, limit)) (await translatePostToEnglish(m.id)) ? done++ : failed++;
  return { done, failed, remaining: Math.max(0, missing.length - done) };
}
