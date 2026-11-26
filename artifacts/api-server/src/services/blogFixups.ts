import { db, blogPostsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { fixVeriIsleyenPost } from "./blogFixupText";

const REFS = [
  { title: "KVKK kamuoyu duyurusu: D-Market Elektronik Hizmetler ve Ticaret A.Ş. (4 Kasım 2026)", url: "https://www.kvkk.gov.tr/Icerik/9080/kamuoyu-duyurusu-veri-ihlali-bildirimi-d-market-elektronik-hizmetler-ve-ticaret-a-s" },
  { title: "KVKK kamuoyu duyurusu: KVK Teknik Servis Hiz. ve Tic. A.Ş. (4 Kasım 2026)", url: "https://www.kvkk.gov.tr/Icerik/9081/kamuoyu-duyurusu-veri-ihlali-bildirimi-kvk-teknik-servis-hiz-ve-tic-a-s" },
  { title: "CNBC-e: KVKK'dan 'Vodafone Net' için veri ihlali duyurusu", url: "https://www.cnbce.com/teknoloji/kvkkdan-vodafone-net-icin-veri-ihlali-duyurusu-320-bin-kisi-etkilenmis-olabilir-h24391" },
];

/** Tek seferlik (işaret anahtarlı): 26 Kasım 2026 yazısını düzeltir ve kaynaklarını ekler. */
export async function runBlogFixups(): Promise<void> {
  const done = await db.execute(sql`SELECT 1 FROM site_settings WHERE key = 'blog_fix_veri_isleyen_v1'`);
  if ((done as unknown as { rows?: unknown[] }).rows?.length) return;
  const [p] = await db.select().from(blogPostsTable).where(eq(blogPostsTable.slug, "kvkkda-veri-isleyen-tedarikci-sorumluluk-kimde"));
  if (!p) return;
  const f = fixVeriIsleyenPost(p.content, p.contentEn ?? "");
  await db.update(blogPostsTable).set({ content: f.tr, contentEn: p.contentEn ? f.en : p.contentEn, refsJson: p.refsJson?.length ? p.refsJson : REFS, updatedAt: new Date() }).where(eq(blogPostsTable.id, p.id));
  await db.execute(sql`INSERT INTO site_settings (key, value, updated_at) VALUES ('blog_fix_veri_isleyen_v1', '1', NOW()) ON CONFLICT (key) DO NOTHING`);
  logger.info({ postId: p.id }, "Blog düzeltmesi uygulandı: veri işleyen yazısı");
}
