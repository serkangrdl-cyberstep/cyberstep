import { Registry, Counter, Gauge, Histogram, collectDefaultMetrics } from "prom-client";
import { db } from "@workspace/db";
import { logger } from "../lib/logger";

const register = new Registry();

collectDefaultMetrics({ register, prefix: "node_" });

// ─── CLAUDE AI METRİKLERİ ────────────────────────────────────────────────────

export const claudeApiCalls = new Counter({
  name: "cyberstep_claude_api_calls_total",
  help: "Total Claude API calls by tier and model",
  labelNames: ["tier", "model", "use_case"] as const,
  registers: [register],
});

export const claudeTokensUsed = new Counter({
  name: "cyberstep_claude_tokens_total",
  help: "Total tokens used by Claude API",
  labelNames: ["tier", "model", "type"] as const,
  registers: [register],
});

export const claudeCostUSD = new Counter({
  name: "cyberstep_claude_cost_usd_total",
  help: "Total estimated Claude API cost in USD",
  labelNames: ["tier", "model"] as const,
  registers: [register],
});

export const claudeLatency = new Histogram({
  name: "cyberstep_claude_duration_seconds",
  help: "Claude API call duration in seconds",
  labelNames: ["tier", "model"] as const,
  buckets: [0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
});

// ─── SOC METRİKLERİ ──────────────────────────────────────────────────────────

export const socAlertsTotal = new Counter({
  name: "cyberstep_soc_alerts_total",
  help: "Total alerts processed by SOC",
  labelNames: ["action", "severity", "tier"] as const,
  registers: [register],
});

export const socQueueDepth = new Gauge({
  name: "cyberstep_soc_queue_depth",
  help: "Current number of unprocessed SOC alerts",
  labelNames: ["priority"] as const,
  registers: [register],
});

export const socTriageDuration = new Histogram({
  name: "cyberstep_soc_triage_seconds",
  help: "Time to complete alert triage",
  labelNames: ["tier", "severity"] as const,
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

export const socSlaBreaches = new Counter({
  name: "cyberstep_soc_sla_breaches_total",
  help: "Total SLA breach events",
  labelNames: ["severity", "tier"] as const,
  registers: [register],
});

export const socActiveCases = new Gauge({
  name: "cyberstep_soc_active_cases",
  help: "Current number of open SOC cases",
  labelNames: ["severity", "escalation_level"] as const,
  registers: [register],
});

// ─── DOMAIN TARAMA METRİKLERİ ────────────────────────────────────────────────

export const domainScansTotal = new Counter({
  name: "cyberstep_domain_scans_total",
  help: "Total domain scans initiated",
  labelNames: ["status", "type"] as const,
  registers: [register],
});

export const domainScanDuration = new Histogram({
  name: "cyberstep_domain_scan_seconds",
  help: "Domain scan duration in seconds",
  buckets: [5, 10, 20, 30, 60, 120, 300],
  registers: [register],
});

export const scanServiceTimeout = new Counter({
  name: "cyberstep_scan_service_timeouts_total",
  help: "Timeouts per external scan service",
  labelNames: ["service"] as const,
  registers: [register],
});

// ─── CRON JOB METRİKLERİ ─────────────────────────────────────────────────────

export const cronJobRuns = new Counter({
  name: "cyberstep_cron_runs_total",
  help: "Cron job execution count",
  labelNames: ["job_name", "status"] as const,
  registers: [register],
});

export const cronJobLastRun = new Gauge({
  name: "cyberstep_cron_last_success_timestamp",
  help: "Unix timestamp of last successful cron run",
  labelNames: ["job_name"] as const,
  registers: [register],
});

export const cronJobDuration = new Histogram({
  name: "cyberstep_cron_duration_seconds",
  help: "Cron job execution duration",
  labelNames: ["job_name"] as const,
  buckets: [1, 5, 10, 30, 60, 300, 600],
  registers: [register],
});

// ─── MÜŞTERİ / İŞ METRİKLERİ ────────────────────────────────────────────────

export const activeCustomers = new Gauge({
  name: "cyberstep_customers_active_total",
  help: "Number of active customers",
  labelNames: ["plan"] as const,
  registers: [register],
});

export const revenueMonthly = new Gauge({
  name: "cyberstep_mrr_tl",
  help: "Monthly Recurring Revenue in TL",
  registers: [register],
});

// ─── FORTINET FABRİC METRİKLERİ ──────────────────────────────────────────────

export const fabricEventsReceived = new Counter({
  name: "cyberstep_fabric_events_total",
  help: "Total Fortinet Fabric events received",
  labelNames: ["source", "severity"] as const,
  registers: [register],
});

export const fabricBlocksApplied = new Counter({
  name: "cyberstep_fabric_blocks_total",
  help: "Total IP blocks applied via FortiManager",
  labelNames: ["status"] as const,
  registers: [register],
});

// ─── OBSERVABİLİTY ENTEGRASYON METRİKLERİ ───────────────────────────────────

export const observabilityEventsTotal = new Counter({
  name: "cyberstep_observability_events_total",
  help: "Total inbound observability events",
  labelNames: ["provider", "event_type", "severity"] as const,
  registers: [register],
});

export const observabilityCorrelations = new Counter({
  name: "cyberstep_observability_correlations_total",
  help: "SOC correlations triggered by observability events",
  labelNames: ["provider", "result"] as const,
  registers: [register],
});

// ─── DİNAMİK GAUGE GÜNCELLEME ────────────────────────────────────────────────

interface CaseRow extends Record<string, unknown> { severity: string; escalation_level: string; cnt: string }
interface CustomerRow extends Record<string, unknown> { subscription_plan: string | null; cnt: string }
interface FabricRow extends Record<string, unknown> { cnt: string }

async function refreshDynamicGauges(): Promise<void> {
  try {
    const { rows: caseRows } = await db.execute<CaseRow>(
      `SELECT severity, escalation_level, count(*)::int AS cnt
       FROM soc_cases
       WHERE status IN ('open','investigating')
       GROUP BY severity, escalation_level`
    );
    socActiveCases.reset();
    for (const row of caseRows) {
      socActiveCases.set(
        { severity: row.severity, escalation_level: String(row.escalation_level) },
        Number(row.cnt)
      );
    }

    const { rows: custRows } = await db.execute<CustomerRow>(
      `SELECT subscription_plan, count(*)::int AS cnt
       FROM customers
       WHERE subscription_status = 'active'
       GROUP BY subscription_plan`
    );
    activeCustomers.reset();
    for (const row of custRows) {
      activeCustomers.set({ plan: row.subscription_plan ?? "unknown" }, Number(row.cnt));
    }

    const { rows: fabricRows } = await db.execute<FabricRow>(
      `SELECT count(*)::int AS cnt FROM fabric_events WHERE soc_triaged = false`
    );
    socQueueDepth.reset();
    socQueueDepth.set({ priority: "unprocessed" }, Number(fabricRows[0]?.cnt ?? 0));
  } catch (err) {
    logger.error({ err }, "prometheusMetrics: refreshDynamicGauges error");
  }
}

export async function getMetrics(): Promise<string> {
  await refreshDynamicGauges();
  return register.metrics();
}

export function getContentType(): string {
  return register.contentType;
}
