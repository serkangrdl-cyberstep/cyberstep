/**
 * SOC scheduled jobs. Registered from index.ts after the server is listening.
 * Seeds playbooks/SLA on startup, then schedules triage/SLA/report jobs.
 */

import cron from "node-cron";
import { db, aiUsageLogTable } from "@workspace/db";
import { gte, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { sendMail } from "../email";
import { wrapCron } from "../cronRegistry";
import { seedSOC } from "./soc-seed";
import { processTriageQueue } from "./soc-triage";
import { checkSLABreaches } from "./soc-escalation";
import { runWeeklySOCReports } from "./soc-report";

const TZ = { timezone: "Europe/Istanbul" } as const;
const ADMIN_EMAIL = process.env["SOC_ADMIN_EMAIL"] ?? "";

async function sendMonthlyAICostReport(): Promise<void> {
  if (!ADMIN_EMAIL) {
    logger.warn("SOC_ADMIN_EMAIL not set; skipping monthly AI cost report");
    return;
  }
  try {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    monthStart.setMonth(monthStart.getMonth() - 1);

    const [row] = await db
      .select({
        total: sql<number>`coalesce(sum(${aiUsageLogTable.costUsd}), 0)`,
        calls: sql<number>`count(*)`,
        cached: sql<number>`coalesce(sum(case when ${aiUsageLogTable.cached} then 1 else 0 end), 0)`,
      })
      .from(aiUsageLogTable)
      .where(gte(aiUsageLogTable.createdAt, monthStart));

    const total = Number(row?.total ?? 0);
    const calls = Number(row?.calls ?? 0);
    const cached = Number(row?.cached ?? 0);

    await sendMail({
      to: ADMIN_EMAIL,
      subject: `CyberStep SOC — Aylık AI Maliyet Raporu`,
      html: `<p>Geçen ay SOC AI kullanımı:</p><ul><li>Toplam maliyet: $${total.toFixed(4)}</li><li>Çağrı sayısı: ${calls}</li><li>Önbellekten karşılanan: ${cached}</li></ul>`,
    });
    logger.info({ total, calls }, "Monthly AI cost report sent");
  } catch (err) {
    logger.warn({ err }, "Monthly AI cost report failed");
  }
}

export function startSOCCrons(): void {
  // Seed playbooks + SLA matrix on startup (idempotent)
  void seedSOC();

  // Triage queue — every 5 minutes, offset +1 min to stagger with dns_monitor
  cron.schedule(
    "1,6,11,16,21,26,31,36,41,46,51,56 * * * *",
    wrapCron("soc_triage", "1,6,11,16,21,26,31,36,41,46,51,56 * * * *", async () => {
      await processTriageQueue();
    }),
    TZ
  );
  logger.info("SOC triage cron scheduled (every 5 min, offset +1)");

  // SLA breach check — every 5 minutes, offset +2 min to stagger
  cron.schedule("2,7,12,17,22,27,32,37,42,47,52,57 * * * *", wrapCron("soc_sla", "2,7,12,17,22,27,32,37,42,47,52,57 * * * *", async () => {
    await checkSLABreaches();
  }), TZ);
  logger.info("SOC SLA cron scheduled (every 5 min, offset +2)");

  // Weekly customer reports — Mondays 09:00 Istanbul
  cron.schedule("0 9 * * 1", wrapCron("soc_weekly_report", "0 9 * * 1", async () => {
    await runWeeklySOCReports();
    return 0;
  }), TZ);
  logger.info("SOC weekly report cron scheduled (Mon 09:00 Istanbul)");

  // Monthly AI cost report — 1st of month 09:00 Istanbul (shifted from 08:00 to avoid ciso_compliance_monthly conflict)
  cron.schedule("0 9 1 * *", wrapCron("soc_monthly_ai_cost", "0 9 1 * *", async () => {
    await sendMonthlyAICostReport();
    return 0;
  }), TZ);
  logger.info("SOC monthly AI cost cron scheduled (1st 09:00 Istanbul)");
}
