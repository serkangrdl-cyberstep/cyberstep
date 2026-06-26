import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { getBreachesForDomain } from "./hibpService";
import { searchByDomain, mapToIncidents } from "./dehashedService";
import type { LeakageIncidentInput } from "./hibpService";

function sleep(ms: number): Promise<void> {
  return new Promise(res => setTimeout(res, ms));
}

async function getLastScanTime(customerId: number): Promise<Date | null> {
  const rows = await db.execute(sql`
    SELECT scanned_at
    FROM leakage_scan_log
    WHERE customer_id = ${customerId}
    ORDER BY scanned_at DESC
    LIMIT 1
  `);
  const row = rows.rows[0] as { scanned_at: string } | undefined;
  return row ? new Date(row.scanned_at) : null;
}

async function upsertIncidents(
  incidents: LeakageIncidentInput[],
  customerId: number,
): Promise<{ upserted: number; newCount: number }> {
  let upserted = 0;
  let newCount  = 0;

  for (const inc of incidents) {
    // KVKK: max 20 emails
    const emails = (inc.affectedEmails ?? []).slice(0, 20);
    // KVKK: no password hashes in raw_response
    const raw = { ...inc.rawResponse };
    delete raw["password"];
    delete raw["hash"];
    delete raw["password_hash"];
    delete raw["passwordHash"];

    const result = await db.execute(sql`
      INSERT INTO leakage_incidents (
        customer_id, customer_domain, breach_source, breach_date,
        affected_email_count, affected_emails, data_types,
        severity, is_new, source_api, raw_response,
        first_detected, last_verified
      ) VALUES (
        ${customerId},
        ${inc.customerDomain},
        ${inc.breachSource},
        ${inc.breachDate ?? null},
        ${inc.affectedEmailCount},
        ${emails as unknown as string},
        ${(inc.dataTypes ?? []) as unknown as string},
        ${inc.severity},
        true,
        ${inc.sourceApi},
        ${JSON.stringify(raw)},
        NOW(),
        NOW()
      )
      ON CONFLICT (customer_id, breach_source, source_api)
      DO UPDATE SET last_verified = NOW()
      RETURNING id, (xmax = 0) AS inserted
    `);

    for (const row of result.rows as Array<{ id: number; inserted: boolean }>) {
      upserted++;
      if (row.inserted) newCount++;
    }
  }

  return { upserted, newCount };
}

async function logScan(
  customerId: number,
  apiUsed: string,
  breachesFound: number,
  newBreaches: number,
  durationMs: number,
  errorMessage: string | null,
): Promise<void> {
  await db.execute(sql`
    INSERT INTO leakage_scan_log (
      customer_id, api_used, breaches_found, new_breaches, error_message, duration_ms
    ) VALUES (
      ${customerId}, ${apiUsed}, ${breachesFound}, ${newBreaches},
      ${errorMessage}, ${durationMs}
    )
  `);
}

export async function runLeakageMonitoring(
  targetCustomerId?: number,
): Promise<{ customers_checked: number; new_incidents: number; errors: number }> {
  let query = `
    SELECT id, email, company_name, domain
    FROM customers
    WHERE subscription_status IN ('active', 'trial')
  `;
  if (targetCustomerId != null) query += ` AND id = ${targetCustomerId}`;

  const custRows = await db.execute(sql.raw(query));
  type CustRow = { id: number; email: string; company_name: string | null; domain: string | null };
  const customers = custRows.rows as CustRow[];

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let customersChecked = 0;
  let newIncidents     = 0;
  let errors           = 0;

  for (const cust of customers) {
    // Use domain if available, else extract from email
    const domain = cust.domain
      ?? (cust.email.includes("@") ? cust.email.split("@")[1] : null);

    if (!domain) {
      logger.info({ customerId: cust.id }, "leakage: domain bulunamadı, atlanıyor");
      continue;
    }

    // Skip if scanned within last 7 days
    const lastScan = await getLastScanTime(cust.id);
    if (lastScan && lastScan > sevenDaysAgo) {
      logger.debug({ customerId: cust.id, lastScan }, "leakage: son 7 gün içinde tarandı, atlanıyor");
      continue;
    }

    customersChecked++;
    const t0 = Date.now();
    let allIncidents: LeakageIncidentInput[] = [];
    let errorMessage: string | null = null;

    // HIBP
    try {
      const hibpResults = await getBreachesForDomain(domain);
      allIncidents.push(
        ...hibpResults.map(i => ({ ...i, customerId: cust.id })),
      );
    } catch (err) {
      logger.error({ err, customerId: cust.id, domain }, "HIBP sorgu hatası");
      errorMessage = `HIBP: ${String(err)}`;
      errors++;
    }

    // Rate limit between HIBP and DeHashed
    await sleep(1500);

    // DeHashed
    try {
      const dehashedResults = await searchByDomain(domain);
      if (dehashedResults.length > 0) {
        const dehashedIncidents = mapToIncidents(dehashedResults, cust.id, domain);
        allIncidents.push(...dehashedIncidents);
      }
    } catch (err) {
      logger.error({ err, customerId: cust.id, domain }, "DeHashed sorgu hatası");
      errorMessage = (errorMessage ? errorMessage + "; " : "") + `DeHashed: ${String(err)}`;
    }

    const durationMs = Date.now() - t0;

    // Upsert incidents
    let scanNewCount = 0;
    if (allIncidents.length > 0) {
      try {
        const result = await upsertIncidents(allIncidents, cust.id);
        scanNewCount  = result.newCount;
        newIncidents += result.newCount;
      } catch (err) {
        logger.error({ err, customerId: cust.id }, "leakage upsert hatası");
        errorMessage = (errorMessage ? errorMessage + "; " : "") + `upsert: ${String(err)}`;
        errors++;
      }
    }

    // Log scan
    await logScan(
      cust.id,
      "hibp+dehashed",
      allIncidents.length,
      scanNewCount,
      durationMs,
      errorMessage,
    );

    logger.info({
      customerId:  cust.id,
      domain,
      total:       allIncidents.length,
      newCount:    scanNewCount,
      durationMs,
    }, "leakage: müşteri tarama tamamlandı");

    // Small delay between customers to avoid rate limits
    await sleep(500);
  }

  return {
    customers_checked: customersChecked,
    new_incidents:     newIncidents,
    errors,
  };
}
