/**
 * SOC escalation + SLA enforcement.
 *
 * - escalateCase: bumps the case escalation level (1-4), notifies the relevant
 *   recipients (customer / admin), logs activity and broadcasts `escalation`.
 * - checkSLABreaches: finds open cases past their SLA deadline, flags them and
 *   escalates (broadcast `sla_warning`). Called by the SLA cron.
 * - scheduleEscalationCheck: in-process ack timer — if a case is not
 *   acknowledged within the window it auto-escalates one level.
 */

import { db, socCasesTable } from "@workspace/db";
import { eq, and, lt, inArray } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { getCase, updateCase, logSOCActivity } from "./soc-cases";
import { sendSOCNotification } from "./soc-notify";
import { emitSOC } from "./soc-events";

const ADMIN_EMAIL = process.env["SOC_ADMIN_EMAIL"] ?? "";

const LEVEL_LABEL: Record<number, string> = {
  1: "Seviye 1 — Müşteri bilgilendirme",
  2: "Seviye 2 — Müşteri + SOC ekibi",
  3: "Seviye 3 — SOC acil müdahale",
  4: "Seviye 4 — Kritik / yönetim",
};

export async function escalateCase(caseId: number, level: number, reason: string): Promise<void> {
  const socCase = await getCase(caseId);
  if (!socCase) return;
  if (level <= socCase.escalationLevel) return; // never de-escalate

  await updateCase(caseId, { escalationLevel: level });

  await logSOCActivity({
    caseId, actorType: "system", actionType: "escalated",
    description: `${LEVEL_LABEL[level] ?? `Seviye ${level}`}: ${reason}`,
    details: { level, reason },
  });

  // Levels 1-2 → customer; levels 3-4 → SOC admin (customer also kept informed).
  const notifyCustomer = level <= 2;
  const notifyAdmin = level >= 2;

  if (notifyCustomer) {
    await sendSOCNotification(socCase.customerId, caseId, {
      title: `[Eskalasyon] ${socCase.title}`,
      severity: socCase.severity,
      narrative: socCase.attackNarrative ?? socCase.description ?? undefined,
      recommendedAction: reason,
      caseNumber: socCase.caseNumber,
      suspectIps: socCase.affectedAssets ?? [],
    }, ["email"]);
  }
  if (notifyAdmin && !ADMIN_EMAIL) {
    logger.error({ caseId, level }, "SOC_ADMIN_EMAIL tanımlı değil — eskalasyon emaili GÖNDERİLEMEDİ. Bu env var'ı hemen ayarlayın.");
  }
  if (notifyAdmin && ADMIN_EMAIL) {
    await sendSOCNotification(socCase.customerId, caseId, {
      title: `[SOC ${LEVEL_LABEL[level] ?? `Seviye ${level}`}] ${socCase.title}`,
      severity: socCase.severity,
      narrative: socCase.attackNarrative ?? socCase.description ?? undefined,
      recommendedAction: reason,
      caseNumber: socCase.caseNumber,
      suspectIps: socCase.affectedAssets ?? [],
      toEmailOverride: ADMIN_EMAIL,
    }, ["email"]);
  }

  emitSOC({ type: "escalation", customerId: socCase.customerId, caseId, data: { level, reason } });
  logger.info({ caseId, level }, "SOC case escalated");
}

export async function checkSLABreaches(): Promise<number> {
  const now = new Date();
  const openCases = await db
    .select()
    .from(socCasesTable)
    .where(
      and(
        inArray(socCasesTable.status, ["open", "investigating"]),
        eq(socCasesTable.slaBreached, false),
        lt(socCasesTable.slaDeadline, now),
      ),
    );

  let breached = 0;
  for (const c of openCases) {
    if (!c.slaDeadline) continue;
    await updateCase(c.id, { slaBreached: true, slaBreachedAt: now });
    await logSOCActivity({
      caseId: c.id, actorType: "system", actionType: "sla_breached",
      description: `SLA süresi aşıldı (${c.slaTier ?? "tanımsız"})`,
      details: { slaDeadline: c.slaDeadline.toISOString() },
    });
    emitSOC({ type: "sla_warning", customerId: c.customerId, caseId: c.id, data: { slaTier: c.slaTier } });
    // Webhook / Telegram / NetGSM — SLA ihlali
    const slaPayload: Record<string, unknown> = {
      caseId: c.id, caseNumber: c.caseNumber, title: c.title,
      severity: c.severity, slaTier: c.slaTier, slaDeadline: c.slaDeadline?.toISOString(),
    };
    setImmediate(() => {
      import("../webhookDispatcher").then(({ dispatchWebhook }) =>
        dispatchWebhook(c.customerId, "soc.sla.breached", slaPayload)
      ).catch((err) => logger.warn({ err, caseId: c.id }, "Webhook SLA breach failed"));
    });
    setImmediate(() => {
      import("../telegramNotifier").then(({ sendTelegramAlert }) =>
        sendTelegramAlert(c.customerId, "soc.sla.breached", slaPayload)
      ).catch((err) => logger.warn({ err, caseId: c.id }, "Telegram SLA breach failed"));
    });
    setImmediate(() => {
      import("../netgsmNotifier").then(({ sendNetgsmAlert }) =>
        sendNetgsmAlert(c.customerId, "soc.sla.breached", slaPayload)
      ).catch((err) => logger.warn({ err, caseId: c.id }, "NetGSM SLA breach failed"));
    });
    // T16b: Direct customer email notification for SLA breach
    setImmediate(() => {
      sendSOCNotification(c.customerId, c.id, {
        title: `[SLA İhlali] ${c.title}`,
        severity: c.severity,
        narrative: `Vakamız için belirlenen ${c.slaTier ?? "standart"} SLA süresi aşıldı. SOC ekibimiz vakayla acilen ilgilenmektedir.`,
        recommendedAction: "SOC analistimiz en kısa sürede sizinle iletişime geçecektir.",
        caseNumber: c.caseNumber,
        suspectIps: c.affectedAssets ?? [],
      }, ["email"]).catch((err) => logger.warn({ err, caseId: c.id }, "SLA breach customer email failed"));
    });
    // Breaching the SLA escalates at least one level beyond current.
    await escalateCase(c.id, Math.max(c.escalationLevel + 1, 3), "SLA süresi aşıldı — otomatik eskalasyon");
    breached++;
  }
  if (breached > 0) logger.warn({ breached }, "SOC SLA breaches processed");
  return breached;
}

// In-process ack timers (cleared on restart — the SLA cron is the durable backstop).
const ackTimers = new Map<number, NodeJS.Timeout>();

export function scheduleEscalationCheck(caseId: number, ackWindowMinutes: number): void {
  const existing = ackTimers.get(caseId);
  if (existing) clearTimeout(existing);
  const t = setTimeout(() => {
    void (async () => {
      const c = await getCase(caseId);
      ackTimers.delete(caseId);
      if (!c) return;
      if (c.acknowledgedAt || c.status === "resolved" || c.status === "closed" || c.status === "false_positive") return;
      await escalateCase(caseId, Math.max(c.escalationLevel + 1, 2), `${ackWindowMinutes} dk içinde onaylanmadı`);
    })();
  }, ackWindowMinutes * 60 * 1000);
  t.unref();
  ackTimers.set(caseId, t);
}

export function cancelEscalationCheck(caseId: number): void {
  const t = ackTimers.get(caseId);
  if (t) { clearTimeout(t); ackTimers.delete(caseId); }
}
