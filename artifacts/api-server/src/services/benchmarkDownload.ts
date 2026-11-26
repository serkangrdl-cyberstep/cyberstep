import { db } from "@workspace/db";
import { benchmarkDownloadsTable, leadScanQueueTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/** Sektör raporu indirme formu: kaydı tutar, domain verildiyse tarama kuyruğuna ekler. */
export async function handleBenchmarkDownload(params: {
  sector: string;
  visitorName?: string;
  visitorEmail: string;
  visitorCompany?: string;
  visitorDomain?: string;
  reportPeriod?: string;
}): Promise<void> {
  await db.insert(benchmarkDownloadsTable).values({
    sector: params.sector,
    reportPeriod: params.reportPeriod ?? "Q4-2026",
    visitorName: params.visitorName ?? null,
    visitorEmail: params.visitorEmail,
    visitorCompany: params.visitorCompany ?? null,
    visitorDomain: params.visitorDomain ?? null,
    leadCreated: true,
  });
  if (params.visitorDomain) {
    const existing = await db.select({ id: leadScanQueueTable.id }).from(leadScanQueueTable)
      .where(eq(leadScanQueueTable.domain, params.visitorDomain)).limit(1);
    if (!existing.length) {
      await db.insert(leadScanQueueTable).values({
        domain: params.visitorDomain,
        companyName: params.visitorCompany ?? null,
        source: "benchmark_download",
        scanStatus: "pending",
      });
    }
  }
}
