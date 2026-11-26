import { buildCoverSvg, isTprmTitle } from "./blogCoverSvg";
import { db, blogPostsTable } from "@workspace/db";
import { eq, and, isNull, isNotNull, ne } from "drizzle-orm";

export { isTprmTitle } from "./blogCoverSvg";

/** Başlık yazılı SVG kapak üretir (yapay zeka görseli kullanılmaz; koyu degrade arka plan + başlık + logo). */
export async function generateBlogCoverDataUrl(opts: {
  title: string; excerpt: string | null; tprm: boolean;
}): Promise<{ dataUrl: string }> {
  const svg = buildCoverSvg({
    title: opts.title,
    label: opts.tprm ? "Tedarikçi risk yönetimi" : undefined,
  });
  return { dataUrl: `data:image/svg+xml;base64,${Buffer.from(svg, "utf-8").toString("base64")}` };
}

/** İngilizce başlıklı kapak (titleEn). TPRM etiketi İngilizce yazılır. */
export function generateBlogCoverEnDataUrl(opts: { titleEn: string; tprm: boolean }): { dataUrl: string } {
  const svg = buildCoverSvg({ title: opts.titleEn, label: opts.tprm ? "Third-party risk management" : undefined, lang: "en" });
  return { dataUrl: `data:image/svg+xml;base64,${Buffer.from(svg, "utf-8").toString("base64")}` };
}

/** Tek yazının İngilizce kapağını (titleEn varsa) üretir ve kaydeder. */
export async function refreshEnglishCover(postId: number): Promise<boolean> {
  const [p] = await db.select({ title: blogPostsTable.title, titleEn: blogPostsTable.titleEn }).from(blogPostsTable).where(eq(blogPostsTable.id, postId));
  if (!p?.titleEn) return false;
  const c = generateBlogCoverEnDataUrl({ titleEn: p.titleEn, tprm: isTprmTitle(p.title) });
  await db.update(blogPostsTable).set({ coverImageEnBase64: c.dataUrl }).where(eq(blogPostsTable.id, postId));
  return true;
}

/** İngilizce başlığı olup İngilizce kapağı olmayan tüm yazılara kapak üretir (yapay zeka kullanmaz). */
export async function backfillEnglishCovers(): Promise<number> {
  const rows = await db.select({ id: blogPostsTable.id }).from(blogPostsTable)
    .where(and(isNotNull(blogPostsTable.titleEn), ne(blogPostsTable.titleEn, ""), isNull(blogPostsTable.coverImageEnBase64)));
  let n = 0;
  for (const r of rows) if (await refreshEnglishCover(r.id)) n++;
  return n;
}
