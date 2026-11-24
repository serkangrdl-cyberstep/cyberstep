import { db, tprmVendorTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { logger } from "../lib/logger";
import { appBaseUrl, customerContacts, escapeHtml, isEmailConfigured } from "./tprmRemediation";
import { verificationOf } from "./tprmVerificationStatus";

const DAY = 24 * 60 * 60 * 1000;
export { verificationOf };

/**
 * Kritik ve önemli tedarikçiler için: hiç doğrulanmamış (eklenmesinin üzerinden 30 gün geçmiş), süresi dolmuş veya
 * 30 gün içinde dolacak olanlar müşteriye haftada en fazla bir özet e-postasıyla hatırlatılır (tedarikçi başına ayda bir).
 * E-posta servisi kapalıysa (TPRM_EMAIL_ENABLED) gönderilmez; durum panelde görünür.
 */
export async function runVerificationReminders(now = new Date()): Promise<number> {
  if (!isEmailConfigured()) return 0;
  const rows = await db.select().from(tprmVendorTable)
    .where(and(eq(tprmVendorTable.isOwn, false), eq(tprmVendorTable.monitoringActive, true), inArray(tprmVendorTable.criticality, ["kritik", "onemli"])));
  const byCustomer = new Map<string, typeof rows>();
  for (const v of rows) {
    const { status } = verificationOf(v.lastVerifiedAt, now);
    const due = status === "expired" || status === "expiring" || (status === "never" && now.getTime() - v.addedAt.getTime() > 30 * DAY);
    if (!due) continue;
    if (v.verifyRemindedAt && now.getTime() - v.verifyRemindedAt.getTime() < 30 * DAY) continue;
    byCustomer.set(v.customerEmail, [...(byCustomer.get(v.customerEmail) ?? []), v]);
  }
  let sent = 0;
  for (const [customerEmail, vendors] of byCustomer) {
    try {
      const { sendMail } = await import("./email");
      const list = vendors.slice(0, 20).map((v) => `<li>${escapeHtml(v.supplierName || v.supplierDomain)} (${v.criticality === "kritik" ? "kritik" : "önemli"})</li>`).join("");
      const more = vendors.length > 20 ? `<p>… ve ${vendors.length - 20} tedarikçi daha.</p>` : "";
      const url = `${appBaseUrl()}/hesabim/tedarikci-portfoyu`;
      for (const to of await customerContacts(customerEmail)) {
        await sendMail({
          to,
          subject: `${vendors.length} tedarikçi için yıllık doğrulama zamanı geldi`,
          html: `<p>Kritik ve önemli tedarikçilerinizin yılda en az bir kez doğrulanması iyi uygulamadır (Siber Dayanıklılık Yönetmeliği taslağı da yıllık denetim veya bağımsız rapor ile doğrulama öngörüyor). Aşağıdaki tedarikçilerin doğrulaması yok, süresi dolmuş veya yakında dolacak:</p><ul>${list}</ul>${more}<p>Güncel skoru, anket yanıtını ve kanıt belgelerini kontrol edip portföyden "Doğrulandı" olarak işaretleyebilirsiniz: <a href="${url}">Tedarikçi Portföyü</a></p>`,
        });
      }
      await db.update(tprmVendorTable).set({ verifyRemindedAt: now }).where(inArray(tprmVendorTable.id, vendors.map((v) => v.id)));
      sent++;
    } catch (err) {
      logger.error({ err, customerEmail }, "TPRM doğrulama hatırlatması gönderilemedi");
    }
  }
  return sent;
}
