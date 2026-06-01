/**
 * 4-layer SOC triage pipeline for Fortinet fabric events.
 *
 *   Tier 0 (rules, free):   whitelist · duplicate batching · already-blocked ·
 *                           known-IoC auto-block
 *   Tier 1 (Haiku, fast):   cheap classify — benign vs. needs-investigation
 *   Tier 2 (Sonnet, deep):  full case analysis → case creation + playbook + notify
 *
 * Each event is marked triaged (`socTriaged*` columns) so the queue cron does
 * not reprocess it. Real-time `new_alert` / `case_created` events are broadcast.
 */

import {
  db,
  fabricEventsTable,
  customersTable,
  type FabricEvent,
} from "@workspace/db";
import { eq, and, desc, inArray, isNull } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { callClaudeWithCost, extractJson, SOC_MODEL_FAST, SOC_MODEL_DEEP } from "./soc-claude";
import { socCacheGet, socCacheSet, socCacheKey } from "./soc-cache";
import {
  createCaseWithNumber, updateCase, getSLAConfig, logSOCActivity,
  getCustomerWhitelist, checkIPAlreadyBlocked, checkIOCRegistry,
} from "./soc-cases";
import { findMatchingPlaybook, executePlaybook } from "./soc-playbook";
import { sendSOCNotification } from "./soc-notify";
import { scheduleEscalationCheck } from "./soc-escalation";
import { emitSOC } from "./soc-events";

export type TriageAction =
  | "skip"
  | "batch"
  | "false_positive"
  | "log_and_watch"
  | "auto_block"
  | "case_created";

export interface TriageResult {
  action: TriageAction;
  level: number;
  caseId?: number;
  reason: string;
}

const SEVERITIES = ["critical", "high", "medium", "low"] as const;
type Severity = (typeof SEVERITIES)[number];

function normSeverity(s: unknown, fallback: Severity = "medium"): Severity {
  return SEVERITIES.includes(s as Severity) ? (s as Severity) : fallback;
}

async function markTriaged(eventIds: number[], level: number, action: TriageAction): Promise<void> {
  if (eventIds.length === 0) return;
  await db.update(fabricEventsTable)
    .set({ socTriaged: true, socTriagedAt: new Date(), socTriageLevel: level, socTriageAction: action })
    .where(inArray(fabricEventsTable.id, eventIds));
}

async function getCustomerTier(customerId: number): Promise<"lite" | "standart" | "pro"> {
  const [c] = await db.select({ socTier: customersTable.socTier }).from(customersTable).where(eq(customersTable.id, customerId));
  const tier = c?.socTier;
  return tier === "lite" || tier === "standart" || tier === "pro" ? tier : "standart";
}

async function computeSla(tier: string, severity: string): Promise<{ slaTier: string; deadline: Date | null; responseMinutes: number }> {
  const cfg = await getSLAConfig(tier, severity);
  const responseMinutes = cfg?.responseMinutes ?? (severity === "critical" ? 15 : severity === "high" ? 60 : severity === "medium" ? 240 : 1440);
  return { slaTier: `${tier}_${severity}`, deadline: new Date(Date.now() + responseMinutes * 60 * 1000), responseMinutes };
}

// ─── Tier 1: fast classification ──────────────────────────────────────────────

interface FastVerdict {
  benign: boolean;
  severity: Severity;
  category: string;
  reason: string;
}

async function fastTriage(event: FabricEvent, customerId: number): Promise<FastVerdict | null> {
  const prompt = `Bir SOC ön-triyaj filtresisin. Aşağıdaki güvenlik olayını hızlıca sınıflandır.

OLAY:
- tip: ${event.eventType}
- önem: ${event.severity}
- aksiyon: ${event.action ?? "-"}
- kaynak IP: ${event.srcIp ?? "-"}
- hedef: ${event.dstIp ?? "-"}:${event.dstPort ?? "-"}
- saldırı: ${event.attackName ?? "-"}
- mesaj: ${(event.message ?? "").slice(0, 200)}

SADECE şu JSON ile yanıt ver:
{"benign": true/false, "severity": "critical|high|medium|low", "category": "ransomware|brute_force|c2|malware|exploit|recon|policy|other", "reason": "tek cümle Türkçe gerekçe"}

benign=true sadece açıkça zararsız/gürültü olaylar için (ör. normal trafik, bilinen tarama gürültüsü). Şüphe varsa benign=false.`;

  try {
    const [text] = await callClaudeWithCost(prompt, SOC_MODEL_FAST, { customerId, useCase: "triage_fast" });
    const json = extractJson(text) as Partial<FastVerdict> | null;
    if (!json) return null;
    return {
      benign: Boolean(json.benign),
      severity: normSeverity(json.severity),
      category: String(json.category ?? "other"),
      reason: String(json.reason ?? ""),
    };
  } catch (err) {
    logger.warn({ err, eventId: event.id }, "Fast triage failed");
    return null;
  }
}

// ─── Tier 2: deep analysis → case ─────────────────────────────────────────────

interface DeepAnalysis {
  title: string;
  narrative: string;
  severity: Severity;
  category: string;
  recommendedAction: string;
  affectedAssets: string[];
  suspectIps: string[];
  mitreTechniques: Array<{ id: string; name: string }>;
  shouldBlock: boolean;
}

async function deepAnalyze(events: FabricEvent[], customerId: number): Promise<DeepAnalysis | null> {
  const eventLines = events.map((e, i) =>
    `${i + 1}. [${e.severity}] tip=${e.eventType} aksiyon=${e.action ?? "-"} kaynak=${e.srcIp ?? "-"} hedef=${e.dstIp ?? "-"}:${e.dstPort ?? "-"} saldırı=${e.attackName ?? "-"} mesaj=${(e.message ?? "").slice(0, 160)}`,
  ).join("\n");

  const prompt = `Sen kıdemli bir SOC analistisin. Aşağıdaki ilişkili güvenlik olaylarını analiz edip tek bir vaka (incident) çıkar. Türkçe, yöneticinin anlayacağı sade "patron dili" kullan.

OLAYLAR (${events.length} adet):
${eventLines}

SADECE şu JSON ile yanıt ver:
{
  "title": "kısa vaka başlığı",
  "narrative": "2-4 cümle, ne oluyor ve neden önemli (sade Türkçe)",
  "severity": "critical|high|medium|low",
  "category": "ransomware|brute_force|c2|malware|exploit|recon|policy|other",
  "recommendedAction": "atılması gereken en kritik tek aksiyon",
  "affectedAssets": ["etkilenen IP/varlıklar"],
  "suspectIps": ["şüpheli saldırgan IP'ler"],
  "mitreTechniques": [{"id":"T1110","name":"Brute Force"}],
  "shouldBlock": true/false
}`;

  try {
    const [text] = await callClaudeWithCost(prompt, SOC_MODEL_DEEP, { customerId, useCase: "triage_deep" });
    const json = extractJson(text) as Partial<DeepAnalysis> | null;
    if (!json || !json.title || !json.narrative) return null;
    return {
      title: String(json.title),
      narrative: String(json.narrative),
      severity: normSeverity(json.severity),
      category: String(json.category ?? "other"),
      recommendedAction: String(json.recommendedAction ?? ""),
      affectedAssets: Array.isArray(json.affectedAssets) ? json.affectedAssets.map(String).slice(0, 30) : [],
      suspectIps: Array.isArray(json.suspectIps) ? json.suspectIps.map(String).slice(0, 30) : [],
      mitreTechniques: Array.isArray(json.mitreTechniques)
        ? json.mitreTechniques.slice(0, 12).map((t) => ({ id: String(t.id ?? ""), name: String(t.name ?? "") }))
        : [],
      shouldBlock: Boolean(json.shouldBlock),
    };
  } catch (err) {
    logger.warn({ err, customerId }, "Deep analysis failed");
    return null;
  }
}

// ─── Case creation from deep analysis ─────────────────────────────────────────

async function openCase(customerId: number, events: FabricEvent[], analysis: DeepAnalysis): Promise<number | null> {
  const tier = await getCustomerTier(customerId);
  const { slaTier, deadline, responseMinutes } = await computeSla(tier, analysis.severity);

  const created = await createCaseWithNumber({
    customerId,
    triggerEventIds: events.map((e) => e.id),
    severity: analysis.severity,
    category: analysis.category,
    title: analysis.title,
    description: analysis.recommendedAction,
    attackNarrative: analysis.narrative,
    affectedAssets: analysis.affectedAssets.length ? analysis.affectedAssets : analysis.suspectIps,
    mitreTechniques: analysis.mitreTechniques,
    status: "open",
    assignedTo: "auto",
    slaTier,
    slaDeadline: deadline,
  });
  if (!created) return null;

  await logSOCActivity({
    caseId: created.id, actorType: "ai", actorName: "Triage AI", actionType: "created",
    description: `Vaka oluşturuldu: ${analysis.title}`,
    details: { severity: analysis.severity, category: analysis.category, slaTier },
  });

  emitSOC({
    type: "case_created", customerId, caseId: created.id,
    data: { caseNumber: created.caseNumber, title: analysis.title, severity: analysis.severity, category: analysis.category },
  });
  emitSOC({
    type: "new_alert", customerId, caseId: created.id,
    data: { title: analysis.title, severity: analysis.severity, narrative: analysis.narrative },
  });

  // Initial customer notification
  await sendSOCNotification(customerId, created.id, {
    title: analysis.title,
    severity: analysis.severity,
    narrative: analysis.narrative,
    recommendedAction: analysis.recommendedAction,
    caseNumber: created.caseNumber,
    suspectIps: analysis.suspectIps,
  }, ["email"]);
  await updateCase(created.id, { customerNotifiedAt: new Date() });

  // Trigger a matching auto playbook
  const playbookId = await findMatchingPlaybook(analysis.category, analysis.severity);
  if (playbookId) {
    void executePlaybook(playbookId, created.id, {
      customerId,
      ip: analysis.suspectIps[0] ?? analysis.affectedAssets[0] ?? null,
      suspectIps: analysis.suspectIps,
      channels: ["email"],
    }).catch((err) => logger.warn({ err, caseId: created.id }, "Playbook execution failed"));
  }

  // Ack timer — escalate if not acknowledged within the response window
  scheduleEscalationCheck(created.id, responseMinutes);

  // ServiceNow incident aç — entegrasyon yapılandırılmışsa arka planda tetikle
  setImmediate(() => {
    import("../serviceNowClient").then(({ openServiceNowIncident }) =>
      openServiceNowIncident(customerId, created.id, {
        caseId: created.id,
        caseNumber: created.caseNumber,
        title: analysis.title,
        description: analysis.recommendedAction ?? "",
        severity: analysis.severity,
        category: analysis.category,
      })
    ).catch((err) => logger.warn({ err, caseId: created.id }, "ServiceNow incident open failed"));
  });

  // KVKK 12. Madde değerlendirmesi — ilgili kategorilerde arka planda tetikle
  setImmediate(() => {
    import("../kvkkAssessor").then(({ triggerKvkkAssessment }) =>
      triggerKvkkAssessment(customerId, created.id, {
        caseId: created.id,
        caseNumber: created.caseNumber,
        title: analysis.title,
        description: analysis.recommendedAction ?? null,
        attackNarrative: analysis.narrative ?? null,
        severity: analysis.severity,
        category: analysis.category,
        affectedAssets: analysis.affectedAssets,
      })
    ).catch((err) => logger.warn({ err, caseId: created.id }, "KVKK assessment trigger failed"));
  });

  // Webhook / Telegram / NetGSM — SOC vakası açıldı
  const notifPayload: Record<string, unknown> = {
    caseId: created.id, caseNumber: created.caseNumber,
    title: analysis.title, severity: analysis.severity,
    category: analysis.category,
  };
  const notifEvent = analysis.severity === "critical" ? "soc.case.critical" : "soc.case.opened";
  setImmediate(() => {
    import("../webhookDispatcher").then(({ dispatchWebhook }) =>
      dispatchWebhook(customerId, notifEvent, notifPayload)
    ).catch((err) => logger.warn({ err, caseId: created.id }, "Webhook dispatch failed"));
  });
  setImmediate(() => {
    import("../telegramNotifier").then(({ sendTelegramAlert }) =>
      sendTelegramAlert(customerId, notifEvent, notifPayload)
    ).catch((err) => logger.warn({ err, caseId: created.id }, "Telegram notify failed"));
  });
  setImmediate(() => {
    import("../netgsmNotifier").then(({ sendNetgsmAlert }) =>
      sendNetgsmAlert(customerId, notifEvent, notifPayload)
    ).catch((err) => logger.warn({ err, caseId: created.id }, "NetGSM notify failed"));
  });

  return created.id;
}

// ─── Public entry: triage a single event ──────────────────────────────────────

export async function triageAlert(event: FabricEvent, customerId: number): Promise<TriageResult> {
  const ip = event.srcIp ?? "";

  // ── Tier 0: rules ──
  // Whitelist
  if (ip) {
    const whitelist = await getCustomerWhitelist(customerId);
    if (whitelist.includes(ip)) {
      await markTriaged([event.id], 0, "false_positive");
      return { action: "false_positive", level: 0, reason: `${ip} beyaz listede` };
    }
  }

  // Duplicate batching — collapse repeated identical events within the cache TTL
  const dedupKey = socCacheKey(["soc-dedup", customerId, ip, event.eventType]);
  if (socCacheGet(dedupKey)) {
    await markTriaged([event.id], 0, "batch");
    return { action: "batch", level: 0, reason: "Yinelenen olay — gruplandı" };
  }
  socCacheSet(dedupKey, "1");

  // Already blocked
  if (ip && (await checkIPAlreadyBlocked(customerId, ip))) {
    await markTriaged([event.id], 0, "skip");
    return { action: "skip", level: 0, reason: `${ip} zaten engellenmiş` };
  }

  // Known IoC → straight to a case + auto-block intent
  if (ip) {
    const ioc = await checkIOCRegistry(ip);
    if (ioc && (ioc.severity === "critical" || ioc.severity === "high")) {
      const analysis: DeepAnalysis = {
        title: `Bilinen zararlı IP tespit edildi: ${ip}`,
        narrative: `${ip} tehdit istihbaratı kayıtlarında "${ioc.description}" olarak işaretli. Bu kaynaktan gelen trafik derhal engellenmelidir.`,
        severity: normSeverity(ioc.severity),
        category: "c2",
        recommendedAction: `${ip} adresini engelle`,
        affectedAssets: [event.dstIp ?? ""].filter(Boolean),
        suspectIps: [ip],
        mitreTechniques: [],
        shouldBlock: true,
      };
      const caseId = await openCase(customerId, [event], analysis);
      await markTriaged([event.id], 0, "auto_block");
      return { action: "auto_block", level: 0, caseId: caseId ?? undefined, reason: "Bilinen zararlı IP" };
    }
  }

  // ── Tier 1: fast classification ──
  const fast = await fastTriage(event, customerId);
  if (fast?.benign) {
    await markTriaged([event.id], 1, "log_and_watch");
    return { action: "log_and_watch", level: 1, reason: fast.reason || "Zararsız olarak sınıflandırıldı" };
  }

  // ── Tier 2: deep analysis → case ──
  // Pull related untriaged events from the same source to build one coherent case.
  const related = ip
    ? await db.select().from(fabricEventsTable)
        .where(and(
          eq(fabricEventsTable.customerId, customerId),
          eq(fabricEventsTable.srcIp, ip),
          eq(fabricEventsTable.socTriaged, false),
        ))
        .orderBy(desc(fabricEventsTable.createdAt))
        .limit(50)
    : [event];
  const events = related.some((e) => e.id === event.id) ? related : [event, ...related];

  const analysis = await deepAnalyze(events, customerId);
  if (!analysis) {
    // AI unavailable — mark watched so the queue does not spin; SLA cron is safe.
    await markTriaged(events.map((e) => e.id), 2, "log_and_watch");
    return { action: "log_and_watch", level: 2, reason: "Derin analiz yapılamadı — izlemeye alındı" };
  }

  const caseId = await openCase(customerId, events, analysis);
  await markTriaged(events.map((e) => e.id), 2, "case_created");
  return { action: "case_created", level: 2, caseId: caseId ?? undefined, reason: analysis.title };
}

// ─── Queue processor (cron entry point) ───────────────────────────────────────

export async function processTriageQueue(batchLimit = 25): Promise<number> {
  const events = await db.select().from(fabricEventsTable)
    .where(and(eq(fabricEventsTable.socTriaged, false), isNull(fabricEventsTable.processed)))
    .orderBy(desc(fabricEventsTable.createdAt))
    .limit(batchLimit);

  // `processed` is the fabric-correlation flag; SOC triage uses its own column,
  // so include both processed and unprocessed untriaged events.
  const pending = events.length > 0 ? events : await db.select().from(fabricEventsTable)
    .where(eq(fabricEventsTable.socTriaged, false))
    .orderBy(desc(fabricEventsTable.createdAt))
    .limit(batchLimit);

  let handled = 0;
  for (const event of pending) {
    try {
      await triageAlert(event, event.customerId);
      handled++;
    } catch (err) {
      logger.warn({ err, eventId: event.id }, "Triage failed for event");
      await markTriaged([event.id], 0, "skip");
    }
  }
  if (handled > 0) logger.info({ handled }, "SOC triage queue processed");
  return handled;
}
