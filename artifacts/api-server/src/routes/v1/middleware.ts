import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { apiProductKeysTable, apiProductUsageTable } from "@workspace/db";
import { eq, and, gte, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";

// In-memory domain rate limit: keyId → domain → last request timestamp
const domainRateMap = new Map<string, number>();

function domainRateKey(keyId: number, domain: string) {
  return `${keyId}:${domain}`;
}

export type ApiKeyTier = "freemium" | "standard" | "enterprise";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      apiKey?: {
        id: number;
        tier: ApiKeyTier;
        webhookUrl: string | null;
        email: string;
        company: string;
      };
      v1StartedAt?: number;
    }
  }
}

// Tier configs
const TIER_CONFIG: Record<ApiKeyTier, { dailyLimit: number; monthlyLimit: number; endpoints: string[] }> = {
  freemium:   { dailyLimit: 10,    monthlyLimit: 10,     endpoints: ["/v1/score"] },
  standard:   { dailyLimit: 1000,  monthlyLimit: 1000,   endpoints: ["/v1/score", "/v1/score/full", "/v1/score/certificate", "/v1/scan/trigger", "/v1/benchmark"] },
  enterprise: { dailyLimit: 999999, monthlyLimit: 999999, endpoints: ["/v1/score", "/v1/score/full", "/v1/score/certificate", "/v1/scan/trigger", "/v1/benchmark"] },
};

// Reset daily usage if date changed
async function maybeResetDailyUsage(row: { id: number; usageResetDate: Date }) {
  const now = new Date();
  const reset = new Date(row.usageResetDate);
  if (now.toDateString() !== reset.toDateString()) {
    await db.update(apiProductKeysTable)
      .set({ usageToday: 0, usageResetDate: now })
      .where(eq(apiProductKeysTable.id, row.id));
  }
}

// ─── Main API key middleware ──────────────────────────────────────────────────
export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  req.v1StartedAt = Date.now();

  const auth = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : (req.query.api_key as string | undefined);

  if (!token) {
    res.status(401).json({ error: "API anahtarı gerekli. Authorization: Bearer <key> başlığı ekleyin." });
    return;
  }

  const [row] = await db.select().from(apiProductKeysTable).where(
    and(eq(apiProductKeysTable.key, token), eq(apiProductKeysTable.active, true))
  ).limit(1);

  if (!row) {
    res.status(401).json({ error: "Geçersiz veya devre dışı bırakılmış API anahtarı." });
    return;
  }

  const tier = row.tier as ApiKeyTier;
  const config = TIER_CONFIG[tier] ?? TIER_CONFIG.freemium;

  // Reset daily counter if needed
  await maybeResetDailyUsage({ id: row.id, usageResetDate: row.usageResetDate });

  // Check daily limit
  if (row.usageToday >= config.dailyLimit) {
    res.status(429).json({
      error: "Günlük API çağrı limitiniz doldu.",
      tier,
      dailyLimit: config.dailyLimit,
      usageToday: row.usageToday,
      retryAfter: "Yarın gece yarısı sıfırlanır.",
    });
    return;
  }

  // Check monthly limit
  if (row.usageMonth >= config.monthlyLimit) {
    res.status(429).json({
      error: "Aylık API çağrı limitiniz doldu.",
      tier,
      monthlyLimit: config.monthlyLimit,
      usageMonth: row.usageMonth,
    });
    return;
  }

  // Endpoint authorization (freemium can only use /v1/score basic)
  const endpointBase = "/" + req.path.split("/").slice(1, 3).join("/"); // e.g. /v1/score
  const allowed = config.endpoints.some(e => endpointBase.startsWith(e));
  // but block /full and /certificate etc. for freemium
  if (tier === "freemium") {
    const isBasicScore = /^\/v1\/score\/[^/]+$/.test(req.path);
    if (!isBasicScore) {
      res.status(403).json({
        error: "Bu endpoint'e erişmek için Standart plan gerekli.",
        tier,
        upgrade: "https://cyberstep.io/skor-api",
      });
      return;
    }
  }

  req.apiKey = { id: row.id, tier, webhookUrl: row.webhookUrl, email: row.email, company: row.company };
  next();
}

// ─── Domain-level rate limit (1 query / hour / domain / key) ─────────────────
export function domainRateLimit(req: Request, res: Response, next: NextFunction) {
  const domain = String(req.params.domain ?? "").toLowerCase().trim();
  if (!domain || !req.apiKey) return next();

  const rk = domainRateKey(req.apiKey.id, domain);
  const last = domainRateMap.get(rk) ?? 0;
  const now = Date.now();
  const HOUR_MS = 60 * 60 * 1000;

  if (now - last < HOUR_MS) {
    res.status(429).json({
      error: "Aynı domain için saatte 1 sorgu yapılabilir.",
      domain,
      retryAfterMs: HOUR_MS - (now - last),
    });
    return;
  }

  domainRateMap.set(rk, now);
  next();
}

// ─── Increment usage counters + log ──────────────────────────────────────────
export async function trackUsage(
  keyId: number,
  endpoint: string,
  domain: string | null,
  sector: string | null,
  statusCode: number,
  responseMs: number,
) {
  try {
    await Promise.all([
      db.update(apiProductKeysTable)
        .set({
          usageToday: sql`${apiProductKeysTable.usageToday} + 1`,
          usageMonth: sql`${apiProductKeysTable.usageMonth} + 1`,
          lastUsedAt: new Date(),
        })
        .where(eq(apiProductKeysTable.id, keyId)),
      db.insert(apiProductUsageTable).values({ apiKeyId: keyId, endpoint, domain, sector, statusCode, responseMs }),
    ]);
  } catch (err) {
    logger.warn({ err, keyId }, "Failed to track API usage");
  }
}

// Helper: grade from score
export function scoreToGrade(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A";
  if (score >= 70) return "B";
  if (score >= 50) return "C";
  if (score >= 30) return "D";
  return "F";
}

export function gradeToRisk(grade: string): string {
  return grade === "A" ? "low" : grade === "B" ? "medium" : grade === "C" ? "high" : "critical";
}
