/**
 * In-memory TTL cache for SOC triage.
 *
 * Replaces the Redis cache from the original spec with a process-local Map.
 * Suitable for the single-instance Replit deployment. Keyed by a stable
 * string (customer + ip + eventType, or a prompt hash for AI responses).
 * Entries auto-expire on read; a periodic sweep prevents unbounded growth.
 */

import { logger } from "../../lib/logger";

const DEFAULT_TTL_SECONDS = Number(process.env["REDIS_SOC_CACHE_TTL"] ?? 3600);

interface Entry {
  value: string;
  expiresAt: number;
}

const store = new Map<string, Entry>();

export function socCacheGet(key: string): string | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export function socCacheSet(key: string, value: string, ttlSeconds = DEFAULT_TTL_SECONDS): void {
  store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export function socCacheHas(key: string): boolean {
  return socCacheGet(key) !== null;
}

export function socCacheDelete(key: string): void {
  store.delete(key);
}

export function socCacheKey(parts: Array<string | number | null | undefined>): string {
  return parts.map((p) => (p == null ? "_" : String(p))).join(":");
}

export function socCacheSize(): number {
  return store.size;
}

// Periodic sweep of expired entries (every 10 min).
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  let removed = 0;
  for (const [key, entry] of store) {
    if (now > entry.expiresAt) {
      store.delete(key);
      removed++;
    }
  }
  if (removed > 0) logger.debug({ removed, remaining: store.size }, "SOC cache sweep");
}, SWEEP_INTERVAL_MS).unref();
