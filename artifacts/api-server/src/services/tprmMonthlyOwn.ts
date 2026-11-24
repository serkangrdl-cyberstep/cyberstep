import { db, tprmVendorTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { appBaseUrl, customerContacts, isEmailConfigured } from "./tprmRemediation";
import { ownDomainLine } from "./tprmOwnLine";

/**
 * Her ayın 1'inde, kendi alan adı ekleyen müşterilere özet e-posta: güncel skorlar ve PDF raporun bağlantısı.
 * Düzenli tarama ve aylık raporlama için kanıt üretimini kolaylaştırır; Başkanlığa gönderim yapmaz.
 * TPRM_EMAIL_ENABLED kapalıysa gönderilmez.
 */
export async function runMonthlyOwnDomainSummary(): Promise<number> {
  if (!isEmailConfigured()) return 0;
  const rows = await db.select().from(tprmVendorTable).where(and(eq(tprmVendorTable.isOwn, true), eq(tprmVendorTable.monitoringActive, true)));
  const byCustomer = new Map<string, typeof rows>();
  for (const v of rows) byCustomer.set(v.customerEmail, [...(byCustomer.get(v.customerEmail) ?? []), v]);
  let sent = 0;
  const { sendMail } = await import("./email");
  for (const [customerEmail, vendors] of byCustomer) {
    try {
      const url = `${appBaseUrl()}/hesabim/tedarikci-portfoyu`;
      const html = `<p>Kendi alan adlarınızın bu ayki özeti:</p><ul>${vendors.slice(0, 20).map(ownDomainLine).join("")}</ul><p>Ayrıntılı PDF raporu portföy sayfasındaki "Alan Adı Raporu (PDF)" düğmesinden indirebilir ve düzenli tarama kaydı olarak saklayabilirsiniz: <a href="${url}">Tedarikçi Portföyü</a></p>`;
      for (const to of await customerContacts(customerEmail)) {
        await sendMail({ to, subject: "Kendi alan adlarınızın aylık siber risk özeti", html });
      }
      sent++;
    } catch (err) {
      logger.error({ err, customerEmail }, "Aylık kendi alan adı özeti gönderilemedi");
    }
  }
  return sent;
}
