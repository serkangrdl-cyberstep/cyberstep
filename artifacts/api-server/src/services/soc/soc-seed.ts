/**
 * Idempotent SOC seed: default playbooks + SLA matrix.
 * Runs on startup; upserts by natural key (playbook slug, sla tier+severity).
 */

import {
  db,
  socPlaybooksTable,
  socSlaConfigTable,
  type PlaybookStep,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../../lib/logger";

interface SeedPlaybook {
  name: string;
  slug: string;
  description: string;
  triggerCategories: string[];
  triggerSeverity: string[];
  steps: PlaybookStep[];
  autoExecute: boolean;
}

const PLAYBOOKS: SeedPlaybook[] = [
  {
    name: "Fidye Yazılımı — İlk Müdahale",
    slug: "ransomware-initial",
    description: "Fidye yazılımı göstergesi tespit edildiğinde kaynak IP'yi engelle, müşteriyi uyar ve doğrula.",
    triggerCategories: ["ransomware", "malware"],
    triggerSeverity: ["critical", "high"],
    autoExecute: true,
    steps: [
      { step: 1, type: "action", action: "block_ip", params: { ip: "{{ctx.ip}}" } },
      { step: 2, type: "notify", channels: ["email"], params: { message: "Fidye yazılımı şüphesi — kaynak IP engellendi" } },
      { step: 3, type: "verify", params: { ip: "{{ctx.ip}}" } },
    ],
  },
  {
    name: "RDP Kaba Kuvvet Saldırısı",
    slug: "rdp-brute-force",
    description: "RDP/uzak masaüstü kaba kuvvet denemelerinde saldırgan IP'yi engelle ve bilgilendir.",
    triggerCategories: ["brute_force"],
    triggerSeverity: ["high", "medium"],
    autoExecute: true,
    steps: [
      { step: 1, type: "action", action: "block_ip", params: { ip: "{{ctx.ip}}" } },
      { step: 2, type: "notify", channels: ["email"], params: { message: "RDP kaba kuvvet saldırısı — saldırgan IP engellendi" } },
    ],
  },
  {
    name: "Botnet / C2 İletişimi",
    slug: "botnet-c2",
    description: "Komuta-kontrol (C2) iletişimi tespitinde çıkış trafiğini engelle ve incele.",
    triggerCategories: ["c2", "malware"],
    triggerSeverity: ["critical", "high"],
    autoExecute: true,
    steps: [
      { step: 1, type: "enrich", params: { ip: "{{ctx.ip}}" } },
      { step: 2, type: "action", action: "block_ip", params: { ip: "{{ctx.ip}}" } },
      { step: 3, type: "notify", channels: ["email"], params: { message: "C2 iletişimi tespit edildi — IP engellendi" } },
    ],
  },
  {
    name: "Kritik CVE Uyarısı",
    slug: "critical-cve-alert",
    description: "Kritik açık (exploit) denemesinde müşteriyi uyar ve tarama kuyruğa al.",
    triggerCategories: ["exploit", "recon"],
    triggerSeverity: ["critical", "high"],
    autoExecute: true,
    steps: [
      { step: 1, type: "notify", channels: ["email"], params: { message: "Kritik açık istismar denemesi tespit edildi" } },
      { step: 2, type: "scan", params: { target: "{{case.affectedAssets}}" } },
    ],
  },
];

// tier → severity → [responseMinutes, resolutionMinutes]
const SLA_MATRIX: Record<string, Record<string, [number, number]>> = {
  lite: {
    critical: [60, 480], high: [240, 1440], medium: [720, 2880], low: [1440, 4320],
  },
  standart: {
    critical: [30, 240], high: [120, 720], medium: [480, 1440], low: [1440, 2880],
  },
  pro: {
    critical: [15, 120], high: [60, 480], medium: [240, 1440], low: [720, 2880],
  },
};

export async function seedSOC(): Promise<void> {
  try {
    for (const pb of PLAYBOOKS) {
      const [existing] = await db.select({ id: socPlaybooksTable.id })
        .from(socPlaybooksTable).where(eq(socPlaybooksTable.slug, pb.slug)).limit(1);
      if (existing) {
        await db.update(socPlaybooksTable).set({
          name: pb.name, description: pb.description,
          triggerCategories: pb.triggerCategories, triggerSeverity: pb.triggerSeverity,
          steps: pb.steps, autoExecute: pb.autoExecute, updatedAt: new Date(),
        }).where(eq(socPlaybooksTable.id, existing.id));
      } else {
        await db.insert(socPlaybooksTable).values({
          name: pb.name, slug: pb.slug, description: pb.description,
          triggerCategories: pb.triggerCategories, triggerSeverity: pb.triggerSeverity,
          steps: pb.steps, autoExecute: pb.autoExecute, enabled: true,
        });
      }
    }

    for (const [tier, sevMap] of Object.entries(SLA_MATRIX)) {
      for (const [severity, [responseMinutes, resolutionMinutes]] of Object.entries(sevMap)) {
        const [existing] = await db.select({ id: socSlaConfigTable.id })
          .from(socSlaConfigTable)
          .where(and(
            eq(socSlaConfigTable.tier, tier as "lite" | "standart" | "pro"),
            eq(socSlaConfigTable.severity, severity as "critical" | "high" | "medium" | "low"),
          ))
          .limit(1);
        if (existing) {
          await db.update(socSlaConfigTable).set({ responseMinutes, resolutionMinutes })
            .where(eq(socSlaConfigTable.id, existing.id));
        } else {
          await db.insert(socSlaConfigTable).values({
            tier: tier as "lite" | "standart" | "pro",
            severity: severity as "critical" | "high" | "medium" | "low",
            responseMinutes, resolutionMinutes,
          });
        }
      }
    }
    logger.info({ playbooks: PLAYBOOKS.length }, "SOC seed applied");
  } catch (err) {
    logger.warn({ err }, "SOC seed failed");
  }
}
