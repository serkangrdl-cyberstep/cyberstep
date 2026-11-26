import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../lib/logger";

/**
 * Tek seferlik: kaldırılan eski özelliklerin (teaser, AI politika/izleme, SOC/NOC, bulut CSPM, vb.) tabloları.
 * Kullanıcı kararı (26 Kasım 2026): entegrasyon/müşteri yok, kod arşive alındı, veriler silinsin.
 * Silmeden önce satır sayısı loglanır. Kod arşivi: artifacts/api-server/archive/backend, lib/db/archive.
 */
export const OLD_TABLES = [
  "meeting_requests",
  "ai_tools_registry",
  "ai_assessment_answers",
  "certstream_queue",
  "certstream_status",
  "eu_aiact_assessments",
  "code_secrets_findings",
  "isr_activities",
  "isr_reminders",
  "isr_copilot_cache",
  "phishing_simulations",
  "phishing_sim_osint_sources",
  "bas_simulations",
  "deepfake_assessments",
  "ms365_signin_logs",
  "ms365_email_alerts",
  "market_configs",
  "report_sector_details",
  "report_city_details",
  "report_tech_trends",
  "report_leads",
  "onboarding_progress",
  "ai_policy_documents",
  "ai_policy_subscriptions",
  "red_team_reports",
  "internal_scans",
  "internal_scan_surveys",
  "ai_security_reports",
  "bulletin_clicks",
  "sector_newsletter_subscribers",
  "new_companies_registry",
  "coupons",
  "cloud_connections",
  "cloud_findings",
  "customer_security_maturity",
  "technology_discovery_requests",
  "ai_tool_policy_snapshots",
  "ai_monitoring_subscriptions",
  "ai_monitoring_alerts",
  "ioc_queries",
  "security_policies",
  "vciso_early_access",
  "teaser_reports",
  "prospect_replies",
  "lead_campaigns",
  "work_packages",
  "breach_monitor_requests",
  "contact_enrichment_log",
  "sales_team",
] as const;

const MARKER = "old_tables_dropped_v1";

export async function runDropOldTables(): Promise<void> {
  const done = await db.execute(sql`SELECT 1 FROM site_settings WHERE key = ${MARKER}`);
  if ((done as unknown as { rows?: unknown[] }).rows?.length) return;
  let dropped = 0;
  for (const t of OLD_TABLES) {
    if (!/^[a-z0-9_]+$/.test(t)) continue;
    const ex = await db.execute(sql`SELECT to_regclass(${"public." + t}) AS r`);
    const exists = (ex as unknown as { rows?: { r: string | null }[] }).rows?.[0]?.r;
    if (!exists) continue;
    const c = await db.execute(sql.raw(`SELECT COUNT(*)::int AS n FROM "${t}"`));
    const rows = (c as unknown as { rows?: { n: number }[] }).rows?.[0]?.n ?? 0;
    await db.execute(sql.raw(`DROP TABLE IF EXISTS "${t}" CASCADE`));
    dropped++;
    logger.info({ table: t, rows }, "Eski tablo silindi");
  }
  await db.execute(sql`INSERT INTO site_settings (key, value, updated_at) VALUES (${MARKER}, '1', NOW()) ON CONFLICT (key) DO NOTHING`);
  logger.info({ dropped }, "Eski tablo temizliği tamamlandı");
}

const MARKER_V2 = "old_tables_dropped_v2";
/** ISR (Fortinet satış modülü) tabloları — kullanıcı kararı, 26 Kasım 2026. */
export const OLD_TABLES_V2 = [
  "isr_rfq_responses", "isr_quote_lines", "isr_quotes", "isr_margin_rules", "isr_email_inbox",
  "isr_rfqs", "isr_deals", "isr_distributors", "isr_vendors", "isr_customers",
] as const;

export async function runDropOldTablesV2(): Promise<void> {
  const done = await db.execute(sql`SELECT 1 FROM site_settings WHERE key = ${MARKER_V2}`);
  if ((done as unknown as { rows?: unknown[] }).rows?.length) return;
  for (const t of OLD_TABLES_V2) {
    const ex = await db.execute(sql`SELECT to_regclass(${"public." + t}) AS r`);
    if (!(ex as unknown as { rows?: { r: string | null }[] }).rows?.[0]?.r) continue;
    const c = await db.execute(sql.raw(`SELECT COUNT(*)::int AS n FROM "${t}"`));
    const rows = (c as unknown as { rows?: { n: number }[] }).rows?.[0]?.n ?? 0;
    await db.execute(sql.raw(`DROP TABLE IF EXISTS "${t}" CASCADE`));
    logger.info({ table: t, rows }, "Eski tablo silindi");
  }
  await db.execute(sql`INSERT INTO site_settings (key, value, updated_at) VALUES (${MARKER_V2}, '1', NOW()) ON CONFLICT (key) DO NOTHING`);
}
