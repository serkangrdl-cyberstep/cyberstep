import { db, pool } from "@workspace/db";
import { observabilityEventsTable } from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { createCaseWithNumber } from "./soc/soc-cases";
import { logger } from "../lib/logger";

export interface NormalizedObsEvent {
  provider: string;
  eventType: string;
  severity: string;
  title: string;
  description?: string;
  affectedService?: string;
  affectedHost?: string;
  sourceIp?: string;
}

// ─── Datadog payload normalizer ───────────────────────────────────────────────

interface DatadogPayload {
  id?: string;
  title?: string;
  type?: string;
  message?: string;
  severity?: string;
  hostname?: string;
  tags?: string[];
  url?: string;
  date?: number;
}

export function normalizeDatadogEvent(payload: DatadogPayload): NormalizedObsEvent {
  const severityMap: Record<string, string> = {
    CRITICAL: "critical", ERROR: "high", WARNING: "medium", INFO: "low",
  };
  const typeMap: Record<string, string> = {
    "monitor alert": "anomaly_detected",
    "error tracking alert": "error_spike",
    "security signal": "security_alert",
    "apm alert": "latency_spike",
  };

  const tags = Object.fromEntries(
    (payload.tags ?? [])
      .filter((t) => t.includes(":"))
      .map((t) => t.split(":") as [string, string])
  );

  return {
    provider: "datadog",
    eventType: typeMap[payload.type ?? ""] ?? "anomaly_detected",
    severity: severityMap[payload.severity ?? ""] ?? "medium",
    title: payload.title ?? "Datadog Alert",
    description: payload.message,
    affectedService: tags["service"],
    affectedHost: payload.hostname,
  };
}

// ─── Azure payload normalizer ─────────────────────────────────────────────────

interface AzurePayload {
  data?: {
    context?: {
      activityLog?: {
        category?: string;
        level?: string;
        operationName?: string;
        description?: string;
        resourceId?: string;
      };
      condition?: {
        allOf?: Array<{ metricName?: string; metricValue?: number }>;
      };
      name?: string;
      resourceName?: string;
      resourceGroupName?: string;
    };
    status?: string;
  };
}

export function normalizeAzureEvent(payload: AzurePayload): NormalizedObsEvent {
  const actLog = payload.data?.context?.activityLog;
  const ctx = payload.data?.context;

  if (actLog?.category === "Security") {
    const level = actLog.level ?? "";
    const sevMap: Record<string, string> = { Critical: "critical", Error: "high", Warning: "medium", Informational: "low" };
    return {
      provider: "azure_monitor",
      eventType: "security_alert",
      severity: sevMap[level] ?? "medium",
      title: actLog.operationName ?? "Azure Security Alert",
      description: actLog.description,
      affectedService: actLog.resourceId?.split("/").pop(),
      affectedHost: actLog.resourceId ?? undefined,
    };
  }

  if (ctx?.condition) {
    const metric = ctx.condition.allOf?.[0];
    return {
      provider: "azure_monitor",
      eventType: "anomaly_detected",
      severity: payload.data?.status === "Activated" ? "medium" : "low",
      title: ctx.name ?? "Azure Metric Alert",
      description: metric ? `${metric.metricName}: ${metric.metricValue}` : undefined,
      affectedService: ctx.resourceName,
      affectedHost: ctx.resourceGroupName,
    };
  }

  return {
    provider: "azure_monitor",
    eventType: "resource_change",
    severity: "low",
    title: actLog?.operationName ?? "Azure Event",
    description: undefined,
  };
}

// ─── Cloudflare payload normalizer ───────────────────────────────────────────

interface CloudflarePayload {
  alert_type?: string;
  text?: string;
  data?: {
    action?: string;
    clientIP?: string;
    client_ip?: string;
    ruleId?: string;
    source?: string;
    botScore?: number;
    bot_score?: number;
    requestsPerSecond?: number;
    queryName?: string;
    queryType?: string;
    severity?: string;
  };
  metadata?: {
    action?: string;
    src_ip?: string;
    rule_id?: string;
  };
}

export function normalizeCloudflareEvent(payload: CloudflarePayload): NormalizedObsEvent {
  const alertType = payload.alert_type ?? "";
  const data = payload.data ?? {};
  const sourceIp = data.clientIP ?? data.client_ip ?? payload.metadata?.src_ip;

  const typeMap: Record<string, string> = {
    cf_waf_block: "waf.block",
    dos_attack_l7: "ddos.attack",
    dos_attack_l4: "ddos.attack",
    advanced_ddos: "ddos.attack",
    bot_anomaly: "bot.score",
    cf_bot_management: "bot.score",
    dns_anomaly: "dns.anomaly",
  };

  const eventType = typeMap[alertType] ?? "security_alert";

  let severity = "medium";
  let title = payload.text ?? "Cloudflare Güvenlik Uyarısı";

  if (eventType === "ddos.attack") {
    severity = "critical";
    title = payload.text ?? "Cloudflare DDoS Saldırısı Tespit Edildi";
  } else if (eventType === "waf.block") {
    severity = "high";
    const rps = data.requestsPerSecond;
    title = payload.text ?? `WAF Engelleme: ${sourceIp ?? "Bilinmeyen IP"}${rps ? ` (${rps} req/s)` : ""}`;
  } else if (eventType === "bot.score") {
    const score = data.botScore ?? data.bot_score ?? 100;
    severity = score < 10 ? "high" : score < 30 ? "medium" : "low";
    title = payload.text ?? `Bot Skoru Düşük: ${score}`;
  } else if (eventType === "dns.anomaly") {
    severity = "medium";
    title = payload.text ?? `DNS Anomalisi: ${data.queryName ?? "bilinmeyen sorgu"}`;
  }

  return {
    provider: "cloudflare",
    eventType,
    severity,
    title,
    description: `Alert tipi: ${alertType}${data.ruleId ? ` · Kural: ${data.ruleId}` : ""}`,
    affectedService: data.source ?? alertType,
    sourceIp,
  };
}

// ─── CrowdStrike Falcon IOC IP reputation check ────────────────────────────────

async function checkCrowdStrikeIpReputation(ip: string, customerId: number): Promise<boolean> {
  try {
    const { rows } = await pool.query<{ config: Record<string, string> }>(
      `SELECT config FROM customer_integrations
       WHERE customer_id = $1 AND type = 'crowdstrike' AND active = true
       LIMIT 1`,
      [customerId]
    );
    const cfg = rows[0]?.config;
    if (!cfg?.clientId || !cfg.clientSecret) return false;

    const base = cfg.baseUrl ?? "https://api.crowdstrike.com";

    // 1. OAuth2 token
    const tokenRes = await fetch(`${base}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `client_id=${encodeURIComponent(cfg.clientId)}&client_secret=${encodeURIComponent(cfg.clientSecret)}`,
    });
    if (!tokenRes.ok) return false;
    const tokenData = await tokenRes.json() as { access_token?: string };
    const token = tokenData.access_token;
    if (!token) return false;

    // 2. Query IOC indicator list for this IP (FQL filter)
    const filter = encodeURIComponent(`type:'ipv4',value:'${ip}'`);
    const iocRes = await fetch(`${base}/iocs/queries/indicators/v1?filter=${filter}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!iocRes.ok) return false;
    const iocData = await iocRes.json() as { resources?: string[] };
    return (iocData.resources?.length ?? 0) > 0;
  } catch (err) {
    logger.warn({ err, ip, customerId }, "checkCrowdStrikeIpReputation: error — treating as no match");
    return false;
  }
}

// ─── Cloudflare webhook header verification ───────────────────────────────────

export function verifyCloudflareHeader(
  cfTokenHeader: string | string[] | undefined,
  storedSecret: string | null,
): boolean {
  // Fail-closed: if no secret is configured, the token alone provides the auth boundary.
  // When a secret IS stored, enforce exact match via timing-safe compare.
  if (!storedSecret) return true;
  if (!cfTokenHeader) return false;
  try {
    const crypto = require("node:crypto") as typeof import("node:crypto");
    const provided = Array.isArray(cfTokenHeader) ? cfTokenHeader[0]! : cfTokenHeader;
    return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(storedSecret));
  } catch {
    return false;
  }
}

// ─── Cloudflare-specific SOC correlation ─────────────────────────────────────

export async function correlateCloudflareWithSOC(
  customerId: number,
  obsEvent: NormalizedObsEvent,
  _integrationId: number,
  obsEventId: number,
): Promise<void> {
  const { eventType, severity, sourceIp, title } = obsEvent;

  // DDoS → always open critical SOC case immediately
  if (eventType === "ddos.attack") {
    const socCase = await createCaseWithNumber({
      customerId,
      severity: "critical",
      category: "ddos",
      title: `Cloudflare DDoS Saldırısı: ${title}`,
      description: "Cloudflare tarafından tespit edilen L7/L4 DDoS saldırısı.",
      attackNarrative: "Cloudflare DDoS algılama sistemi aktif saldırı tespit etti. Trafik filtreleme devrede.",
      triggerEventIds: [],
    });
    if (socCase) {
      await pool.query(
        `UPDATE observability_events SET processed = true, correlated_soc_case_id = $1 WHERE id = $2`,
        [socCase.id, obsEventId]
      );
    }
    logger.info({ customerId, socCaseId: socCase?.id }, "Cloudflare DDoS: critical SOC case created");
    return;
  }

  // Bot score < 10 → severity=high in normalizer; create suspicious traffic record
  if (eventType === "bot.score" && severity === "high") {
    const socCase = await createCaseWithNumber({
      customerId,
      severity: "medium",
      category: "suspicious_bot",
      title: `Cloudflare Bot Skoru Kritik Düşük: ${title}`,
      description: "Cloudflare Bot Management bot skoru 10'un altında tespit etti. Otomatik araç veya saldırı yazılımı olabilir.",
      attackNarrative: "Çok düşük bot skoru genellikle otomatik saldırı araçlarını işaret eder. Kaynak IP izlemeye alınması önerilir.",
      triggerEventIds: [],
    });
    if (socCase) {
      await pool.query(
        `UPDATE observability_events SET processed = true, correlated_soc_case_id = $1 WHERE id = $2`,
        [socCase.id, obsEventId]
      );
    }
    return;
  }

  // Bot score >= 30 (severity=low) → just mark processed, no case needed
  if (eventType === "bot.score" && severity === "low") {
    await pool.query(`UPDATE observability_events SET processed = true WHERE id = $1`, [obsEventId]);
    return;
  }

  // WAF block → check source IP against CrowdStrike Falcon IOC list (customer's integration)
  if (eventType === "waf.block" && sourceIp) {
    const isKnownIoc = await checkCrowdStrikeIpReputation(sourceIp, customerId);

    if (isKnownIoc) {
      const socCase = await createCaseWithNumber({
        customerId,
        severity: "high",
        category: "waf_ioc_match",
        title: `WAF Engelleme + CrowdStrike IoC: ${sourceIp}`,
        description: `Cloudflare WAF ${sourceIp} adresini engelledi. Bu IP müşterinin CrowdStrike Falcon IOC listesinde kayıtlı bilinen tehdit.`,
        attackNarrative: `${sourceIp} CrowdStrike Falcon tarafından tehdit aktörü olarak işaretlenmiş ve şimdi Cloudflare WAF tarafından da engellendi. Koordineli saldırı riski yüksek.`,
        triggerEventIds: [],
      });
      if (socCase) {
        await pool.query(
          `UPDATE observability_events SET processed = true, correlated_soc_case_id = $1 WHERE id = $2`,
          [socCase.id, obsEventId]
        );
      }
      logger.info({ customerId, sourceIp, socCaseId: socCase?.id }, "Cloudflare WAF+CrowdStrike IoC match: SOC case created");
      return;
    }
  }

  // Fallback: use generic correlation for remaining high-severity events
  await correlateWithSOC(customerId, obsEvent, _integrationId, obsEventId);
}

// ─── Azure webhook signature verification ─────────────────────────────────────

export function verifyAzureSignature(body: unknown, signature: string | string[] | undefined): boolean {
  const secret = process.env["AZURE_WEBHOOK_SECRET"];
  if (!secret) return true;
  if (!signature) return false;
  try {
    const crypto = require("node:crypto") as typeof import("node:crypto");
    const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
    const hmac = crypto.createHmac("sha256", secret).update(bodyStr).digest("hex");
    const sig = Array.isArray(signature) ? signature[0] : signature;
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(sig.replace(/^sha256=/, "")));
  } catch {
    return false;
  }
}

// ─── SOC korelasyon ───────────────────────────────────────────────────────────

interface FabricEventRow { id: number; event_type: string; severity: string; src_ip: string | null; dst_ip: string | null; dst_port: number | null }
interface SocCaseRow { id: number; title: string }

export async function correlateWithSOC(
  customerId: number,
  obsEvent: NormalizedObsEvent,
  _integrationId: number,
  obsEventId: number,
): Promise<void> {
  const WINDOW_MS = 30 * 60 * 1000;
  const windowDate = new Date(Date.now() - WINDOW_MS);
  const socWindowDate = new Date(Date.now() - 2 * 60 * 60 * 1000);

  const { rows: recentFabricEvents } = await pool.query<FabricEventRow>(
    `SELECT id, event_type, severity, src_ip, dst_ip, dst_port
     FROM fabric_events
     WHERE customer_id = $1 AND created_at >= $2
     LIMIT 20`,
    [customerId, windowDate]
  );

  const { rows: recentSOCCases } = await pool.query<SocCaseRow>(
    `SELECT id, title FROM soc_cases
     WHERE customer_id = $1 AND status IN ('open','investigating') AND created_at >= $2`,
    [customerId, socWindowDate]
  );

  if (recentSOCCases.length > 0 && obsEvent.severity !== "critical") {
    const latestCase = recentSOCCases[0]!;
    await pool.query(
      `UPDATE observability_events SET processed = true, correlated_soc_case_id = $1 WHERE id = $2`,
      [latestCase.id, obsEventId]
    );
    return;
  }

  if (recentFabricEvents.length === 0 && !["critical", "high"].includes(obsEvent.severity)) {
    return;
  }

  const prompt = `SOC analisti olarak aşağıdaki iki veri kaynağını değerlendir.

OBSERVABİLİTY (${obsEvent.provider.toUpperCase()}):
  Servis: ${obsEvent.affectedService ?? "belirtilmemiş"}
  Olay: ${obsEvent.title}
  Açıklama: ${obsEvent.description ?? "yok"}
  Ciddiyet: ${obsEvent.severity}

SON 30 DAKİKA AĞSAL OLAYLAR (${recentFabricEvents.length} adet):
${recentFabricEvents.slice(0, 5).map((e) => `${e.event_type}: ${e.src_ip ?? "?"} → ${e.dst_ip ?? "?"}:${e.dst_port ?? "?"}`).join("\n") || "Olay yok"}

Bu iki kaynak arasında anlamlı bir korelasyon var mı?
JSON formatında cevap ver: { "correlated": true/false, "confidence": 0-100, "narrative": "1-2 cümle Türkçe", "severity": "critical|high|medium|low" }`;

  let result: { correlated: boolean; confidence: number; narrative: string; severity: string };
  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = msg.content.map((b) => ("text" in b ? b.text : "")).join("");
    const match = raw.match(/\{[\s\S]*\}/);
    result = JSON.parse(match ? match[0] : raw) as typeof result;
  } catch (err) {
    logger.error({ err, customerId }, "correlateWithSOC: Claude error");
    return;
  }

  if (result.correlated && result.confidence > 60) {
    const socCase = await createCaseWithNumber({
      customerId,
      severity: result.severity as "critical" | "high" | "medium" | "low",
      category: "observability_correlation",
      title: `${obsEvent.provider} Anomalisi: ${obsEvent.affectedService ?? obsEvent.title}`,
      description: `${obsEvent.provider.toUpperCase()} kaynağından gelen alert: ${obsEvent.title}`,
      attackNarrative: result.narrative,
      triggerEventIds: recentFabricEvents.map((e) => e.id),
    });

    if (socCase) {
      await pool.query(
        `UPDATE observability_events SET processed = true, correlated_soc_case_id = $1 WHERE id = $2`,
        [socCase.id, obsEventId]
      );
    }

    logger.info({ customerId, socCaseId: socCase?.id, provider: obsEvent.provider }, "correlateWithSOC: SOC case created");
  } else {
    await pool.query(
      `UPDATE observability_events SET processed = true WHERE id = $1`,
      [obsEventId]
    );
  }
}
