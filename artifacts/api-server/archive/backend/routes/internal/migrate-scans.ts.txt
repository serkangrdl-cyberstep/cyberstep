import { Router } from "express";
import type { Request, Response } from "express";
import { db, pool, domainScansTable } from "@workspace/db";
import { inArray } from "drizzle-orm";
import { logger } from "../../lib/logger";

const router = Router();

// Column names in snake_case order (matches SELECT * column order; no id)
const COLUMNS = [
  "domain","email","spf_pass","spf_record","dmarc_pass","dmarc_record",
  "dkim_pass","dkim_selectors","mx_pass","mx_records","ssl_pass","ssl_expiry",
  "ssl_issuer","ssl_days_until_expiry","overall_score","created_at","notified_at",
  "hibp_breach_count","hibp_breaches","blacklisted","blacklist_count","blacklist_results",
  "shadow_it_services","tenant_id","http_headers_score","http_headers_details",
  "urlhaus_listed","urlhaus_threat","usom_listed","ct_subdomains","ct_subdomain_count",
  "cve_summary","shodan_open_ports","shodan_vuln_count","shodan_country","shodan_isp",
  "virustotal_reputation","virustotal_malicious","virustotal_suspicious",
  "abuseipdb_score","abuseipdb_total_reports","abuseipdb_country","abuseipdb_isp",
  "safe_browsing_flagged","safe_browsing_threats","ssl_labs_grade","badge_token",
  "referral_source","kep_configured","kep_relays","kep_secure",
  "attack_scenarios_json","attack_scenarios_status","attack_scenarios_started_at",
  "redirected_to","gemini_ai_report","gemini_ai_report_status",
  "waf_detected","waf_provider","waf_bypass_possible","origin_ip","waf_headers_added",
  "waf_confidence","sector","city","hosting_provider","is_wordpress","has_cdn",
  "cdn_provider","open_ports_count","critical_cve_count","high_cve_count",
  "included_in_index","excluded_reason","confidence_score","confidence_note",
  "origin_ip_source","asn_number","asn_name","orphaned_assets","censys_related_hosts",
  "censys_total_found","letter_grade","is_publicly_shared",
] as const;

const toCamel = (s: string) =>
  s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
const COL_TO_CAMEL: Record<string, string> = Object.fromEntries(
  COLUMNS.map(c => [c, toCamel(c)])
);

const COL_LIST = COLUMNS.join(", ");
const PLACEHOLDERS = COLUMNS.map((_, i) => `$${i + 1}`).join(", ");
const INSERT_SQL = `INSERT INTO domain_scans (${COL_LIST}) VALUES (${PLACEHOLDERS})`;

// ─── POST /api/internal/migrate-domain-scans ─────────────────────────────────
router.post("/internal/migrate-domain-scans", async (req: Request, res: Response) => {
  const { scans, secret } = req.body as { scans?: unknown[]; secret?: string };

  if (!secret || secret !== process.env["BRIDGE_SECRET"]) {
    res.status(403).json({ error: "Yetkisiz" });
    return;
  }

  if (!Array.isArray(scans) || scans.length === 0) {
    res.status(400).json({ error: "scans dizisi gerekli" });
    return;
  }

  const rows = scans as Array<Record<string, unknown>>;
  const incomingDomains = rows.map(s => String(s["domain"] ?? "")).filter(Boolean);

  if (incomingDomains.length === 0) {
    res.json({ inserted: 0, skipped: 0 });
    return;
  }

  // Prod'da zaten hangi domain'ler var?
  const existing = await db
    .select({ domain: domainScansTable.domain })
    .from(domainScansTable)
    .where(inArray(domainScansTable.domain, incomingDomains));

  const existingSet = new Set(existing.map(r => r.domain));
  const toInsert = rows.filter(s => !existingSet.has(String(s["domain"] ?? "")));
  const skipped = rows.length - toInsert.length;
  let inserted = 0;

  // Use raw pg pool to bypass Drizzle's type mappers (avoids toISOString issues)
  const client = await pool.connect();
  try {
    for (const row of toInsert) {
      const vals = COLUMNS.map(col => {
        const v = row[COL_TO_CAMEL[col] ?? col] ?? row[col] ?? null;
        if (v !== null && typeof v === "object") return JSON.stringify(v);
        return v ?? null;
      });
      await client.query(INSERT_SQL, vals);
      inserted++;
    }
  } finally {
    client.release();
  }

  logger.info({ inserted, skipped, total: rows.length }, "Domain scan migration batch complete");
  res.json({ inserted, skipped, total: rows.length });
});

export default router;
