import dns from "node:dns/promises";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";

export type DnsRecordType = "A" | "MX" | "NS" | "TXT" | "CNAME";

export interface DnsSnapshot {
  A: string[];
  MX: Array<{ priority: number; exchange: string }>;
  NS: string[];
  TXT: string[][];
  CNAME: string[];
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

export async function resolveDnsSnapshot(domain: string): Promise<DnsSnapshot> {
  const snap: DnsSnapshot = { A: [], MX: [], NS: [], TXT: [], CNAME: [] };

  await Promise.allSettled([
    dns.resolve4(domain).then(v => { snap.A = [...v].sort(); }).catch(() => {}),
    dns.resolveMx(domain).then(v => {
      snap.MX = [...v].sort((a, b) => a.priority - b.priority || a.exchange.localeCompare(b.exchange));
    }).catch(() => {}),
    dns.resolveNs(domain).then(v => { snap.NS = [...v].sort(); }).catch(() => {}),
    dns.resolveTxt(domain).then(v => { snap.TXT = v; }).catch(() => {}),
    dns.resolveCname(domain).then(v => { snap.CNAME = [...v].sort(); }).catch(() => {}),
  ]);

  return snap;
}

export function diffSnapshots(prev: DnsSnapshot, curr: DnsSnapshot): DnsChange[] {
  const changes: DnsChange[] = [];

  for (const type of ["A", "MX", "NS", "TXT", "CNAME"] as DnsRecordType[]) {
    const prevStr = JSON.stringify(prev[type] ?? null);
    const currStr = JSON.stringify(curr[type] ?? null);
    if (prevStr !== currStr) {
      changes.push({
        recordType: type,
        oldValues: prev[type],
        newValues: curr[type],
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
    // 1. Resolve current DNS
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

    // 4. Deserialize JSONB safely (pg driver may return already-parsed objects or strings)
    const prev: DnsSnapshot = {
      A: parseJsonb<string[]>(prevRow.a_records, []),
      MX: parseJsonb<Array<{ priority: number; exchange: string }>>(prevRow.mx_records, []),
      NS: parseJsonb<string[]>(prevRow.ns_records, []),
      TXT: parseJsonb<string[][]>(prevRow.txt_records, []),
      CNAME: parseJsonb<string[]>(prevRow.cname_records, []),
    };

    const changes = diffSnapshots(prev, curr);

    // 5. No changes — only touch last_checked_at, do not insert a new snapshot row
    if (changes.length === 0) {
      await db.execute(sql`UPDATE dns_watched_domains SET last_checked_at = NOW() WHERE id = ${watchedDomainId}`);
      return;
    }

    // 6. Changes detected — insert new snapshot and record each change
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
