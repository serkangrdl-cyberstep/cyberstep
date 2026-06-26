import { logger } from "../../lib/logger";
import type { LeakageIncidentInput } from "./hibpService";

const DEHASHED_API_KEY   = process.env["DEHASHED_API_KEY"];
const DEHASHED_EMAIL     = process.env["DEHASHED_EMAIL"];
const DEHASHED_BASE      = "https://api.dehashed.com";

export interface DehashedEntry {
  id: string;
  email: string;
  username?: string;
  password?: string;
  hashed_password?: string;
  name?: string;
  phone?: string;
  address?: string;
  database_name: string;
  obtained_from?: string;
}

export interface DehashedResult {
  email: string;
  passwordHash: string | null;
  databaseName: string;
  obtainedFrom: string | null;
}

export async function searchByDomain(domain: string): Promise<DehashedResult[]> {
  if (!DEHASHED_API_KEY || !DEHASHED_EMAIL) {
    logger.debug({ domain }, "DEHASHED_API_KEY/DEHASHED_EMAIL eksik — atlanıyor");
    return [];
  }

  const url = `${DEHASHED_BASE}/search?query=domain%3A${encodeURIComponent(domain)}&size=100`;
  const credentials = Buffer.from(`${DEHASHED_EMAIL}:${DEHASHED_API_KEY}`).toString("base64");

  let resp: Response;
  try {
    resp = await fetch(url, {
      headers: {
        Authorization: `Basic ${credentials}`,
        Accept: "application/json",
      },
    });
  } catch (err) {
    logger.error({ err, domain }, "DeHashed ağ hatası");
    return [];
  }

  if (!resp.ok) {
    logger.warn({ domain, status: resp.status }, "DeHashed API hatası");
    return [];
  }

  let body: { entries?: DehashedEntry[] } | null = null;
  try {
    body = await resp.json() as { entries?: DehashedEntry[] };
  } catch {
    return [];
  }

  const entries = body?.entries ?? [];
  const seen    = new Set<string>();
  const results: DehashedResult[] = [];

  for (const e of entries) {
    if (!e.email || seen.has(e.email)) continue;
    seen.add(e.email);
    results.push({
      email:        e.email,
      passwordHash: e.hashed_password ?? (e.password ? "[redacted]" : null),
      databaseName: e.database_name ?? "Unknown",
      obtainedFrom: e.obtained_from ?? null,
    });
  }

  return results;
}

export function mapToIncidents(
  results: DehashedResult[],
  customerId: number,
  domain: string,
): LeakageIncidentInput[] {
  // Group by database_name
  const byDb = new Map<string, DehashedResult[]>();
  for (const r of results) {
    const arr = byDb.get(r.databaseName) ?? [];
    arr.push(r);
    byDb.set(r.databaseName, arr);
  }

  const incidents: LeakageIncidentInput[] = [];

  for (const [dbName, entries] of byDb) {
    const hasPasswordHash = entries.some(e => e.passwordHash !== null);
    const severity        = hasPasswordHash ? "high" : "medium";
    const dataTypes       = hasPasswordHash
      ? ["email addresses", "password_hash"]
      : ["email addresses"];

    // KVKK — max 20 email
    const emails = entries.map(e => e.email).slice(0, 20);

    const raw: Record<string, unknown> = {
      database_name: dbName,
      count:         entries.length,
      obtained_from: entries[0]?.obtainedFrom,
    };

    incidents.push({
      customerId,
      customerDomain:     domain,
      breachSource:       dbName,
      breachDate:         null,
      affectedEmailCount: entries.length,
      affectedEmails:     emails,
      dataTypes,
      severity,
      sourceApi:   "dehashed",
      rawResponse: raw,
    });
  }

  return incidents;
}
