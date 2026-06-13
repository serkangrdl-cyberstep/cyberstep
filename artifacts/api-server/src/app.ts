import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import router from "./routes";
import adminPanelRouter from "./routes/admin-panel/index";
import basLiteRouter from "./routes/bas-lite/index";
import exposureScoreRouter from "./routes/admin-panel/exposure-score";
import cvePublicRouter from "./routes/cve-public";
import bulletinPublicRouter from "./routes/bulletin-public";
import bulletinAdminRouter from "./routes/admin-panel/bulletin";
import dailyDashboardRouter from "./routes/admin-panel/daily-dashboard";
import portalSubscriptionRouter from "./routes/portal/subscription";
import portalAccountRouter from "./routes/portal/account";
import portalIocRouter from "./routes/portal/ioc-query";
import securityOverviewRouter from "./routes/customer/security-overview";
import adminApprovalsRouter from "./routes/admin-panel/approvals";
import monitoringUptimeRouter from "./routes/monitoring/uptime";
import seoRouter from "./routes/public/seo";
import certIngestRouter from "./routes/internal/cert-ingest";
import badgeRouter from "./routes/badge/index";
import emergingThreatsAdminRouter from "./routes/admin-panel/emerging-threats";
import { generateAndPublishBlogPost, generateBlogPostContent, BLOG_PLAN } from "./services/blog-autopilot";
import { createAdminUser } from "./services/auth";
import { logger } from "./lib/logger";
import { db, blogPostsTable, adminUsersTable } from "@workspace/db";
import { sql, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const app: Express = express();

// ─── Trust Replit reverse proxy ──────────────────────────────────────────────
app.set("trust proxy", 1);

// ─── Security headers via Helmet ─────────────────────────────────────────────
// OWASP ASVS 14.4 — HTTP Security Headers; OWASP Top-10 A05 Security Misconfiguration
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        scriptSrc: ["'none'"],
        styleSrc: ["'none'"],
        imgSrc: ["'none'"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        // form-action: prevent form hijacking to external origins (OWASP A01)
        formAction: ["'self'"],
        // base-uri: prevent <base> tag injection attacks (OWASP A03)
        baseUri: ["'self'"],
        workerSrc: ["'none'"],
        manifestSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    hsts: {
      // HSTS preload: 1 year min for preload list submission (hstspreload.org)
      maxAge: 63072000, // 2 years — Chrome preload list requirement
      includeSubDomains: true,
      preload: true,
    },
    frameguard: { action: "deny" },
    noSniff: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    // COEP disabled: Gemini SSE and external API calls need cross-origin fetch
    crossOriginEmbedderPolicy: false,
    // COOP: prevent window.opener leaks across origins (OWASP A05)
    crossOriginOpenerPolicy: { policy: "same-origin" },
    // CORP: block cross-origin resource reads by default (OWASP A05)
    crossOriginResourcePolicy: { policy: "same-origin" },
    // X-Permitted-Cross-Domain-Policies: block Adobe Flash/PDF cross-domain reads
    permittedCrossDomainPolicies: { permittedPolicies: "none" },
  }),
);

// ─── Permissions-Policy — tarayıcı özelliklerini kısıtla ─────────────────────
// OWASP: Gereksiz tarayıcı API'larına erişimi engelle (kamera, mikrofon, konum vb.)
app.use((_req, res, next) => {
  res.setHeader(
    "Permissions-Policy",
    [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "interest-cohort=()",
      "browsing-topics=()",
      "display-capture=()",
      "screen-wake-lock=()",
      "serial=()",
      "ambient-light-sensor=()",
      "accelerometer=()",
      "gyroscope=()",
      "magnetometer=()",
    ].join(", "),
  );
  next();
});

// ─── CORS — restricted allowlist ─────────────────────────────────────────────
const buildAllowedOrigins = (): Set<string> => {
  const origins = new Set<string>();
  // In production, only allow Replit-provisioned domains
  const replitDomains = process.env["REPLIT_DOMAINS"] ?? "";
  for (const d of replitDomains.split(",").map((s) => s.trim()).filter(Boolean)) {
    origins.add(`https://${d}`);
  }
  // Dev: allow localhost variants
  if (process.env["NODE_ENV"] !== "production") {
    origins.add("http://localhost");
    origins.add("http://localhost:80");
    origins.add("http://localhost:3000");
    origins.add("http://localhost:5000");
    origins.add("http://localhost:5173");
  }
  return origins;
};

const allowedOrigins = buildAllowedOrigins();

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow same-origin / server-to-server (no Origin header)
      if (!origin) { callback(null, true); return; }
      if (allowedOrigins.has(origin)) {
        callback(null, true);
      } else {
        // Return false (no CORS headers) — browser will block the cross-origin request
        logger.warn({ origin }, "CORS: blocked origin");
        callback(null, false);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    maxAge: 600,
  }),
);

// ─── Request logging ─────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        // Strip query string and mask ingestion tokens embedded in the path so
        // they never land in logs (e.g. /api/fabric/webhook/<token>).
        const path = (req.url?.split("?")[0] ?? "")
          .replace(/(\/fabric\/(?:webhook|ingest|syslog|verify)\/)[^/]+/, "$1***");
        return { id: req.id, method: req.method, url: path };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// ─── Body parsing + payload limits ───────────────────────────────────────────
// Public Fortinet ingest paths must NEVER hit the global JSON/urlencoded parsers:
// those would 413 (or mis-consume the body) before the route's own raw-text parser,
// breaking the always-200 contract Fortinet devices rely on to avoid retry storms.
// ServiceNow webhook also needs raw body for HMAC-SHA256 signature verification.
const fabricIngestPath = /^\/api\/fabric\/(webhook|syslog)\//;
const snWebhookPath = /^\/api\/integrations\/servicenow\/webhook$/;
const skipJsonParsing = (path: string) => fabricIngestPath.test(path) || snWebhookPath.test(path);
const jsonParser = express.json({ limit: "512kb" });
const largeJsonParser = express.json({ limit: "5mb" });
const urlencodedParser = express.urlencoded({ extended: true, limit: "512kb" });
const needsLargeBody = (req: Request) =>
  (req.method === "PUT" && /^\/api\/admin-panel\/blog\/\d+$/.test(req.path)) ||
  req.path === "/api/gemini/generate-image";
app.use((req: Request, res: Response, next: NextFunction) => {
  if (skipJsonParsing(req.path)) return next();
  if (needsLargeBody(req)) return largeJsonParser(req, res, next);
  return jsonParser(req, res, next);
});
app.use((req, res, next) => (skipJsonParsing(req.path) ? next() : urlencodedParser(req, res, next)));

// ─── Input sanitization middleware ───────────────────────────────────────────
// OWASP A03 Injection / XSS: strip HTML tags + null bytes from all string
// fields in the parsed JSON body before routes process them.
// • SQL Injection: Drizzle ORM uses parameterized queries — this is a defence-
//   in-depth layer on top, not a replacement.
// • XSS: strips <script>, <img onerror=...> and all other HTML/SVG tags that
//   could be stored and later reflected to other users (Stored XSS, OWASP A03).
// • Fortinet raw-text ingest paths are explicitly excluded to preserve the
//   always-200 / no-retry-storm contract.
function stripHtmlTags(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/<[^>]*>/g, "").replace(/\0/g, "").trim();
  }
  if (Array.isArray(value)) return value.map(stripHtmlTags);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = stripHtmlTags(v);
    }
    return out;
  }
  return value;
}

app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === "object" && !skipJsonParsing(req.path)) {
    req.body = stripHtmlTags(req.body) as Record<string, unknown>;
  }
  next();
});

// ─── Rate limiters ───────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Çok fazla istek. Lütfen 15 dakika bekleyin." },
  skipSuccessfulRequests: false,
});

const assessmentCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Saatte en fazla 10 değerlendirme başlatabilirsiniz." },
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Çok fazla istek. Lütfen daha sonra tekrar deneyin." },
  // Public Fortinet ingest/verify endpoints must always return 200; a 429 here
  // would trigger Fortinet device retry storms. They carry a secret token in the
  // path and are gated by token validation in the handler instead.
  skip: (req) => /^\/api\/fabric\/(webhook|syslog|verify)\//.test(req.originalUrl),
});

// Ödeme girişimi: saatte 5 (kart kötüye kullanım koruması)
const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Saatte en fazla 5 ödeme girişimi yapabilirsiniz." },
});

// Domain tarama: saatte 10 — harici API (HIBP, VirusTotal vb.) kötüye kullanım koruması
const domainScanLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Saatte en fazla 10 domain taraması yapabilirsiniz." },
});

// Bülten gönderimi: saatte 3 (e-posta spam koruması)
const newsletterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Bu mesaj için saatte en fazla 3 bülten gönderebilirsiniz." },
});

// Apply limiters
// Auth brute-force protection
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/totp-verify", authLimiter);
app.use("/api/admin-panel/auth/login", authLimiter);
app.use("/api/admin-panel/auth/totp-verify", authLimiter);
// Assessment creation spam protection (POST only)
app.post("/api/assessments", assessmentCreateLimiter);
// Payment abuse protection
app.post("/api/payments/initiate", paymentLimiter);
// Domain scan abuse protection (harici API maliyeti ve kötüye kullanım)
app.post("/api/domain-scan", domainScanLimiter);
// Newsletter spam protection
app.post("/api/admin-panel/special-messages/:id/send-newsletter", newsletterLimiter);
// General API limit
app.use("/api", generalLimiter);
// X-Robots-Tag: arama motorlarının API yanıtlarını dizine eklemesini engelle
app.use("/api", (_req, res, next) => {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  next();
});

// ─── Sessions with PostgreSQL store ──────────────────────────────────────────
const PgStore = connectPgSimple(session);

const sessionSecret = process.env["SESSION_SECRET"];
if (!sessionSecret || sessionSecret.length < 32) {
  logger.error("SESSION_SECRET is missing or too short (need 32+ chars). Refusing to start.");
  process.exit(1);
}

// Ensure sessions table exists (createTableIfMissing breaks with esbuild bundles)
db.execute(sql`
  CREATE TABLE IF NOT EXISTS sessions (
    sid    VARCHAR      NOT NULL PRIMARY KEY,
    sess   JSON         NOT NULL,
    expire TIMESTAMPTZ  NOT NULL
  )
`).then(() =>
  db.execute(sql`CREATE INDEX IF NOT EXISTS sessions_expire_idx ON sessions (expire)`)
).catch((err: unknown) => logger.error({ err }, "Failed to create sessions table"));

export const sessionMiddleware = session({
  store: new PgStore({
    conString: process.env["DATABASE_URL"],
    tableName: "sessions",
    pruneSessionInterval: 3600,
  }),
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  name: "cstep.sid",
  cookie: {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "strict",
    maxAge: 8 * 60 * 60 * 1000,
  },
});

app.use(sessionMiddleware);

// ─── Public SEO routes (no /api prefix — must be before API routes) ───────────
app.use(seoRouter);

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use("/api", router);
app.use("/api", adminPanelRouter);
app.use("/api", cvePublicRouter);
app.use("/api", bulletinPublicRouter);
app.use("/api", bulletinAdminRouter);
app.use("/api", dailyDashboardRouter);
app.use("/api", portalSubscriptionRouter);
app.use("/api", portalAccountRouter);
app.use("/api/portal/ioc", portalIocRouter);
app.use("/api", securityOverviewRouter);
app.use("/api/admin-panel/approvals", adminApprovalsRouter);
app.use("/api", monitoringUptimeRouter);
app.use("/api", basLiteRouter);
app.use("/api", exposureScoreRouter);
app.use("/api", certIngestRouter);
app.use("/api", badgeRouter);
app.use("/api", emergingThreatsAdminRouter);

// ─── Internal: secret-token ile blog yazısı tetikleme (production catch-up) ───
// ENCRYPTION_KEY ile korunur; session auth gerektirmez.
app.post("/api/internal/trigger-blog", async (req: Request, res: Response) => {
  const secret = process.env["ENCRYPTION_KEY"];
  const provided = req.headers["x-internal-secret"] as string | undefined;
  if (!secret || !provided || provided !== secret) {
    res.status(403).json({ error: "Yetkisiz" });
    return;
  }
  logger.info("internal/trigger-blog: blog yazısı üretimi tetiklendi");
  generateAndPublishBlogPost()
    .then(() => logger.info("internal/trigger-blog: tamamlandı"))
    .catch((err: unknown) => logger.error({ err }, "internal/trigger-blog: hata"));
  res.json({ ok: true, message: "Blog yazısı üretimi arka planda başlatıldı" });
});

app.post("/api/internal/fix-blog-placeholders", async (req: Request, res: Response) => {
  const secret = process.env["ENCRYPTION_KEY"];
  const provided = req.headers["x-internal-secret"] as string | undefined;
  if (!secret || !provided || provided !== secret) {
    res.status(403).json({ error: "Yetkisiz" });
    return;
  }
  try {
    // Tüm blog yazılarını çek, JS'de temizle, geri yaz
    const posts = await db.select({ id: blogPostsTable.id, content: blogPostsTable.content, excerpt: blogPostsTable.excerpt })
      .from(blogPostsTable);

    // Kapanmış [DOĞRULA: ...] ve kapanmamış [DOĞRULA: ... satır sonu kalıplarını sil
    const clean = (text: string | null): string =>
      (text ?? "")
        .replace(/\[DO\u011eRULA:[^\]]*\]/gi, "")   // kapanmış [DOĞRULA: ...]
        .replace(/\[DO\u011eRULA:[^\]]*$/gim, "")    // kapanmamış — satır sonuna kadar
        .replace(/\s{2,}/g, " ")
        .trim();

    let updated = 0;
    for (const post of posts) {
      const newContent = clean(post.content);
      const newExcerpt = clean(post.excerpt);
      if (newContent !== (post.content ?? "") || newExcerpt !== (post.excerpt ?? "")) {
        await db.execute(sql`UPDATE blog_posts SET content = ${newContent}, excerpt = ${newExcerpt} WHERE id = ${post.id}`);
        updated++;
      }
    }

    logger.info({ updated }, "fix-blog-placeholders: tamamlandı");
    res.json({ ok: true, updated });
  } catch (err) {
    logger.error({ err }, "fix-blog-placeholders: hata");
    res.status(500).json({ error: "Güncelleme başarısız" });
  }
});

// Belirli bir blog yazısını başlığından eşleşen BLOG_PLAN konusuyla yeniden üretir
app.post("/api/internal/regenerate-blog-post", async (req: Request, res: Response) => {
  const secret = process.env["ENCRYPTION_KEY"];
  const provided = req.headers["x-internal-secret"] as string | undefined;
  if (!secret || !provided || provided !== secret) {
    res.status(403).json({ error: "Yetkisiz" });
    return;
  }
  const { id, category, title, keywords, angle } = req.body as {
    id: number; category: string; title: string; keywords: string; angle: string;
  };
  if (!id || !title) { res.status(400).json({ error: "id ve title zorunlu" }); return; }

  // Fire-and-forget: proxy timeout'u aşmamak için hemen yanıt ver
  res.json({ ok: true, message: "Yeniden üretim arka planda başlatıldı", postId: id });

  setImmediate(async () => {
    try {
      const topic = { category: category ?? "KOBİ Stratejisi", title, keywords: keywords ?? title, angle: angle ?? title };
      const generated = await generateBlogPostContent(topic);

      await db.execute(sql`
        UPDATE blog_posts SET
          title               = ${generated.title},
          excerpt             = ${generated.excerpt},
          content             = ${generated.content},
          seo_title           = ${generated.seoTitle},
          meta_description    = ${generated.metaDescription},
          focus_keyword       = ${generated.focusKeyword},
          seo_tags            = ${JSON.stringify(generated.seoTags)}::jsonb,
          linkedin_post_tr    = ${generated.linkedinPostTr},
          instagram_caption_tr= ${generated.instagramCaptionTr},
          instagram_carousel_tr = ${JSON.stringify(generated.instagramCarouselTr)}::jsonb,
          social_text_tr      = ${generated.socialTextTr},
          visual_prompts_tr   = ${JSON.stringify(generated.visualPromptsTr)}::jsonb,
          updated_at          = NOW()
        WHERE id = ${id}
      `);

      logger.info({ id, title: generated.title }, "regenerate-blog-post: tamamlandı");
    } catch (err) {
      logger.error({ err }, "regenerate-blog-post: hata");
    }
  });
});

// ─── Internal: admin kullanıcı oluştur / güncelle ────────────────────────────
app.post("/api/internal/upsert-admin", async (req: Request, res: Response) => {
  const secret = process.env["ENCRYPTION_KEY"];
  const provided = req.headers["x-internal-secret"] as string | undefined;
  if (!secret || !provided || provided !== secret) {
    res.status(403).json({ error: "Yetkisiz" });
    return;
  }
  const { email, password, departments, isSuperadmin } = req.body as {
    email: string;
    password?: string;
    departments?: string[];
    isSuperadmin?: boolean;
  };
  if (!email) { res.status(400).json({ error: "email zorunlu" }); return; }

  try {
    const [existing] = await db.select({ id: adminUsersTable.id })
      .from(adminUsersTable).where(eq(adminUsersTable.email, email));

    if (existing) {
      // Güncelle
      const updates: Record<string, unknown> = {};
      if (password) updates["passwordHash"] = await bcrypt.hash(password, 12);
      if (departments !== undefined) updates["departments"] = departments;
      if (isSuperadmin !== undefined) updates["isSuperadmin"] = isSuperadmin;
      await db.update(adminUsersTable).set(updates).where(eq(adminUsersTable.id, existing.id));
      logger.info({ email, id: existing.id }, "internal/upsert-admin: güncellendi");
      res.json({ ok: true, action: "updated", id: existing.id });
    } else {
      // Yeni oluştur
      if (!password) { res.status(400).json({ error: "Yeni kullanıcı için password zorunlu" }); return; }
      const hash = await bcrypt.hash(password, 12);
      const [created] = await db.insert(adminUsersTable)
        .values({ email, passwordHash: hash, departments: departments ?? [], isSuperadmin: isSuperadmin ?? false })
        .returning({ id: adminUsersTable.id });
      logger.info({ email, id: created?.id }, "internal/upsert-admin: oluşturuldu");
      res.json({ ok: true, action: "created", id: created?.id });
    }
  } catch (err) {
    logger.error({ err }, "internal/upsert-admin: hata");
    res.status(500).json({ error: "Hata oluştu" });
  }
});

// ─── Internal: blog post'larını doğrudan seed et (production catch-up) ──────
// Accepts an array of blog post objects and upserts by slug.
app.post("/api/internal/seed-blog-posts", async (req: Request, res: Response) => {
  const secret = process.env["ENCRYPTION_KEY"];
  const provided = req.headers["x-internal-secret"] as string | undefined;
  if (!secret || !provided || provided !== secret) {
    res.status(403).json({ error: "Yetkisiz" });
    return;
  }
  const body = req.body as {
    posts?: Array<{
      title: string; slug: string; excerpt: string; content: string;
      titleEn?: string; excerptEn?: string; contentEn?: string;
      authorName?: string; publishedAt?: string;
      seoTitle?: string; seoTitleEn?: string; metaDescription?: string; metaDescriptionEn?: string;
      focusKeyword?: string; focusKeywordEn?: string; seoTags?: string[];
    }>;
    deleteIds?: number[];
    updates?: Array<{ id: number; content?: string; title?: string; excerpt?: string; status?: string }>;
  };
  // Support top-level array (legacy) or structured body
  const posts = Array.isArray(req.body) ? req.body : (body.posts ?? []);
  const deleteIds: number[] = Array.isArray(body.deleteIds) ? body.deleteIds : [];
  const updates: Array<{ id: number; content?: string; title?: string; excerpt?: string; status?: string }> =
    Array.isArray(body.updates) ? body.updates : [];
  if (posts.length === 0 && deleteIds.length === 0 && updates.length === 0) {
    res.status(400).json({ error: "posts, deleteIds veya updates zorunlu" });
    return;
  }
  try {
    let inserted = 0;
    let skipped = 0;
    for (const p of posts) {
      const existing = await db.execute(sql`SELECT id FROM blog_posts WHERE slug = ${p.slug} LIMIT 1`);
      if (existing.rows.length > 0) { skipped++; continue; }
      await db.execute(sql`
        INSERT INTO blog_posts (
          title, slug, excerpt, content,
          title_en, excerpt_en, content_en,
          author_name, status, published_at,
          seo_title, seo_title_en, meta_description, meta_description_en,
          focus_keyword, focus_keyword_en, seo_tags,
          created_at, updated_at
        ) VALUES (
          ${p.title}, ${p.slug}, ${p.excerpt}, ${p.content},
          ${p.titleEn ?? null}, ${p.excerptEn ?? null}, ${p.contentEn ?? null},
          ${p.authorName ?? "CyberStep.io"}, 'published',
          ${p.publishedAt ? new Date(p.publishedAt).toISOString() : new Date().toISOString()},
          ${p.seoTitle ?? null}, ${p.seoTitleEn ?? null},
          ${p.metaDescription ?? null}, ${p.metaDescriptionEn ?? null},
          ${p.focusKeyword ?? null}, ${p.focusKeywordEn ?? null},
          ${JSON.stringify(p.seoTags ?? [])}::jsonb,
          NOW(), NOW()
        )
      `);
      inserted++;
    }
    let updated = 0;
    for (const u of updates) {
      if (!u.id) continue;
      if (u.content !== undefined) {
        await db.execute(sql`UPDATE blog_posts SET content = ${u.content}, updated_at = NOW() WHERE id = ${u.id}`);
      }
      if (u.title !== undefined) {
        await db.execute(sql`UPDATE blog_posts SET title = ${u.title}, updated_at = NOW() WHERE id = ${u.id}`);
      }
      if (u.excerpt !== undefined) {
        await db.execute(sql`UPDATE blog_posts SET excerpt = ${u.excerpt}, updated_at = NOW() WHERE id = ${u.id}`);
      }
      if (u.status !== undefined) {
        await db.execute(sql`UPDATE blog_posts SET status = ${u.status}, updated_at = NOW() WHERE id = ${u.id}`);
      }
      updated++;
    }
    let deleted = 0;
    if (deleteIds.length > 0) {
      for (const id of deleteIds) {
        await db.execute(sql`DELETE FROM blog_posts WHERE id = ${id}`);
      }
      deleted = deleteIds.length;
    }
    logger.info({ inserted, skipped, updated, deleted }, "seed-blog-posts: tamamlandı");
    res.json({ ok: true, inserted, skipped, updated, deleted });
  } catch (err) {
    logger.error({ err }, "seed-blog-posts: hata");
    res.status(500).json({ error: "Hata oluştu" });
  }
});

// ─── Internal: blog post sil (production temizliği) ──────────────────────────
app.post("/api/internal/delete-blog-posts", async (req: Request, res: Response) => {
  const secret = process.env["ENCRYPTION_KEY"];
  const provided = req.headers["x-internal-secret"] as string | undefined;
  if (!secret || !provided || provided !== secret) {
    res.status(403).json({ error: "Yetkisiz" });
    return;
  }
  const { ids } = req.body as { ids: number[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "ids dizisi zorunlu" });
    return;
  }
  try {
    await db.execute(sql`DELETE FROM blog_posts WHERE id = ANY(${ids}::int[])`);
    logger.info({ ids }, "delete-blog-posts: silindi");
    res.json({ ok: true, deleted: ids });
  } catch (err) {
    logger.error({ err }, "delete-blog-posts: hata");
    res.status(500).json({ error: "Hata oluştu" });
  }
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err: Error & { status?: number; type?: string }, req: Request, res: Response, _next: NextFunction) => {
  // Payload too large
  if (err.status === 413 || err.type === "entity.too.large") {
    res.status(413).json({ error: "İstek boyutu çok büyük (max 512kb)" });
    return;
  }
  logger.error({ err, path: req.path, method: req.method }, "Unhandled error");
  // In production, never leak stack traces or internal error details.
  // The requestId lets support teams correlate logs without exposing internals.
  if (process.env["NODE_ENV"] === "production") {
    res.status(500).json({ error: "Sunucu hatası oluştu. Lütfen tekrar deneyin.", requestId: req.id });
  } else {
    res.status(500).json({ error: err.message, stack: err.stack, requestId: req.id });
  }
});

export default app;
