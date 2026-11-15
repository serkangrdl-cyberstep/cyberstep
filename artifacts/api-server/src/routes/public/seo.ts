import { Router } from "express";
import { db } from "@workspace/db";
import { blogPostsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { logger } from "../../lib/logger";

const router = Router();

const BASE_URL = process.env["SITE_BASE_URL"] ?? "https://cyberstep.io";

router.get("/robots.txt", (_req, res) => {
  res.type("text/plain").send(
    `User-agent: *
Allow: /
Disallow: /admin
Disallow: /panel
Disallow: /api/

Sitemap: ${BASE_URL}/sitemap.xml`
  );
});

router.get("/sitemap.xml", async (_req, res) => {
  try {
    const posts = await db
      .select({ slug: blogPostsTable.slug, publishedAt: blogPostsTable.publishedAt })
      .from(blogPostsTable)
      .where(eq(blogPostsTable.status, "published"))
      .orderBy(desc(blogPostsTable.publishedAt))
      .limit(200);

    type SitemapEntry = { url: string; priority: string; changefreq: string; lastmod?: string };

    // TPRM odaklı yeniden yapılanma (Kasım 2026): arşivlenen sayfalar (AI güvenlik,
    // pentest, servis kataloğu vb.) sitemap'ten çıkarıldı; bkz. cyberstep/src/lib/archived-routes.ts
    const staticPages: SitemapEntry[] = [
      { url: "/",                          priority: "1.0", changefreq: "weekly"  },
      // Tedarikçi riski (ana ürün)
      { url: "/tedarik-zinciri",           priority: "0.9", changefreq: "monthly" },
      { url: "/skor-api",                  priority: "0.8", changefreq: "monthly" },
      { url: "/sektor-raporu",             priority: "0.8", changefreq: "weekly"  },
      { url: "/guven-rozeti",              priority: "0.7", changefreq: "monthly" },
      { url: "/tedarikci-onboarding",      priority: "0.7", changefreq: "monthly" },
      { url: "/metodoloji",                priority: "0.7", changefreq: "monthly" },
      // Çözümler
      { url: "/dora-bddk-uyum",            priority: "0.8", changefreq: "monthly" },
      { url: "/siber-sigorta",             priority: "0.8", changefreq: "monthly" },
      { url: "/kurumsal",                  priority: "0.7", changefreq: "monthly" },
      { url: "/fiyatlar",                  priority: "0.8", changefreq: "monthly" },
      // Ücretsiz araçlar ve değerlendirme
      { url: "/domain-tarama",             priority: "0.9", changefreq: "monthly" },
      { url: "/assessment/start",          priority: "0.7", changefreq: "monthly" },
      { url: "/araclar",                   priority: "0.8", changefreq: "monthly" },
      { url: "/araclar/domain-guvenlik-taramasi", priority: "0.8", changefreq: "monthly" },
      { url: "/araclar/ssl-kontrol",              priority: "0.7", changefreq: "monthly" },
      { url: "/araclar/dmarc-kontrol",            priority: "0.7", changefreq: "monthly" },
      { url: "/araclar/kvkk-ceza-hesaplayici",    priority: "0.7", changefreq: "monthly" },
      { url: "/araclar/dark-web-sorgulama",       priority: "0.7", changefreq: "monthly" },
      { url: "/araclar/siber-risk-roi",           priority: "0.6", changefreq: "monthly" },
      { url: "/kvkk-ceza-sim",             priority: "0.6", changefreq: "monthly" },
      { url: "/sektorel-kiyaslama",        priority: "0.6", changefreq: "monthly" },
      // Kurumsal ve içerik
      { url: "/hakkimizda",                priority: "0.6", changefreq: "monthly" },
      { url: "/iletisim",                  priority: "0.5", changefreq: "yearly"  },
      { url: "/blog",                      priority: "0.8", changefreq: "daily"   },
      { url: "/bulten/arsiv",              priority: "0.5", changefreq: "weekly"  },
    ];

    const blogUrls: SitemapEntry[] = posts.map(p => ({
      url: `/blog/${p.slug}`,
      priority: "0.7",
      changefreq: "monthly",
      lastmod: p.publishedAt ? new Date(p.publishedAt).toISOString().slice(0, 10) : undefined,
    }));

    const allUrls: SitemapEntry[] = [...staticPages, ...blogUrls];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(u => `  <url>
    <loc>${BASE_URL}${u.url}</loc>
    ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join("\n")}
</urlset>`;

    res.type("application/xml").send(xml);
  } catch (err) {
    logger.error({ err }, "Sitemap generation failed");
    res.status(500).send("Sitemap üretilemedi");
  }
});

export default router;
