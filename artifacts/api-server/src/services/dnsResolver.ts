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

export async function checkAndSaveDnsChanges(params: {
  customerId: number;
  domain: string;
  watchedDomainId: number;
  customerEmail: string;
  onChanges: (changes: DnsChange[], snapshot: DnsSnapshot) => Promise<void>;
  onSocCase: (customerId: number, domain: string, change: DnsChange) => Promise<number | null>;
}): Promise<void> {
  const { customerId, domain, watchedDomainId, onChanges, onSocCase } = params;

  try {
    const curr = await resolveDnsSnapshot(domain);

    const prevRows = await db.execute<{
      a_records: string; mx_records: string; ns_records: string;
      txt_records: string; cname_records: string;
    }>(sql`
      SELECT a_records, mx_records, ns_records, txt_records, cname_records
      FROM dns_snapshots
      WHERE customer_id = ${customerId} AND domain = ${domain}
      ORDER BY checked_at DESC
      LIMIT 1
    `);

    await db.execute(sql`
      INSERT INTO dns_snapshots (customer_id, domain, a_records, mx_records, ns_records, txt_records, cname_records)
      VALUES (
        ${customerId}, ${domain},
        ${JSON.stringify(curr.A)}::jsonb, ${JSON.stringify(curr.MX)}::jsonb,
        ${JSON.stringify(curr.NS)}::jsonb, ${JSON.stringify(curr.TXT)}::jsonb,
        ${JSON.stringify(curr.CNAME)}::jsonb
      )
    `);

    await db.execute(sql`
      UPDATE dns_watched_domains SET last_checked_at = NOW() WHERE id = ${watchedDomainId}
    `);

    const prevRow = (prevRows as unknown as { rows: { a_records: string; mx_records: string; ns_records: string; txt_records: string; cname_records: string }[] }).rows?.[0];
    if (!prevRow) return;

    const prev: DnsSnapshot = {
      A: JSON.parse(prevRow.a_records || "[]"),
      MX: JSON.parse(prevRow.mx_records || "[]"),
      NS: JSON.parse(prevRow.ns_records || "[]"),
      TXT: JSON.parse(prevRow.txt_records || "[]"),
      CNAME: JSON.parse(prevRow.cname_records || "[]"),
    };

    const changes = diffSnapshots(prev, curr);
    if (changes.length === 0) return;

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
      logger.warn({ err, domain }, "DNS change alert email failed")
    );

    logger.info({ customerId, domain, changeCount: changes.length }, "DNS changes detected and recorded");
  } catch (err) {
    logger.error({ err, customerId, domain }, "checkAndSaveDnsChanges failed");
  }
}
