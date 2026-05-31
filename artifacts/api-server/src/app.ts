import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import router from "./routes";
import adminPanelRouter from "./routes/admin-panel/index";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const app: Express = express();

// ─── Trust Replit reverse proxy ──────────────────────────────────────────────
app.set("trust proxy", 1);

// ─── Security headers via Helmet ─────────────────────────────────────────────
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
        upgradeInsecureRequests: [],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    frameguard: { action: "deny" },
    noSniff: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    crossOriginEmbedderPolicy: false, // allow Gemini SSE
  }),
);

// ─── Permissions-Policy — tarayıcı özelliklerini kısıtla ─────────────────────
// OWASP: Gereksiz tarayıcı API'larına erişimi engelle (kamera, mikrofon, konum vb.)
app.use((_req, res, next) => {
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=(), browsing-topics=()",
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
        // they never land in logs (e.g. /api/public/fabric/ingest/<token>).
        const path = (req.url?.split("?")[0] ?? "")
          .replace(/(\/fabric\/(?:ingest|syslog|verify)\/)[^/]+/, "$1***");
        return { id: req.id, method: req.method, url: path };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// ─── Body parsing + payload limits ───────────────────────────────────────────
app.use(express.json({ limit: "512kb" }));
app.use(express.urlencoded({ extended: true, limit: "512kb" }));

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

app.use(
  session({
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
  }),
);

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use("/api", router);
app.use("/api", adminPanelRouter);

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err: Error & { status?: number; type?: string }, _req: Request, res: Response, _next: NextFunction) => {
  // Payload too large
  if (err.status === 413 || err.type === "entity.too.large") {
    res.status(413).json({ error: "İstek boyutu çok büyük (max 512kb)" });
    return;
  }
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Sunucu hatası" });
});

export default app;
