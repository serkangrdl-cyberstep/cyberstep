import { db, cveTrackerTable, cveDomainMatchesTable, customersTable, leadCandidatesTable } from "@workspace/db";
import { eq, and, gte } from "drizzle-orm";
import { sendMail } from "../email";
import { logger } from "../../lib/logger";

function buildAlertEmail(params: {
  cveId: string;
  cvssScore: string | null;
  title: string;
  domain: string;
  matchedProduct: string;
  patchAvailable: boolean;
  patchUrl?: string | null;
  exploitPublic: boolean;
  cisaKev: boolean;
}): string {
  const urgency = params.cisaKev || params.exploitPublic ? "ACİL" : "ÖNEMLİ";
  const baseUrl = (() => {
    const domains = process.env["REPLIT_DOMAINS"];
    if (domains) return `https://${domains.split(",")[0]?.trim()}`;
    return "https://cyberstep.io";
  })();

  return `
<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#060D1A;color:#E8EDF5;padding:32px;border-radius:12px">
  <div style="margin-bottom:24px">
    <span style="color:#E8EDF5;font-weight:bold;font-size:22px">Cyber</span><span style="color:#00C8FF;font-weight:bold;font-size:22px">Step</span><span style="color:#7B8FAF;font-size:14px">.io</span>
  </div>

  <div style="background:rgba(255,69,96,0.08);border:1px solid #FF4560;border-radius:8px;padding:16px;margin-bottom:24px">
    <div style="color:#FF4560;font-weight:bold;font-size:18px">${urgency} — ${params.cveId}</div>
    <div style="color:#A8B8D0;font-size:14px;margin-top:4px">CVSS ${params.cvssScore ?? "?"} — ${params.title?.slice(0, 120)}</div>
  </div>

  <p style="color:#A8B8D0;line-height:1.7">
    <strong style="color:#E8EDF5">${params.domain}</strong> alan adında kullandığınız
    <strong style="color:#00C8FF">${params.matchedProduct}</strong> bu güvenlik açığından etkileniyor.
  </p>

  ${params.patchAvailable ? `
  <div style="background:rgba(0,224,150,0.07);border:1px solid #00E096;border-radius:8px;padding:16px;margin:24px 0">
    <div style="color:#00E096;font-weight:bold">Yama Mevcut</div>
    <div style="color:#A8B8D0;font-size:14px;margin-top:4px">En kısa sürede güncelleme yapmanızı öneriyoruz.</div>
    ${params.patchUrl ? `<a href="${params.patchUrl}" style="color:#00C8FF;display:block;margin-top:8px;font-size:13px">Yama sayfasına git</a>` : ""}
  </div>` : `
  <div style="background:rgba(255,176,32,0.07);border:1px solid #FFB020;border-radius:8px;padding:16px;margin:24px 0">
    <div style="color:#FFB020;font-weight:bold">Yama Henüz Mevcut Degil</div>
    <div style="color:#A8B8D0;font-size:14px;margin-top:4px">Geçici önlem alınması önerilir. Tam analiz için CyberStep'e başvurun.</div>
  </div>`}

  <a href="${baseUrl}/cve/${params.cveId}" style="display:block;background:#00C8FF;color:#060D1A;text-align:center;padding:14px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:24px">
    Tam Analizi Gör
  </a>

  <p style="font-size:12px;color:#5A6A80;margin-top:24px;line-height:1.6">
    Bu uyarı CyberStep'in otomatik tehdit izleme sistemi tarafından üretilmiştir.
    Sorularınız için security@cyberstep.io adresine yazabilirsiniz.
  </p>
</div>`.trim();
}

export async function notifyAffectedDomains(cveId: string): Promise<number> {
  const [cve] = await db.select().from(cveTrackerTable).where(eq(cveTrackerTable.cveId, cveId));
  if (!cve) return 0;

  const matches = await db.select().from(cveDomainMatchesTable).where(
    and(
      eq(cveDomainMatchesTable.cveId, cveId),
      eq(cveDomainMatchesTable.notificationSent, false),
      gte(cveDomainMatchesTable.confidence, 60),
    )
  );

  let sent = 0;
  for (const match of matches) {
    let contactEmail: string | null = null;

    if (match.customerId) {
      const [customer] = await db.select({ email: customersTable.email }).from(customersTable).where(eq(customersTable.id, match.customerId));
      contactEmail = customer?.email ?? null;
    } else if (match.leadCandidateId) {
      const [lead] = await db.select({ email: leadCandidatesTable.contactEmail }).from(leadCandidatesTable).where(eq(leadCandidatesTable.id, match.leadCandidateId));
      contactEmail = lead?.email ?? null;
    }

    if (!contactEmail) continue;

    try {
      const html = buildAlertEmail({
        cveId,
        cvssScore: cve.cvssScore,
        title: cve.title ?? cveId,
        domain: match.domain ?? "",
        matchedProduct: match.matchedProduct ?? "yazılım",
        patchAvailable: cve.patchAvailable ?? false,
        patchUrl: cve.patchUrl,
        exploitPublic: cve.exploitPublic ?? false,
        cisaKev: cve.cisaKev ?? false,
      });

      await sendMail({
        to: contactEmail,
        subject: `Guvenlik Uyarisi: ${match.domain} — ${cveId}`,
        html,
      });

      await db.update(cveDomainMatchesTable).set({
        notificationSent: true,
        notificationSentAt: new Date(),
        notificationType: "email",
      }).where(eq(cveDomainMatchesTable.id, match.id));

      sent++;
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      logger.warn({ err, domain: match.domain, cveId }, "CVE uyarı e-postası gönderilemedi");
    }
  }

  if (sent > 0) {
    await db.update(cveTrackerTable).set({ notificationsSent: sent }).where(eq(cveTrackerTable.cveId, cveId));
  }

  logger.info({ cveId, sent }, "CVE bildirimleri gönderildi");
  return sent;
}
