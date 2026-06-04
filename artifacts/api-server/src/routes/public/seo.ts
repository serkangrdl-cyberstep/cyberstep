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

    const staticPages: SitemapEntry[] = [
      { url: "/",              priority: "1.0", changefreq: "weekly"  },
      { url: "/tarama",        priority: "0.9", changefreq: "weekly"  },
      { url: "/degerlendirme", priority: "0.9", changefreq: "monthly" },
      { url: "/fiyatlandirma", priority: "0.8", changefreq: "monthly" },
      { url: "/hakkimizda",    priority: "0.6", changefreq: "monthly" },
      { url: "/blog",          priority: "0.8", changefreq: "daily"   },
      { url: "/iletisim",      priority: "0.5", changefreq: "yearly"  },
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
