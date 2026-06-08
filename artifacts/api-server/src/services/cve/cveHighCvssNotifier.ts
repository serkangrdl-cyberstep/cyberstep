import { db, cveTrackerTable, cveDomainMatchesTable } from "@workspace/db";
import { eq, and, gte } from "drizzle-orm";
import { notifyAffectedDomains } from "./cveNotifier";
import { logger } from "../../lib/logger";

const MIN_CVSS_CRITICAL = 9.0;

export async function runCveCustomerNotification(): Promise<number> {
  logger.info("cve_customer_notification: kritik CVE bildirim taraması başladı");

  const unnotified = await db
    .selectDistinct({ cveId: cveDomainMatchesTable.cveId })
    .from(cveDomainMatchesTable)
    .innerJoin(
      cveTrackerTable,
      eq(cveDomainMatchesTable.cveId, cveTrackerTable.cveId),
    )
    .where(
      and(
        eq(cveDomainMatchesTable.notificationSent, false),
        gte(cveDomainMatchesTable.confidence, 60),
        gte(cveTrackerTable.cvssScore, String(MIN_CVSS_CRITICAL)),
      ),
    );

  if (unnotified.length === 0) {
    logger.info("cve_customer_notification: bildirim bekleyen kritik CVE bulunamadı");
    return 0;
  }

  logger.info({ count: unnotified.length }, "cve_customer_notification: kritik CVE bulundu");

  let totalSent = 0;
  for (const { cveId } of unnotified) {
    if (!cveId) continue;
    try {
      const sent = await notifyAffectedDomains(cveId);
      totalSent += sent;
      if (sent > 0) {
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (err) {
      logger.warn({ err, cveId }, "cve_customer_notification: bildirim gönderilemedi");
    }
  }

  logger.info({ totalSent, cveCount: unnotified.length }, "cve_customer_notification: tarama tamamlandı");
  return totalSent;
}
