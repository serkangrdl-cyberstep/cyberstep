import cron from "node-cron";
import { db } from "@workspace/db";
import {
  fortinetIntegrationsTable,
  fortimanagerBlockActionsTable,
} from "@workspace/db";
import { eq, and, lt } from "drizzle-orm";
import { logger } from "../lib/logger";
import { runBatchCorrelation, runWeeklyFabricReport } from "./fabric-correlation";
import { decryptSecret } from "./fabric-crypto";
import { fmTestConnection, fmVerifyBlock, fmDiscoverDevices } from "./fabric-fortimanager";

const TZ = { timezone: "Europe/Istanbul" } as const;

function fmCreds(i: typeof fortinetIntegrationsTable.$inferSelect) {
  const password = decryptSecret(i.fmPasswordEnc);
  if (!i.fmUrl || !i.fmUsername || !password) return null;
  return {
    url: i.fmUrl, username: i.fmUsername, password,
    adom: i.fmAdom ?? "root", blockGroup: i.fmBlockGroup ?? "CyberStep-BlockList",
  };
}

export function startFabricCrons(): void {
  // Batch correlation — every 15 minutes
  cron.schedule("*/15 * * * *", () => {
    runBatchCorrelation().catch((err) => logger.warn({ err }, "Fabric batch correlation cron failed"));
  }, TZ);
  logger.info("Fabric correlation cron scheduled (every 15 min)");

  // Nightly FortiManager health check + device discovery — 02:45 Istanbul
  cron.schedule("45 2 * * *", async () => {
    try {
      const integrations = await db.select().from(fortinetIntegrationsTable)
        .where(eq(fortinetIntegrationsTable.autoBlockEnabled, true));
      for (const i of integrations) {
        const creds = fmCreds(i);
        if (!creds) continue;
        const test = await fmTestConnection(creds);
        const devices = test.ok ? await fmDiscoverDevices(creds) : i.fabricDevices;
        await db.update(fortinetIntegrationsTable).set({
          fmStatus: test.ok ? "ok" : "error",
          fmLastError: test.ok ? null : test.message,
          fmLastCheckAt: new Date(),
          fabricDevices: devices,
          updatedAt: new Date(),
        }).where(eq(fortinetIntegrationsTable.id, i.id));
      }
    } catch (err) {
      logger.warn({ err }, "Fabric FM health cron failed");
    }
  }, TZ);
  logger.info("Fabric FortiManager health cron scheduled (02:45 Istanbul)");

  // Weekly fabric summary report — Mondays 08:00 Istanbul
  cron.schedule("0 8 * * 1", () => {
    runWeeklyFabricReport().catch((err) => logger.warn({ err }, "Fabric weekly report cron failed"));
  }, TZ);
  logger.info("Fabric weekly report cron scheduled (Mon 08:00 Istanbul)");

  // Verify pending/success blocks still present — every 6 hours
  cron.schedule("20 */6 * * *", async () => {
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const actions = await db.select().from(fortimanagerBlockActionsTable)
        .where(and(eq(fortimanagerBlockActionsTable.status, "success"), lt(fortimanagerBlockActionsTable.createdAt, since)))
        .limit(100);
      for (const a of actions) {
        const [integration] = await db.select().from(fortinetIntegrationsTable)
          .where(eq(fortinetIntegrationsTable.id, a.integrationId));
        if (!integration) continue;
        const creds = fmCreds(integration);
        if (!creds) continue;
        const v = await fmVerifyBlock(creds, a.ip);
        if (v.ok) {
          await db.update(fortimanagerBlockActionsTable)
            .set({ status: v.present ? "verified" : "removed", verifiedAt: new Date(), message: v.message })
            .where(eq(fortimanagerBlockActionsTable.id, a.id));
        }
      }
    } catch (err) {
      logger.warn({ err }, "Fabric block verification cron failed");
    }
  }, TZ);
  logger.info("Fabric block verification cron scheduled (every 6h)");
}
