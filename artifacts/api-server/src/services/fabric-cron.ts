import cron from "node-cron";
import { db } from "@workspace/db";
import {
  fortinetIntegrationsTable,
  fortimanagerBlockActionsTable,
} from "@workspace/db";
import { eq, and, lt } from "drizzle-orm";
import { logger } from "../lib/logger";
import { wrapCron } from "./cronRegistry";
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
  cron.schedule("*/15 * * * *", wrapCron("fabric_correlation", "*/15 * * * *", async () => {
    await runBatchCorrelation();
  }), TZ);
  logger.info("Fabric correlation cron scheduled (every 15 min)");

  // Nightly FortiManager health check + device discovery — 02:45 Istanbul
  cron.schedule("45 2 * * *", wrapCron("fabric_fm_health", "45 2 * * *", async () => {
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
    return integrations.length;
  }), TZ);
  logger.info("Fabric FortiManager health cron scheduled (02:45 Istanbul)");

  // Weekly fabric summary report — Mondays 08:00 Istanbul
  cron.schedule("0 8 * * 1", wrapCron("fabric_weekly_report", "0 8 * * 1", async () => {
    await runWeeklyFabricReport();
    return 0;
  }), TZ);
  logger.info("Fabric weekly report cron scheduled (Mon 08:00 Istanbul)");

  // Verify pending/success blocks still present — every 6 hours
  cron.schedule("20 */6 * * *", wrapCron("fabric_block_verify", "20 */6 * * *", async () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const actions = await db.select().from(fortimanagerBlockActionsTable)
      .where(and(eq(fortimanagerBlockActionsTable.status, "success"), lt(fortimanagerBlockActionsTable.createdAt, since)))
      .limit(100);
    let verified = 0;
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
        verified++;
      }
    }
    return verified;
  }), TZ);
  logger.info("Fabric block verification cron scheduled (every 6h)");
}
