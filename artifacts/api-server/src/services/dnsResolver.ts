import dns from "node:dns/promises";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";

export type DnsRecordType = "A" | "MX" | "NS" | "TXT" | "CNAME";

/**
 * null means the lookup failed (resolver error / timeout).
 * [] means the query succeeded but no records exist.
 * Keeping these distinct prevents false-positive diffs on transient failures.
 */
export interface DnsSnapshot {
  A: string[] | null;
  MX: Array<{ priority: number; exchange: string }> | null;
  NS: string[] | null;
  TXT: string[][] | null;
  CNAME: string[] | null;
}

export interface DnsChange {
  recordType: DnsRecordType;
  oldValues: unknown;
  newValues: unknown;
  severity: "critical" | "high" | "medium" | "low";
}

const RECORD_SEVERITY: Record<DnsRecordType, "critical" | "high" | "medium" | "low"> = {
  NS: "critical",
  MX: "critical",
  A: "high",
  CNAME: "high",
  TXT: "medium",
};

// Safely parse a JSONB value that may be already-deserialized (object) or a JSON string.
function parseJsonb<T>(val: unknown, fallback: T): T {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "string") {
    try { return JSON.parse(val) as T; } catch { return fallback; }
  }
  return val as T;
}

/**
 * Canonicalize TXT records for stable comparison.
 * Each chunk-array is joined, then the resulting strings are sorted.
 */
function normalizeTxt(records: string[][] | null): string | null {
  if (records === null) return null;
  return JSON.stringify([...records.map(r => r.join("")).sort()]);
}

function normalizeSorted<T>(arr: T[] | null): string | null {
  if (arr === null) return null;
  return JSON.stringify(arr);
}

export async function resolveDnsSnapshot(domain: string): Promise<DnsSnapshot> {
  const snap: DnsSnapshot = { A: null, MX: null, NS: null, TXT: null, CNAME: null };

  await Promise.allSettled([
    dns.resolve4(domain)
      .then(v => { snap.A = [...v].sort(); })
      .catch(() => { snap.A = null; }),

    dns.resolveMx(domain)
      .then(v => {
        snap.MX = [...v].sort((a, b) =>
          a.priority - b.priority || a.exchange.localeCompare(b.exchange)
        );
      })
      .catch(() => { snap.MX = null; }),

    dns.resolveNs(domain)
      .then(v => { snap.NS = [...v].sort(); })
      .catch(() => { snap.NS = null; }),

    dns.resolveTxt(domain)
      .then(v => {
        // Sort chunks within each record, then sort records for stability
        snap.TXT = v.map(chunks => [...chunks].sort()).sort((a, b) =>
          a.join("").localeCompare(b.join(""))
        );
      })
      .catch(() => { snap.TXT = null; }),

    dns.resolveCname(domain)
      .then(v => { snap.CNAME = [...v].sort(); })
      .catch(() => { snap.CNAME = null; }),
  ]);

  return snap;
}

/**
 * Compare two snapshots.
 * Record types where EITHER snapshot has null (failed lookup) are skipped —
 * we cannot determine whether a real change occurred vs a transient resolver error.
 */
export function diffSnapshots(prev: DnsSnapshot, curr: DnsSnapshot): DnsChange[] {
  const changes: DnsChange[] = [];

  for (const type of ["A", "MX", "NS", "TXT", "CNAME"] as DnsRecordType[]) {
    const p = prev[type];
    const c = curr[type];

    // Skip if either side is null (resolver failure — not a real change)
    if (p === null || c === null) continue;

    const prevStr = type === "TXT"
      ? normalizeTxt(p as string[][] | null)
      : normalizeSorted(p as unknown[] | null);
    const currStr = type === "TXT"
      ? normalizeTxt(c as string[][] | null)
      : normalizeSorted(c as unknown[] | null);

    if (prevStr !== currStr) {
      changes.push({
        recordType: type,
        oldValues: p,
        newValues: c,
        severity: RECORD_SEVERITY[type],
      });
    }
  }

  return changes;
}

export function formatDnsValue(type: DnsRecordType, values: unknown): string {
  if (!values || (Array.isArray(values) && values.length === 0)) return "(boş)";
  if (type === "MX") {
    const mx = values as Array<{ priority: number; exchange: string }>;
    return mx.map(r => `${r.priority} ${r.exchange}`).join(", ");
  }
  if (type === "TXT") {
    const txt = values as string[][];
    return txt.map(r => r.join("")).join(" | ");
  }
  return (values as string[]).join(", ");
}

interface SnapshotRow {
  a_records: unknown;
  mx_records: unknown;
  ns_records: unknown;
  txt_records: unknown;
  cname_records: unknown;
  [key: string]: unknown;
}

export async function checkAndSaveDnsChanges(params: {
  customerId: number;
  domain: string;
  watchedDomainId: number;
  onChanges: (changes: DnsChange[], snapshot: DnsSnapshot) => Promise<void>;
  onSocCase: (customerId: number, domain: string, change: DnsChange) => Promise<number | null>;
}): Promise<void> {
  const { customerId, domain, watchedDomainId, onChanges, onSocCase } = params;

  try {
    // 1. Resolve current DNS (null = resolver failure, [] = genuinely no records)
    const curr = await resolveDnsSnapshot(domain);

    // 2. Fetch the most recent snapshot for comparison
    const prevResult = await db.execute<SnapshotRow>(sql`
      SELECT a_records, mx_records, ns_records, txt_records, cname_records
      FROM dns_snapshots
      WHERE customer_id = ${customerId} AND domain = ${domain}
      ORDER BY checked_at DESC
      LIMIT 1
    `);
    const prevRow = (prevResult as unknown as { rows: SnapshotRow[] }).rows?.[0];

    // 3. First time we're seeing this domain — insert baseline snapshot and return
    if (!prevRow) {
      await db.execute(sql`
        INSERT INTO dns_snapshots (customer_id, domain, a_records, mx_records, ns_records, txt_records, cname_records)
        VALUES (
          ${customerId}, ${domain},
          ${JSON.stringify(curr.A)}::jsonb, ${JSON.stringify(curr.MX)}::jsonb,
          ${JSON.stringify(curr.NS)}::jsonb, ${JSON.stringify(curr.TXT)}::jsonb,
          ${JSON.stringify(curr.CNAME)}::jsonb
        )
      `);
      await db.execute(sql`UPDATE dns_watched_domains SET last_checked_at = NOW() WHERE id = ${watchedDomainId}`);
      logger.info({ customerId, domain }, "DNS baseline snapshot created");
      return;
    }

    // 4. Deserialize JSONB safely (pg driver may return already-parsed objects or strings).
    //    null stored in the DB means "lookup failed" — preserved as null.
    const prev: DnsSnapshot = {
      A: parseJsonb<string[] | null>(prevRow.a_records, null),
      MX: parseJsonb<Array<{ priority: number; exchange: string }> | null>(prevRow.mx_records, null),
      NS: parseJsonb<string[] | null>(prevRow.ns_records, null),
      TXT: parseJsonb<string[][] | null>(prevRow.txt_records, null),
      CNAME: parseJsonb<string[] | null>(prevRow.cname_records, null),
    };

    const changes = diffSnapshots(prev, curr);

    // 5. No changes — only touch last_checked_at; do not insert a new snapshot row
    if (changes.length === 0) {
      await db.execute(sql`UPDATE dns_watched_domains SET last_checked_at = NOW() WHERE id = ${watchedDomainId}`);
      return;
    }

    // 6. Changes detected — insert new snapshot and record each change event
    await db.execute(sql`
      INSERT INTO dns_snapshots (customer_id, domain, a_records, mx_records, ns_records, txt_records, cname_records)
      VALUES (
        ${customerId}, ${domain},
        ${JSON.stringify(curr.A)}::jsonb, ${JSON.stringify(curr.MX)}::jsonb,
        ${JSON.stringify(curr.NS)}::jsonb, ${JSON.stringify(curr.TXT)}::jsonb,
        ${JSON.stringify(curr.CNAME)}::jsonb
      )
    `);
    await db.execute(sql`UPDATE dns_watched_domains SET last_checked_at = NOW() WHERE id = ${watchedDomainId}`);

    for (const change of changes) {
      const socCaseId = await onSocCase(customerId, domain, change).catch(() => null);
      await db.execute(sql`
        INSERT INTO dns_change_events (customer_id, domain, record_type, old_values, new_values, severity, soc_case_id)
        VALUES (
          ${customerId}, ${domain}, ${change.recordType},
          ${JSON.stringify(change.oldValues)}::jsonb, ${JSON.stringify(change.newValues)}::jsonb,
          ${change.severity}, ${socCaseId}
        )
      `);
    }

    await onChanges(changes, curr).catch(err =>
      logger.warn({ err, domain }, "DNS change alert callback failed")
    );

    logger.info({ customerId, domain, changeCount: changes.length }, "DNS changes detected and recorded");
  } catch (err) {
    logger.error({ err, customerId, domain }, "checkAndSaveDnsChanges failed");
  }
}
