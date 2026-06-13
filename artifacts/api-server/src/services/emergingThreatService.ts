import { db } from "@workspace/db";
import { cveTrackerTable, emergingThreatAlertsTable, customersTable } from "@workspace/db";
import { eq, and, gte, isNull, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

function buildEmergingThreatEmailHtml(params: {
  contactName: string;
  cveId: string;
  cvssScore: string | null;
  affectedProduct: string;
  description: string | null;
  patchAvailable: boolean | null;
}): string {
  return `
<div style="font-family:Arial,sans-serif;background:#060D1A;color:#E8EDF5;padding:0;margin:0">
  <div style="background:#1A0A0A;border-bottom:1px solid #C0392B;padding:16px 32px;display:flex;align-items:center;gap:12px">
    <span style="background:#C0392B;color:#fff;font-size:10px;font-weight:700;padding:4px 10px;border-radius:4px;letter-spacing:1px;text-transform:uppercase">ACİL</span>
    <strong style="color:#E8EDF5;font-size:15px">Proaktif Güvenlik Uyarısı: ${params.cveId}</strong>
  </div>

  <div style="padding:28px 32px 20px">
    <p style="margin:0 0 16px;color:#A8B8D0;font-size:14px;line-height:1.7">
      Sayın ${params.contactName},
    </p>
    <p style="margin:0 0 16px;color:#A8B8D0;font-size:13px;line-height:1.7">
      <strong style="color:#00C8FF">Step AI</strong> — CyberStep'in yapay zeka güvenlik analisti — az önce yayınlanan <strong style="color:#E8EDF5">${params.cveId}</strong> güvenlik açığını taramamızdaki <strong style="color:#F5A623">${params.affectedProduct}</strong> teknolojisiyle eşleştirdi.
    </p>

    <div style="background:#1A2540;border:1px solid #2A3550;border-radius:8px;padding:16px;margin-bottom:20px">
      <div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:12px">
        <div>
          <div style="color:#5A6A80;font-size:11px;text-transform:uppercase;letter-spacing:0.5px">CVE ID</div>
          <div style="color:#E8EDF5;font-weight:700;font-family:monospace">${params.cveId}</div>
        </div>
        ${params.cvssScore ? `<div>
          <div style="color:#5A6A80;font-size:11px;text-transform:uppercase;letter-spacing:0.5px">CVSS Skoru</div>
          <div style="color:#E84040;font-weight:700">${params.cvssScore}</div>
        </div>` : ""}
        <div>
          <div style="color:#5A6A80;font-size:11px;text-transform:uppercase;letter-spacing:0.5px">Yama Durumu</div>
          <div style="color:${params.patchAvailable ? "#2ECC71" : "#E84040"};font-weight:700">${params.patchAvailable ? "Mevcut" : "Henüz Yok"}</div>
        </div>
      </div>
      ${params.description ? `<p style="margin:0;color:#A8B8D0;font-size:12px;line-height:1.6;border-top:1px solid #2A3550;padding-top:12px">${params.description.slice(0, 300)}${params.description.length > 300 ? "..." : ""}</p>` : ""}
    </div>

    <p style="margin:0 0 16px;color:#A8B8D0;font-size:13px;line-height:1.7">
      Bu, CyberStep'in proaktif izleme sisteminin bir parçasıdır — yeni bir tehdit ortaya çıktığında sizi beklemeden bilgilendiriyoruz. Kapsamlı analiz ve aksiyon planı için güvenlik ekibimizle iletişime geçin.
    </p>
  </div>

  <div style="padding:8px 32px 28px">
    <p style="margin:0;color:#A8B8D0;font-size:13px;line-height:1.6">
      Saygılarımızla,<br>
      <strong style="color:#E8EDF5">CyberStep.io Ekibi</strong><br>
      <span style="color:#5A6A80;font-size:11px">Türkiye merkezli siber güvenlik risk analizi platformu</span>
    </p>
    <p style="margin:12px 0 0;color:#5A6A80;font-size:11px;line-height:1.5;border-top:1px solid rgba(255,255,255,0.05);padding-top:10px">
      Bu uyarı, <strong style="color:#00C8FF">Step AI</strong> tarafından otomatik olarak tespit edilmiş ve uzman ekibimiz tarafından doğrulanmıştır.
    </p>
  </div>
</div>`.trim();
}

export async function checkEmergingThreats(): Promise<void> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const recentCritical = await db.select({
    id: cveTrackerTable.id,
    cveId: cveTrackerTable.cveId,
    cvssScore: cveTrackerTable.cvssScore,
    description: cveTrackerTable.description,
    affectedProducts: cveTrackerTable.affectedProducts,
    patchAvailable: cveTrackerTable.patchAvailable,
  }).from(cveTrackerTable).where(
    and(
      gte(cveTrackerTable.detectedAt, since),
      isNull(cveTrackerTable.alertSentAt),
      sql`${cveTrackerTable.cvssScore} >= 7`,
    )
  );

  if (recentCritical.length === 0) return;
  logger.info({ count: recentCritical.length }, "Emerging threat check: critical CVEs found");

  const customers = await db.select({
    id: customersTable.id,
    email: customersTable.email,
    fullName: customersTable.fullName,
    subscriptionStatus: customersTable.subscriptionStatus,
    subscriptionPlan: customersTable.subscriptionPlan,
  }).from(customersTable).where(eq(customersTable.subscriptionStatus, "active"));

  for (const cve of recentCritical) {
    const products = Array.isArray(cve.affectedProducts) ? cve.affectedProducts as string[] : [];
    if (products.length === 0) continue;

    for (const customer of customers) {
      const existingAlert = await db.select({ id: emergingThreatAlertsTable.id }).from(emergingThreatAlertsTable)
        .where(and(eq(emergingThreatAlertsTable.cveId, cve.cveId), eq(emergingThreatAlertsTable.customerId, customer.id)));
      if (existingAlert.length > 0) continue;

      const techMatch = await db.execute<{ product: string }>(
        sql`SELECT product FROM customer_tech_stack WHERE customer_id = ${customer.id} AND (
          ${sql.join(products.map(p => sql`LOWER(product) ILIKE ${'%' + p.toLowerCase().slice(0, 30) + '%'} OR LOWER(vendor) ILIKE ${'%' + p.toLowerCase().slice(0, 30) + '%'}`), sql` OR `)}
        ) LIMIT 1`
      );

      if (techMatch.rows.length === 0) continue;

      const matchedProduct = techMatch.rows[0]?.product ?? products[0] ?? "Bilinmiyor";

      await db.insert(emergingThreatAlertsTable).values({
        cveId: cve.cveId,
        customerId: customer.id,
        technologyMatched: matchedProduct,
        emailStatus: "pending",
      });

      logger.info({ cveId: cve.cveId, customerId: customer.id, matchedProduct }, "Emerging threat alert queued");
    }

    await db.execute(sql`UPDATE cve_tracker SET is_emerging = TRUE WHERE cve_id = ${cve.cveId}`);
  }
}

export async function sendEmergingThreatAlert(alertId: number): Promise<{ ok: boolean; error?: string }> {
  const [alert] = await db.select().from(emergingThreatAlertsTable).where(eq(emergingThreatAlertsTable.id, alertId));
  if (!alert) return { ok: false, error: "Alert bulunamadı" };
  if (alert.emailStatus === "sent") return { ok: false, error: "Zaten gönderildi" };

  const [customer] = await db.select({ email: customersTable.email, fullName: customersTable.fullName }).from(customersTable).where(eq(customersTable.id, alert.customerId!));
  const [cve] = await db.select().from(cveTrackerTable).where(eq(cveTrackerTable.cveId, alert.cveId!));

  if (!customer || !cve) return { ok: false, error: "Müşteri veya CVE bulunamadı" };

  const { sendMail } = await import("./email");
  await sendMail({
    to: customer.email,
    subject: `Acil Güvenlik Uyarısı: ${alert.cveId} sisteminizi etkileyebilir`,
    html: buildEmergingThreatEmailHtml({
      contactName: customer.fullName,
      cveId: alert.cveId!,
      cvssScore: cve.cvssScore ? String(cve.cvssScore) : null,
      affectedProduct: alert.technologyMatched ?? "Tespit edilen teknoloji",
      description: cve.description,
      patchAvailable: cve.patchAvailable,
    }),
  });

  await db.execute(sql`UPDATE emerging_threat_alerts SET email_status = 'sent', sent_at = NOW() WHERE id = ${alertId}`);
  await db.execute(sql`UPDATE cve_tracker SET alert_sent_at = NOW() WHERE cve_id = ${alert.cveId}`);
  return { ok: true };
}
