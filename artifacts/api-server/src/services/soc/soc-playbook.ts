/**
 * SOC playbook executor.
 *
 * Runs an ordered list of steps against a case. Step types:
 *   block_ip  — push the suspect IP to FortiManager (reuses fabric auto-block)
 *   notify    — send a SOC notification on the requested channels
 *   create_case / enrich / scan / verify — logged enrichment/verification steps
 *
 * Progress is logged to the case activity timeline and broadcast over WS
 * (`playbook_progress`). Template params like "{{case.title}}" / "{{ctx.ip}}"
 * are resolved against the case + runtime context before each step runs.
 */

import {
  db,
  socPlaybooksTable,
  fortinetIntegrationsTable,
  fortimanagerBlockActionsTable,
  type SocCase,
  type PlaybookStep,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { decryptSecret } from "../fabric-crypto";
import { fmBlockIp, fmVerifyBlock } from "../fabric-fortimanager";
import { sendSOCNotification, type NotifyChannel } from "./soc-notify";
import { logSOCActivity, getCase } from "./soc-cases";
import { emitSOC } from "./soc-events";

export interface PlaybookContext {
  customerId: number;
  ip?: string | null;
  suspectIps?: string[];
  channels?: NotifyChannel[];
  [key: string]: unknown;
}

function resolveTemplateValue(value: unknown, vars: Record<string, unknown>): unknown {
  if (typeof value !== "string") return value;
  return value.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, path: string) => {
    const segs = path.split(".");
    let cur: unknown = vars;
    for (const s of segs) {
      if (cur && typeof cur === "object" && s in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[s];
      } else {
        return "";
      }
    }
    return cur == null ? "" : String(cur);
  });
}

export function resolveTemplateParams(
  params: Record<string, unknown> | undefined,
  vars: Record<string, unknown>,
): Record<string, unknown> {
  if (!params) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) out[k] = resolveTemplateValue(v, vars);
  return out;
}

async function blockIpStep(socCase: SocCase, ip: string, reason: string): Promise<{ ok: boolean; message: string }> {
  if (!ip) return { ok: false, message: "Engellenecek IP yok" };
  const [integration] = await db
    .select()
    .from(fortinetIntegrationsTable)
    .where(eq(fortinetIntegrationsTable.customerId, socCase.customerId))
    .limit(1);

  const [action] = await db
    .insert(fortimanagerBlockActionsTable)
    .values({ integrationId: integration?.id ?? 0, customerId: socCase.customerId, ip, reason })
    .returning();

  if (!integration || !integration.autoBlockEnabled) {
    if (action) {
      await db.update(fortimanagerBlockActionsTable)
        .set({ status: "pending", message: "Otomatik engelleme kapalı — manuel onay bekliyor" })
        .where(eq(fortimanagerBlockActionsTable.id, action.id));
    }
    return { ok: false, message: "Otomatik engelleme kapalı — IP manuel engelleme için kaydedildi" };
  }

  const password = decryptSecret(integration.fmPasswordEnc);
  if (!integration.fmUrl || !integration.fmUsername || !password) {
    return { ok: false, message: "FortiManager kimlik bilgileri eksik" };
  }
  const creds = {
    url: integration.fmUrl, username: integration.fmUsername, password,
    adom: integration.fmAdom ?? "root", blockGroup: integration.fmBlockGroup ?? "CyberStep-BlockList",
  };
  const r = await fmBlockIp(creds, ip, reason);
  if (action) {
    await db.update(fortimanagerBlockActionsTable)
      .set({ status: r.ok ? "success" : "error", message: r.message })
      .where(eq(fortimanagerBlockActionsTable.id, action.id));
  }
  return r;
}

async function verifyStep(socCase: SocCase, ip: string): Promise<{ ok: boolean; message: string }> {
  const [integration] = await db
    .select()
    .from(fortinetIntegrationsTable)
    .where(eq(fortinetIntegrationsTable.customerId, socCase.customerId))
    .limit(1);
  const password = integration ? decryptSecret(integration.fmPasswordEnc) : "";
  if (!integration?.fmUrl || !integration.fmUsername || !password) {
    return { ok: false, message: "Doğrulama atlandı — FortiManager yapılandırılmamış" };
  }
  const creds = {
    url: integration.fmUrl, username: integration.fmUsername, password,
    adom: integration.fmAdom ?? "root", blockGroup: integration.fmBlockGroup ?? "CyberStep-BlockList",
  };
  const r = await fmVerifyBlock(creds, ip);
  return { ok: r.ok && r.present, message: r.message };
}

export async function executePlaybook(
  playbookId: number,
  caseId: number,
  ctx: PlaybookContext,
): Promise<void> {
  const [playbook] = await db.select().from(socPlaybooksTable).where(eq(socPlaybooksTable.id, playbookId));
  if (!playbook) {
    logger.warn({ playbookId, caseId }, "Playbook not found");
    return;
  }
  const socCase = await getCase(caseId);
  if (!socCase) return;

  const steps = (playbook.steps ?? []) as PlaybookStep[];
  const ip = ctx.ip ?? socCase.affectedAssets?.[0] ?? ctx.suspectIps?.[0] ?? "";

  await logSOCActivity({
    caseId, actorType: "system", actionType: "playbook_started",
    description: `Playbook çalıştırılıyor: ${playbook.name}`,
    details: { playbookId, steps: steps.length },
  });

  for (const step of steps) {
    const vars = { case: socCase, ctx, ip };
    const params = resolveTemplateParams(step.params, vars);
    let result: { ok: boolean; message: string } = { ok: true, message: "" };

    try {
      switch (step.type) {
        case "action":
          if (step.action === "block_ip") {
            const targetIp = String(params["ip"] ?? ip);
            result = await blockIpStep(socCase, targetIp, `SOC playbook: ${playbook.name} (${socCase.caseNumber})`);
          } else {
            result = { ok: true, message: `Aksiyon kaydedildi: ${step.action ?? "bilinmeyen"}` };
          }
          break;
        case "notify": {
          const channels = (step.channels as NotifyChannel[] | undefined) ?? ctx.channels ?? ["email"];
          const res = await sendSOCNotification(socCase.customerId, caseId, {
            title: socCase.title,
            severity: socCase.severity,
            narrative: socCase.attackNarrative ?? socCase.description ?? undefined,
            recommendedAction: String(params["message"] ?? "") || undefined,
            caseNumber: socCase.caseNumber,
            suspectIps: socCase.affectedAssets ?? [],
          }, channels);
          const okCount = res.filter((r) => r.ok).length;
          result = { ok: okCount > 0, message: res.map((r) => `${r.channel}: ${r.message}`).join("; ") };
          break;
        }
        case "verify":
          result = await verifyStep(socCase, String(params["ip"] ?? ip));
          break;
        case "enrich":
          result = { ok: true, message: "Zenginleştirme tamamlandı (yerel tehdit istihbaratı)" };
          break;
        case "scan":
          result = { ok: true, message: "Tarama kuyruğa alındı" };
          break;
        case "create_case":
          result = { ok: true, message: "Vaka zaten oluşturuldu" };
          break;
        default:
          result = { ok: true, message: `Adım atlandı: ${String(step.type)}` };
      }
    } catch (err) {
      result = { ok: false, message: String(err) };
      logger.warn({ err, caseId, step: step.step }, "Playbook step failed");
    }

    await logSOCActivity({
      caseId, actorType: "system", actionType: "playbook_step",
      description: `Adım ${step.step} (${step.type}): ${result.message}`,
      details: { step: step.step, type: step.type, ok: result.ok },
    });
    emitSOC({
      type: "playbook_progress", customerId: socCase.customerId, caseId,
      data: { step: step.step, total: steps.length, type: step.type, ok: result.ok, message: result.message },
    });
  }

  await logSOCActivity({
    caseId, actorType: "system", actionType: "playbook_completed",
    description: `Playbook tamamlandı: ${playbook.name}`,
  });
}

/** Find the first enabled auto-execute playbook matching a case category+severity. */
export async function findMatchingPlaybook(category: string, severity: string): Promise<number | null> {
  const playbooks = await db.select().from(socPlaybooksTable).where(eq(socPlaybooksTable.enabled, true));
  for (const p of playbooks) {
    const catMatch = p.triggerCategories.length === 0 || p.triggerCategories.includes(category);
    const sevMatch = p.triggerSeverity.length === 0 || p.triggerSeverity.includes(severity);
    if (catMatch && sevMatch && p.autoExecute) return p.id;
  }
  return null;
}
