/**
 * CyberStep AI NOC Service
 *
 * Passive model: we listen and analyse, never touch customer config.
 * Sprint 1: FortiGate REST API polling + HTTP availability checks + data ingest
 * Sprint 2: Claude 2-layer triage + 14-day baseline learning + SOC-NOC correlation
 */

import axios from "axios";
import https from "https";
import { and, eq, gte, isNotNull, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  nocIntegrationsTable,
  nocEventsTable,
  nocMetricsTable,
  nocCasesTable,
  nocAvailabilityTable,
  customersTable,
  socCasesTable,
  type NocIntegration,
  type NocCase,
} from "@workspace/db";
import { sql } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { encryptSecret, decryptSecret } from "./fabric-crypto";
import { logger } from "../lib/logger";
import { sendMail } from "./email";

// ─── Helpers ────────────────────────────────────────────────────────────────

export function generateSnmpToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function getDaysSince(date: Date | null | undefined): number {
  if (!date) return 0;
  return Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
}

async function generateNOCCaseNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(nocCasesTable);
  const seq = (Number(count) + 1).toString().padStart(5, "0");
  return `CS-NOC-${year}-${seq}`;
}

// ─── Claude helper ───────────────────────────────────────────────────────────

async function callClaude(
  prompt: string,
  model: "claude-haiku-4-5" | "claude-sonnet-4-6" = "claude-sonnet-4-6",
  maxTokens = 600,
): Promise<string> {
  const msg = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  const block = msg.content[0];
  return block.type === "text" ? block.text.trim() : "";
}

function extractJson(raw: string): Record<string, unknown> {
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : {};
  } catch {
    return {};
  }
}

// ─── Customer helper ─────────────────────────────────────────────────────────

async function getCustomer(customerId: number) {
  const [row] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, customerId));
  return row ?? null;
}

// ─── Alert helper ─────────────────────────────────────────────────────────────

async function sendNOCAlert(
  customerId: number,
  nocCase: NocCase,
  message: string,
) {
  const customer = await getCustomer(customerId);
  if (!customer?.email) return;
  await sendMail({
    to: customer.email,
    subject: `[NOC] ${nocCase.caseNumber} — ${nocCase.title ?? "Ağ Olayı"}`,
    html: `
      <p>Sayın ${customer.companyName ?? "Müşteri"},</p>
      <p>${message}</p>
      <p><strong>Case:</strong> ${nocCase.caseNumber}<br/>
         <strong>Öncelik:</strong> P${nocCase.priority} — ${nocCase.severity?.toUpperCase()}<br/>
         <strong>SLA Bitiş:</strong> ${nocCase.slaDeadline ? new Date(nocCase.slaDeadline).toLocaleString("tr-TR") : "—"}</p>
      <p>NOC dashboard'unuzdan detayları görüntüleyebilirsiniz.</p>
      <p>CyberStep NOC Ekibi</p>
    `,
  });
}

// ─── SPRINT 1: FortiGate REST API Polling ────────────────────────────────────

export async function pollFortiGateMetrics(
  integration: NocIntegration,
): Promise<void> {
  if (
    !integration.fortigateHost ||
    !integration.fortigateTokenEncrypted
  ) return;

  const token = decryptSecret(integration.fortigateTokenEncrypted);
  if (!token) return;

  const base = `https://${integration.fortigateHost}/api/v2`;
  const headers = { Authorization: `Bearer ${token}` };
  const agent = new https.Agent({ rejectUnauthorized: false });

  const [ifaceResult, resResult] = await Promise.allSettled([
    axios.get(`${base}/monitor/system/interface?include_vlan=true`, {
      headers,
      httpsAgent: agent,
      timeout: 10_000,
    }),
    axios.get(`${base}/monitor/system/resource/usage`, {
      headers,
      httpsAgent: agent,
      timeout: 10_000,
    }),
  ]);

  const now = new Date();
  const rows: Array<typeof nocMetricsTable.$inferInsert> = [];
  const eventsToCreate: Array<typeof nocEventsTable.$inferInsert> = [];

  if (ifaceResult.status === "fulfilled") {
    const interfaces: unknown[] = ifaceResult.value.data?.results ?? [];
    for (const iface of interfaces as Record<string, unknown>[]) {
      const name = iface.name as string | undefined;
      if (!name || (!name.startsWith("wan") && !name.startsWith("port"))) continue;

      const speedKbps = (iface.speed as number | undefined) ?? 1_000_000; // kbps
      const rxKbps = (iface.rx_bandwidth as number | undefined) ?? 0;
      const txKbps = (iface.tx_bandwidth as number | undefined) ?? 0;
      const inPct = speedKbps > 0 ? (rxKbps / speedKbps) * 100 : 0;
      const outPct = speedKbps > 0 ? (txKbps / speedKbps) * 100 : 0;

      rows.push(
        { integrationId: integration.id, customerId: integration.customerId, deviceIp: integration.fortigateHost ?? "", interfaceName: name, metricType: "bandwidth_in", value: String(rxKbps), unit: "Kbps", recordedAt: now },
        { integrationId: integration.id, customerId: integration.customerId, deviceIp: integration.fortigateHost ?? "", interfaceName: name, metricType: "bandwidth_out", value: String(txKbps), unit: "Kbps", recordedAt: now },
        { integrationId: integration.id, customerId: integration.customerId, deviceIp: integration.fortigateHost ?? "", interfaceName: name, metricType: "bandwidth_in_pct", value: String(inPct.toFixed(2)), unit: "%", recordedAt: now },
        { integrationId: integration.id, customerId: integration.customerId, deviceIp: integration.fortigateHost ?? "", interfaceName: name, metricType: "bandwidth_out_pct", value: String(outPct.toFixed(2)), unit: "%", recordedAt: now },
      );

      const criticalPct = Number(integration.bandwidthCriticalPct ?? 90);
      const warningPct = Number(integration.bandwidthWarningPct ?? 70);
      const peakPct = Math.max(inPct, outPct);

      if (peakPct > criticalPct) {
        eventsToCreate.push({
          integrationId: integration.id,
          customerId: integration.customerId!,
          source: "api_poll",
          deviceIp: integration.fortigateHost ?? "",
          deviceName: `FortiGate (${integration.fortigateHost})`,
          deviceType: "fortigate",
          interfaceName: name,
          eventType: "bandwidth_high",
          severity: "critical",
          metricName: "bandwidth_utilization",
          metricValue: String(peakPct.toFixed(2)),
          metricUnit: "%",
          metricThreshold: String(criticalPct),
          title: `${name} — Kritik Bant Genişliği Kullanımı %${peakPct.toFixed(0)}`,
          description: `Arayüz ${name} bant genişliği kullanımı %${criticalPct} kritik eşiğini aştı (şu an %${peakPct.toFixed(1)}).`,
          occurredAt: now,
        });
      } else if (peakPct > warningPct) {
        eventsToCreate.push({
          integrationId: integration.id,
          customerId: integration.customerId!,
          source: "api_poll",
          deviceIp: integration.fortigateHost ?? "",
          deviceName: `FortiGate (${integration.fortigateHost})`,
          deviceType: "fortigate",
          interfaceName: name,
          eventType: "bandwidth_high",
          severity: "high",
          metricName: "bandwidth_utilization",
          metricValue: String(peakPct.toFixed(2)),
          metricUnit: "%",
          metricThreshold: String(warningPct),
          title: `${name} — Yüksek Bant Genişliği Kullanımı %${peakPct.toFixed(0)}`,
          description: `Arayüz ${name} bant genişliği kullanımı %${warningPct} uyarı eşiğini aştı.`,
          occurredAt: now,
        });
      }
    }
  }

  if (resResult.status === "fulfilled") {
    const res = resResult.value.data?.results;
    if (res?.cpu?.[0]?.current != null) {
      rows.push({
        integrationId: integration.id, customerId: integration.customerId,
        deviceIp: integration.fortigateHost ?? "", interfaceName: "system",
        metricType: "cpu", value: String(res.cpu[0].current), unit: "%", recordedAt: now,
      });
    }
    if (res?.mem?.[0]?.current != null) {
      rows.push({
        integrationId: integration.id, customerId: integration.customerId,
        deviceIp: integration.fortigateHost ?? "", interfaceName: "system",
        metricType: "memory", value: String(res.mem[0].current), unit: "%", recordedAt: now,
      });
    }
  }

  if (rows.length > 0) {
    await db.insert(nocMetricsTable).values(rows);
    // Update baseline with new metrics
    if (integration.baselineLearning) {
      await updateBaseline(integration, rows);
    }
  }
  if (eventsToCreate.length > 0) {
    await db.insert(nocEventsTable).values(eventsToCreate);
    await db.update(nocIntegrationsTable)
      .set({ totalEvents: sql`total_events + ${eventsToCreate.length}` })
      .where(eq(nocIntegrationsTable.id, integration.id));
  }

  await db.update(nocIntegrationsTable)
    .set({ fortigateLastPolledAt: now, updatedAt: now })
    .where(eq(nocIntegrationsTable.id, integration.id));
}

// ─── SPRINT 1: HTTP Availability Monitor ─────────────────────────────────────

export async function checkAvailability(
  integration: NocIntegration,
): Promise<void> {
  const devices = (integration.monitoredDevices ?? []) as Array<{
    ip: string; name: string; type?: string; critical?: boolean;
  }>;
  const services = (integration.monitoredServices ?? []) as Array<{
    url: string; name: string; checkType?: string; critical?: boolean;
  }>;

  const now = new Date();
  const availRows: Array<typeof nocAvailabilityTable.$inferInsert> = [];
  const eventRows: Array<typeof nocEventsTable.$inferInsert> = [];

  // HTTP-based device check (ICMP not available in Replit sandbox)
  for (const device of devices) {
    try {
      const start = Date.now();
      const resp = await axios.get(`http://${device.ip}`, {
        timeout: 5_000,
        validateStatus: null,
      });
      const latency = Date.now() - start;
      const isUp = resp.status < 600;
      availRows.push({
        integrationId: integration.id, customerId: integration.customerId,
        targetType: "device", targetIdentifier: device.ip,
        isUp, checkLatencyMs: latency, checkedAt: now,
      });
      if (!isUp && device.critical) {
        eventRows.push({
          integrationId: integration.id, customerId: integration.customerId!,
          source: "http_check", deviceIp: device.ip, deviceName: device.name,
          deviceType: device.type ?? "unknown", eventType: "device_unreachable",
          severity: "critical",
          title: `${device.name} — Cihaz Erişilemiyor`,
          description: `${device.ip} adresine bağlantı kurulamadı.`,
          occurredAt: now,
        });
      }
    } catch {
      availRows.push({
        integrationId: integration.id, customerId: integration.customerId,
        targetType: "device", targetIdentifier: device.ip,
        isUp: false, checkedAt: now,
      });
      if (device.critical) {
        eventRows.push({
          integrationId: integration.id, customerId: integration.customerId!,
          source: "http_check", deviceIp: device.ip, deviceName: device.name,
          deviceType: device.type ?? "unknown", eventType: "device_unreachable",
          severity: "critical",
          title: `${device.name} — Cihaz Erişilemiyor`,
          description: `${device.ip} adresine bağlantı kurulamadı (timeout).`,
          occurredAt: now,
        });
      }
    }
    await sleep(200);
  }

  // HTTP service checks
  for (const svc of services) {
    try {
      const start = Date.now();
      const resp = await axios.get(svc.url, {
        timeout: 10_000,
        validateStatus: null,
      });
      const latency = Date.now() - start;
      const isUp = resp.status >= 200 && resp.status < 400;
      availRows.push({
        integrationId: integration.id, customerId: integration.customerId,
        targetType: "service", targetIdentifier: svc.url,
        isUp, checkLatencyMs: latency, checkedAt: now,
      });

      const latencyWarnMs = Number(integration.latencyWarningMs ?? 100);
      if (!isUp && svc.critical) {
        eventRows.push({
          integrationId: integration.id, customerId: integration.customerId!,
          source: "http_check", deviceName: svc.name,
          eventType: "device_unreachable", severity: "critical",
          title: `${svc.name} — Servis Erişilemiyor (HTTP ${resp.status})`,
          description: `${svc.url} adresi HTTP ${resp.status} döndürdü.`,
          occurredAt: now,
        });
      } else if (isUp && latency > latencyWarnMs) {
        eventRows.push({
          integrationId: integration.id, customerId: integration.customerId!,
          source: "http_check", deviceName: svc.name,
          eventType: "latency_high", severity: "medium",
          metricName: "latency", metricValue: String(latency), metricUnit: "ms",
          metricThreshold: String(latencyWarnMs),
          title: `${svc.name} — Yüksek Gecikme ${latency}ms`,
          description: `${svc.url} servisi ${latency}ms gecikmeyle yanıt veriyor (eşik: ${latencyWarnMs}ms).`,
          occurredAt: now,
        });
      }
    } catch {
      availRows.push({
        integrationId: integration.id, customerId: integration.customerId,
        targetType: "service", targetIdentifier: svc.url,
        isUp: false, checkedAt: now,
      });
      if (svc.critical) {
        eventRows.push({
          integrationId: integration.id, customerId: integration.customerId!,
          source: "http_check", deviceName: svc.name,
          eventType: "device_unreachable", severity: "critical",
          title: `${svc.name} — Servis Erişilemiyor`,
          description: `${svc.url} adresine bağlantı kurulamadı.`,
          occurredAt: now,
        });
      }
    }
    await sleep(200);
  }

  if (availRows.length > 0) await db.insert(nocAvailabilityTable).values(availRows);
  if (eventRows.length > 0) {
    await db.insert(nocEventsTable).values(eventRows);
    await db.update(nocIntegrationsTable)
      .set({ totalEvents: sql`total_events + ${eventRows.length}` })
      .where(eq(nocIntegrationsTable.id, integration.id));
  }

  // Update uptime percentage (last 30 days)
  await updateUptimePercentage(integration);
}

async function updateUptimePercentage(integration: NocIntegration) {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const rows = await db
    .select({ isUp: nocAvailabilityTable.isUp })
    .from(nocAvailabilityTable)
    .where(
      and(
        eq(nocAvailabilityTable.integrationId, integration.id),
        gte(nocAvailabilityTable.checkedAt, since),
      ),
    );
  if (rows.length === 0) return;
  const pct = (rows.filter((r) => r.isUp).length / rows.length) * 100;
  await db.update(nocIntegrationsTable)
    .set({ uptimeThisMonthPct: pct.toFixed(2) })
    .where(eq(nocIntegrationsTable.id, integration.id));
}

// ─── SPRINT 2: Baseline Learning ─────────────────────────────────────────────

export async function updateBaseline(
  integration: NocIntegration,
  newMetrics: Array<typeof nocMetricsTable.$inferInsert>,
): Promise<void> {
  const baseline = (integration.baselineData ?? {}) as Record<string, {
    samples: number; sum: number; min: number; max: number; avg: number;
    hourly_avg: Record<number, { sum: number; count: number }>;
  }>;

  for (const metric of newMetrics) {
    const key = `${metric.interfaceName}_${metric.metricType}`;
    const val = Number(metric.value ?? 0);
    const hour = metric.recordedAt instanceof Date
      ? metric.recordedAt.getHours()
      : new Date().getHours();

    if (!baseline[key]) {
      baseline[key] = { samples: 0, sum: 0, min: val, max: val, avg: val, hourly_avg: {} };
    }
    const b = baseline[key];
    b.samples++;
    b.sum += val;
    b.avg = b.sum / b.samples;
    b.min = Math.min(b.min, val);
    b.max = Math.max(b.max, val);
    if (!b.hourly_avg[hour]) b.hourly_avg[hour] = { sum: 0, count: 0 };
    b.hourly_avg[hour].sum += val;
    b.hourly_avg[hour].count++;
  }

  const days = getDaysSince(integration.createdAt);
  const completed = days >= 14 && integration.baselineLearning;

  await db.update(nocIntegrationsTable)
    .set({
      baselineData: baseline,
      ...(completed ? {
        baselineLearning: false,
        baselineCompletedAt: new Date(),
      } : {}),
      updatedAt: new Date(),
    })
    .where(eq(nocIntegrationsTable.id, integration.id));

  if (completed) {
    const customer = await getCustomer(integration.customerId!);
    if (customer?.email) {
      await sendMail({
        to: customer.email,
        subject: "NOC Baseline Öğrenimi Tamamlandı — Tam Anomali Tespiti Aktif",
        html: `
          <p>Sayın ${customer.companyName ?? "Müşteri"},</p>
          <p>CyberStep NOC sistemi, ağınızın 14 günlük normal davranışını öğrenmeyi tamamladı.</p>
          <p>Artık gerçek zamanlı anomali tespiti aktif. Baseline'dan sapan durumlar size bildirilecek.</p>
          <p>CyberStep NOC Ekibi</p>
        `,
      });
    }
  }
}

export async function checkAndCompleteBaselines(): Promise<void> {
  const learning = await db.select()
    .from(nocIntegrationsTable)
    .where(eq(nocIntegrationsTable.baselineLearning, true));

  for (const integ of learning) {
    const days = getDaysSince(integ.createdAt);
    if (days >= 14) {
      await db.update(nocIntegrationsTable)
        .set({ baselineLearning: false, baselineCompletedAt: new Date(), updatedAt: new Date() })
        .where(eq(nocIntegrationsTable.id, integ.id));
      logger.info({ integrationId: integ.id }, "NOC baseline completed");
    }
  }
}

// ─── SPRINT 2: Claude 2-layer NOC Triage ─────────────────────────────────────

export async function triageNOCEvent(event: typeof nocEventsTable.$inferSelect): Promise<void> {
  const [integration] = await db.select()
    .from(nocIntegrationsTable)
    .where(eq(nocIntegrationsTable.id, event.integrationId!));

  if (!integration) return;

  // Baseline period: only process critical events
  if (integration.baselineLearning) {
    if (!["critical"].includes(event.severity)) {
      await db.update(nocEventsTable)
        .set({ processed: true, processedAt: new Date() })
        .where(eq(nocEventsTable.id, event.id));
      return;
    }
  }

  // Check for existing open case for this device
  const [existingCase] = await db.select()
    .from(nocCasesTable)
    .where(
      and(
        eq(nocCasesTable.customerId, event.customerId!),
        inArray(nocCasesTable.status, ["open", "investigating"]),
      ),
    )
    .limit(1);

  if (existingCase) {
    await db.update(nocEventsTable)
      .set({ processed: true, processedAt: new Date(), nocCaseId: existingCase.id })
      .where(eq(nocEventsTable.id, event.id));
    return;
  }

  // Layer 1: Claude Haiku — noise filter
  let shouldEscalate = true;
  try {
    const haikuPrompt = `NOC olayı:
Tip: ${event.eventType}
Cihaz: ${event.deviceName ?? event.deviceIp} (${event.deviceIp})
Metrik: ${event.metricName ?? "—"} = ${event.metricValue ?? "—"} ${event.metricUnit ?? ""}
Açıklama: ${event.description}
Severity: ${event.severity}

Gerçek sorun mu, gürültü mü? JSON: {"real": true/false, "confidence": 0-100, "reason": "tek cümle"}`;

    const haikuRaw = await callClaude(haikuPrompt, "claude-haiku-4-5", 100);
    const haikuResult = extractJson(haikuRaw) as { real?: boolean; confidence?: number };
    if (haikuResult.real === false && (haikuResult.confidence ?? 0) > 75) {
      shouldEscalate = false;
    }
  } catch (e) {
    logger.error({ err: e }, "NOC Haiku triage failed, escalating anyway");
  }

  if (!shouldEscalate) {
    await db.update(nocEventsTable)
      .set({ processed: true, processedAt: new Date(), claudeAnalysis: { tier: 1, action: "noise_filtered" } })
      .where(eq(nocEventsTable.id, event.id));
    return;
  }

  // Layer 2: Claude Sonnet — full analysis
  let analysis: Record<string, unknown> = {};
  try {
    const recentSOCCases = await db.select()
      .from(socCasesTable)
      .where(
        and(
          eq(socCasesTable.customerId, event.customerId!),
          inArray(socCasesTable.status, ["open", "investigating"]),
          gte(socCasesTable.createdAt, new Date(Date.now() - 60 * 60_000)),
        ),
      )
      .limit(5);

    const customer = await getCustomer(event.customerId!);

    const sonnetPrompt = `Sen CyberStep'in AI NOC analisti ve ağ uzmanısın. Passive NOC: müşteri ağına hiçbir zaman müdahale etmiyoruz, sadece izliyoruz.

MÜŞTERİ: ${customer?.companyName ?? "Bilinmiyor"}
NOC Tier: ${integration.nocTier}

ANA OLAY:
  Cihaz: ${event.deviceName ?? event.deviceIp}
  Tip: ${event.eventType}
  Açıklama: ${event.description}
  Severity: ${event.severity}
  Zaman: ${event.occurredAt}

EŞ ZAMANLI GÜVENLİK OLAYLARI (son 1 saat):
${recentSOCCases.length > 0
  ? recentSOCCases.map((c) => `- ${c.category}: ${c.title}`).join("\n")
  : "Yok"}

BASELINE DURUMU: ${integration.baselineLearning ? "Öğreniyor (14 gün)" : "Tamamlandı"}

JSON YANIT (başka hiçbir şey yazma):
{
  "severity": "critical|high|medium|low",
  "priority": 1-4,
  "event_category": "outage|degradation|anomaly|capacity|security_related",
  "root_cause_hypothesis": "Teknik neden — anlaşılır dil",
  "business_impact": "İş etkisi — kısa",
  "is_security_related": true/false,
  "security_correlation": "SOC ile bağlantı varsa açıkla",
  "recommended_actions": ["Müşterinin yapacakları"],
  "customer_message": "Türkçe müşteri mesajı — teknik değil",
  "should_notify": true/false,
  "auto_resolve_expected": true/false,
  "auto_resolve_minutes": 30
}`;

    const sonnetRaw = await callClaude(sonnetPrompt, "claude-sonnet-4-6", 700);
    analysis = extractJson(sonnetRaw);
  } catch (e) {
    logger.error({ err: e }, "NOC Sonnet triage failed");
    analysis = {
      severity: event.severity,
      priority: event.severity === "critical" ? 1 : event.severity === "high" ? 2 : 3,
      event_category: "anomaly",
      root_cause_hypothesis: event.description,
      should_notify: event.severity === "critical",
    };
  }

  // Create NOC case
  let caseNumber: string;
  try {
    caseNumber = await generateNOCCaseNumber();
  } catch {
    caseNumber = `CS-NOC-${Date.now()}`;
  }

  const priorityMap: Record<string, number> = { critical: 1, high: 2, medium: 3, low: 4 };
  const slaMins: Record<string, number> = { critical: 15, high: 60, medium: 240, low: 720 };
  const sev = (analysis.severity as string) || event.severity;
  const slaMin = slaMins[sev] ?? 240;

  let nocCase: NocCase | null = null;
  try {
    [nocCase] = await db.insert(nocCasesTable).values({
      caseNumber,
      customerId: event.customerId!,
      caseType: (analysis.event_category as string) || "other",
      severity: sev,
      priority: priorityMap[sev] ?? 3,
      title: event.title,
      description: event.description,
      rootCauseAnalysis: (analysis.root_cause_hypothesis as string) || undefined,
      affectedDevices: event.deviceName ? [event.deviceName] : [],
      isSecurityRelated: (analysis.is_security_related as boolean) || false,
      slaMinutes: slaMin,
      slaDeadline: new Date(Date.now() + slaMin * 60_000),
      status: "open",
    }).returning();
  } catch (e) {
    logger.error({ err: e }, "NOC case insert failed");
  }

  // Link event to case
  await db.update(nocEventsTable)
    .set({
      processed: true,
      processedAt: new Date(),
      claudeAnalysis: analysis,
      nocCaseId: nocCase?.id,
      alertSent: (analysis.should_notify as boolean) || false,
    })
    .where(eq(nocEventsTable.id, event.id));

  // SOC-NOC correlation
  if (analysis.is_security_related && nocCase) {
    await correlateNOCWithSOC(nocCase, (analysis.security_correlation as string) || "");
  }

  // Notify customer
  if (analysis.should_notify && nocCase) {
    setImmediate(async () => {
      try {
        await sendNOCAlert(
          event.customerId!,
          nocCase!,
          (analysis.customer_message as string) || `Ağ olayı tespit edildi: ${event.title}`,
        );
        await db.update(nocCasesTable)
          .set({ customerNotifiedAt: new Date() })
          .where(eq(nocCasesTable.id, nocCase!.id));
      } catch (e) {
        logger.error({ err: e }, "NOC customer notification failed");
      }
    });
  }

  await db.update(nocIntegrationsTable)
    .set({ totalAlerts: sql`total_alerts + 1` })
    .where(eq(nocIntegrationsTable.id, integration.id));
}

// ─── SPRINT 2: SOC-NOC Correlation ───────────────────────────────────────────

export async function correlateNOCWithSOC(
  nocCase: NocCase,
  correlationHint: string,
): Promise<void> {
  const recentSOCCases = await db.select()
    .from(socCasesTable)
    .where(
      and(
        eq(socCasesTable.customerId, nocCase.customerId!),
        inArray(socCasesTable.status, ["open", "investigating"]),
        gte(socCasesTable.createdAt, new Date(Date.now() - 60 * 60_000)),
      ),
    )
    .limit(1);

  if (recentSOCCases.length > 0) {
    await db.update(nocCasesTable)
      .set({ relatedSocCaseId: recentSOCCases[0].id, isSecurityRelated: true })
      .where(eq(nocCasesTable.id, nocCase.id));

    logger.info(
      { nocCaseId: nocCase.id, socCaseId: recentSOCCases[0].id, hint: correlationHint },
      "NOC-SOC correlation created",
    );
  }
}

// ─── SPRINT 1: SNMP / Syslog ingest helper ───────────────────────────────────

export async function ingestNOCEvent(
  token: string,
  source: "snmp_trap" | "netflow" | "syslog",
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; eventId?: number }> {
  const [integration] = await db.select()
    .from(nocIntegrationsTable)
    .where(
      source === "netflow"
        ? eq(nocIntegrationsTable.netflowToken, token)
        : eq(nocIntegrationsTable.snmpToken, token),
    );

  if (!integration) return { ok: false };

  const eventType = (payload.event_type as string) || "unknown_trap";
  const severity = (payload.severity as string) || "medium";

  const [event] = await db.insert(nocEventsTable).values({
    integrationId: integration.id,
    customerId: integration.customerId!,
    source,
    deviceIp: (payload.device_ip as string) || (payload.source_ip as string) || undefined,
    deviceName: (payload.device_name as string) || undefined,
    deviceType: (payload.device_type as string) || undefined,
    interfaceName: (payload.interface_name as string) || undefined,
    eventType,
    severity,
    metricName: (payload.metric_name as string) || undefined,
    metricValue: payload.metric_value != null ? String(payload.metric_value) : undefined,
    metricUnit: (payload.metric_unit as string) || undefined,
    title: (payload.title as string) || `${source} olayı — ${eventType}`,
    description: (payload.description as string) || JSON.stringify(payload),
    rawData: payload,
    occurredAt: new Date(),
  }).returning();

  await db.update(nocIntegrationsTable)
    .set({
      snmpLastReceivedAt: new Date(),
      snmpTrapCount: sql`snmp_trap_count + 1`,
      totalEvents: sql`total_events + 1`,
    })
    .where(eq(nocIntegrationsTable.id, integration.id));

  return { ok: true, eventId: event.id };
}

// ─── Cron entry points ───────────────────────────────────────────────────────

export async function runFortiGatePollCron(): Promise<void> {
  const active = await db.select()
    .from(nocIntegrationsTable)
    .where(
      and(
        eq(nocIntegrationsTable.fortigatePollingEnabled, true),
        isNotNull(nocIntegrationsTable.fortigateHost),
      ),
    );

  for (const integ of active) {
    try {
      await pollFortiGateMetrics(integ);
    } catch (e) {
      logger.error({ err: e, integrationId: integ.id }, "FortiGate poll failed");
    }
    await sleep(200);
  }
}

export async function runAvailabilityCron(): Promise<void> {
  const active = await db.select()
    .from(nocIntegrationsTable)
    .where(eq(nocIntegrationsTable.snmpTrapEnabled, true));

  for (const integ of active) {
    try {
      await checkAvailability(integ);
    } catch (e) {
      logger.error({ err: e, integrationId: integ.id }, "Availability check failed");
    }
    await sleep(300);
  }
}

export async function runNOCTriageCron(): Promise<void> {
  const unprocessed = await db.select()
    .from(nocEventsTable)
    .where(eq(nocEventsTable.processed, false))
    .limit(50);

  for (const event of unprocessed) {
    try {
      await triageNOCEvent(event);
    } catch (e) {
      logger.error({ err: e, eventId: event.id }, "NOC triage failed");
    }
    await sleep(200);
  }
}

// ─── Integration CRUD ────────────────────────────────────────────────────────

export async function getOrCreateNOCIntegration(
  customerId: number,
  tier: string = "lite",
): Promise<NocIntegration> {
  const [existing] = await db.select()
    .from(nocIntegrationsTable)
    .where(eq(nocIntegrationsTable.customerId, customerId));

  if (existing) return existing;

  const snmpToken = generateSnmpToken();
  const netflowToken = generateSnmpToken();

  const [created] = await db.insert(nocIntegrationsTable).values({
    customerId,
    nocTier: tier,
    snmpToken,
    netflowToken,
    snmpTrapEnabled: true,
  }).returning();

  return created;
}

export { encryptSecret, decryptSecret };
