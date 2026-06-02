import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import router from "./routes";
import adminPanelRouter from "./routes/admin-panel/index";
import cvePublicRouter from "./routes/cve-public";
import bulletinPublicRouter from "./routes/bulletin-public";
import bulletinAdminRouter from "./routes/admin-panel/bulletin";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

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
const urlencodedParser = express.urlencoded({ extended: true, limit: "512kb" });
app.use((req, res, next) => (skipJsonParsing(req.path) ? next() : jsonParser(req, res, next)));
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

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use("/api", router);
app.use("/api", adminPanelRouter);
app.use("/api", cvePublicRouter);
app.use("/api", bulletinPublicRouter);
app.use("/api", bulletinAdminRouter);

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
