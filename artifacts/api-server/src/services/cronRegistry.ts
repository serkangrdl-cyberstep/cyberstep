import { db, siteSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface CronState {
  lastRunAt: string | null;
  lastRunStatus: "ok" | "error" | "running" | "never";
  lastRunDurationMs: number | null;
  lastError: string | null;
  isRunning: boolean;
}

const DEFAULT_STATE: CronState = {
  lastRunAt: null,
  lastRunStatus: "never",
  lastRunDurationMs: null,
  lastError: null,
  isRunning: false,
};

const registry = new Map<string, { state: CronState; startedAt: number }>();

export function cronStart(name: string): (ok: boolean, err?: string) => void {
  const startedAt = Date.now();
  registry.set(name, {
    state: { lastRunAt: new Date().toISOString(), lastRunStatus: "running", lastRunDurationMs: null, lastError: null, isRunning: true },
    startedAt,
  });
  return (ok: boolean, err?: string) => {
    const entry = registry.get(name);
    if (!entry) return;
    entry.state.isRunning = false;
    entry.state.lastRunStatus = ok ? "ok" : "error";
    entry.state.lastRunDurationMs = Date.now() - startedAt;
    entry.state.lastError = err ?? null;
  };
}

export function cronGetState(name: string): CronState {
  return registry.get(name)?.state ?? { ...DEFAULT_STATE };
}

export function cronGetAll(): Record<string, CronState> {
  const result: Record<string, CronState> = {};
  for (const [name, entry] of registry.entries()) {
    result[name] = entry.state;
  }
  return result;
}

export async function cronIsEnabled(name: string, defaultVal = true): Promise<boolean> {
  try {
    const [row] = await db.select().from(siteSettingsTable).where(eq(siteSettingsTable.key, `cron.${name}.enabled`));
    if (!row) return defaultVal;
    return row.value !== "false";
  } catch {
    return defaultVal;
  }
}

export async function cronGetLimit(name: string, defaultVal: number): Promise<number> {
  try {
    const [row] = await db.select().from(siteSettingsTable).where(eq(siteSettingsTable.key, `cron.${name}.limit`));
    return row ? (parseInt(row.value) || defaultVal) : defaultVal;
  } catch {
    return defaultVal;
  }
}
