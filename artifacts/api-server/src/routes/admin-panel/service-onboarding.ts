import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import {
  customerServiceOnboardingTable,
  customerServicesTable,
  serviceCatalogTable,
  customersTable,
  customerServiceSubscriptionsTable,
  adminUsersTable,
  customerServiceConfigsTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAdmin } from "./middleware";
import { logger } from "../../lib/logger";
import { sendMail } from "../../services/email";

const router = Router();

// ─── HTML escape helper (T7 — prevents XSS in email templates) ───────────────
function escapeHtml(s: unknown): string {
  if (typeof s !== "string") return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ─── Service onboarding step definitions ─────────────────────────────────────
export const SERVICE_ONBOARDING_STEPS: Record<string, Array<{ key: string; label: string; description: string }>> = {
  "fortinet-fabric": [
    { key: "api_access_test", label: "API Erişim Testi", description: "FortiManager/FortiGate API bağlantısı test edildi ve kimlik bilgileri doğrulandı." },
    { key: "first_device_connection", label: "İlk Cihaz Bağlantısı", description: "Müşterinin ilk ağ cihazı başarıyla bağlandı ve veri akışı başlatıldı." },
    { key: "alert_thresholds", label: "Alert Eşikleri", description: "Kritik uyarı eşikleri ve bildirim kuralları müşteriyle birlikte yapılandırıldı." },
    { key: "network_segments", label: "Ağ Segmentleri", description: "İzlenecek ağ segmentleri ve VLAN'lar tanımlandı ve yapılandırmaya eklendi." },
  ],
  "dns-izleme": [
    { key: "domains_entered", label: "Alan Adları Listesi Girildi", description: "Müşterinin takip edilecek tüm alan adları sisteme eklendi." },
    { key: "first_scan_completed", label: "İlk Tarama Tamamlandı", description: "Alan adlarının ilk DNS taraması başarıyla tamamlandı ve referans alındı." },
    { key: "notification_email_verified", label: "Bildirim E-postası Doğrulandı", description: "Müşterinin bildirim e-posta adresi doğrulandı ve test bildirimi gönderildi." },
  ],
  "ct-log-izleme": [
    { key: "domains_added", label: "Takip Edilecek Domain'ler Eklendi", description: "CT Log izlemesi için müşterinin domain'leri sisteme tanımlandı." },
    { key: "first_ct_scan", label: "İlk CT Log Taraması Yapıldı", description: "İlk sertifika şeffaflık log taraması tamamlandı ve sonuçlar incelendi." },
  ],
  "ms365": [
    { key: "azure_ad_oauth_completed", label: "Azure AD OAuth Tamamlandı", description: "Müşterinin Microsoft 365 tenant'ı OAuth2 ile bağlandı ve izinler verildi." },
    { key: "first_user_list_fetched", label: "İlk Kullanıcı Listesi Çekildi", description: "Azure AD'den kullanıcı listesi başarıyla alındı ve senkronizasyon doğrulandı." },
    { key: "risk_alert_threshold_set", label: "Risk Uyarısı Eşiği Ayarlandı", description: "Riskli giriş ve anomali uyarıları için eşik değerleri müşteriyle belirlendi." },
  ],
  "kvkk-bildirim": [
    { key: "responsible_person_assigned", label: "Sorumlu Kişi Atandı", description: "KVKK veri koruma sorumlusu atandı ve iletişim bilgileri sisteme eklendi." },
    { key: "data_inventory_received", label: "Veri Envanteri Alındı", description: "Müşterinin kişisel veri envanteri alındı ve kategorilere ayrıldı." },
    { key: "notification_template_approved", label: "Bildirim Şablonu Onaylandı", description: "Kurum'a ve müşterilere gidecek KVKK bildirim şablonu onaylandı." },
  ],
  "servicenow": [
    { key: "webhook_url_configured", label: "Webhook URL Yapılandırıldı", description: "ServiceNow instance'ına CyberStep webhook URL'i tanımlandı ve test edildi." },
    { key: "first_test_event_sent", label: "İlk Test Olayı Gönderildi", description: "Bir test SOC vakası ServiceNow'a başarıyla aktarıldı ve INC oluştu." },
    { key: "business_rule_active", label: "Business Rule Aktif Edildi", description: "ServiceNow'da otomatik yönlendirme Business Rule'u aktifleştirildi." },
  ],
  "soc-operasyon": [
    { key: "analyst_assigned", label: "SOC Analist Ataması Yapıldı", description: "Müşteri için sorumlu SOC analisti atandı ve tanıtım gerçekleştirildi." },
    { key: "escalation_contacts_entered", label: "Eskalasyon İletişim Bilgileri Girildi", description: "Kritik durum eskalasyonu için müşteri tarafındaki yetkili kişi bilgileri alındı." },
    { key: "first_incident_simulation", label: "İlk Olay Simülasyonu", description: "Sentetik bir güvenlik olayı tetiklenerek tam eskalasyon akışı test edildi." },
  ],
  "observability": [
    { key: "log_sources_connected", label: "Log Kaynaklarına Bağlantı Test Edildi", description: "Müşterinin uygulama ve altyapı log kaynakları bağlandı ve veri akışı doğrulandı." },
    { key: "dashboard_created", label: "Dashboard Oluşturuldu", description: "Müşteriye özel observability dashboard'u oluşturuldu ve erişim verildi." },
  ],
};

// ─── Helper: get admin email from session ────────────────────────────────────
async function getAdminEmail(req: Request): Promise<string> {
  const adminId = (req.session as unknown as Record<string, unknown>)["adminId"] as number | undefined;
  if (!adminId) return "admin";
  const [admin] = await db.select({ email: adminUsersTable.email })
    .from(adminUsersTable).where(eq(adminUsersTable.id, adminId)).limit(1);
  return admin?.email ?? "admin";
}

// ─── Helper: build unified active services list for a customer ───────────────
async function getActiveServicesForCustomer(customerId: number): Promise<Array<{
  subscriptionId: number | null;
  slug: string;
  label: string;
}>> {
  // Source 1: customer_services (activated by admin)
  const activeServices = await db.select({
    id: customerServicesTable.id,
    slug: serviceCatalogTable.slug,
    label: serviceCatalogTable.label,
  }).from(customerServicesTable)
    .innerJoin(serviceCatalogTable, eq(customerServicesTable.serviceCatalogId, serviceCatalogTable.id))
    .where(and(
      eq(customerServicesTable.customerId, customerId),
      eq(customerServicesTable.status, "active"),
    ));

  // Source 2: customer_service_subscriptions (self-service purchases)
  const subscriptions = await db.select({
    id: customerServiceSubscriptionsTable.id,
    serviceSlug: customerServiceSubscriptionsTable.serviceSlug,
    serviceLabel: customerServiceSubscriptionsTable.serviceLabel,
  }).from(customerServiceSubscriptionsTable)
    .where(and(
      eq(customerServiceSubscriptionsTable.customerId, customerId),
      eq(customerServiceSubscriptionsTable.status, "active"),
    ));

  const serviceMap = new Map<string, { subscriptionId: number | null; slug: string; label: string }>();
  for (const s of activeServices) {
    if (SERVICE_ONBOARDING_STEPS[s.slug]) {
      serviceMap.set(s.slug, { subscriptionId: s.id, slug: s.slug, label: s.label });
    }
  }
  for (const s of subscriptions) {
    if (!serviceMap.has(s.serviceSlug) && SERVICE_ONBOARDING_STEPS[s.serviceSlug]) {
      serviceMap.set(s.serviceSlug, { subscriptionId: s.id, slug: s.serviceSlug, label: s.serviceLabel });
    }
  }
  return [...serviceMap.values()];
}

// ─── GET /api/admin-panel/onboarding/:customerId ─────────────────────────────
router.get("/admin-panel/onboarding/:customerId", requireAdmin, async (req: Request, res: Response) => {
  const customerId = Number(req.params["customerId"]);
  if (!customerId) { res.status(400).json({ error: "Geçersiz müşteri ID" }); return; }

  try {
    const [customer] = await db.select({
      id: customersTable.id,
      email: customersTable.email,
      fullName: customersTable.fullName,
      companyName: customersTable.companyName,
    }).from(customersTable).where(eq(customersTable.id, customerId)).limit(1);

    if (!customer) { res.status(404).json({ error: "Müşteri bulunamadı" }); return; }

    const servicesList = await getActiveServicesForCustomer(customerId);

    // Get existing onboarding records
    const existing = await db.select()
      .from(customerServiceOnboardingTable)
      .where(eq(customerServiceOnboardingTable.customerId, customerId));

    const existingMap = new Map<string, typeof existing[number]>();
    for (const row of existing) {
      existingMap.set(`${row.serviceSlug}::${row.stepKey}`, row);
    }

    const services = servicesList.map(svc => {
      const stepDefs = SERVICE_ONBOARDING_STEPS[svc.slug] ?? [];
      const steps = stepDefs.map(def => {
        const record = existingMap.get(`${svc.slug}::${def.key}`);
        return {
          key: def.key,
          label: def.label,
          description: def.description,
          status: record?.status ?? "pending",
          completedBy: record?.completedBy ?? null,
          completedAt: record?.completedAt ?? null,
          notes: record?.notes ?? null,
          id: record?.id ?? null,
        };
      });
      const doneCount = steps.filter(s => s.status === "done" || s.status === "skipped").length;
      return {
        slug: svc.slug,
        label: svc.label,
        subscriptionId: svc.subscriptionId,
        steps,
        totalSteps: steps.length,
        doneCount,
        allDone: steps.length > 0 && doneCount === steps.length,
      };
    });

    res.json({ customer, services });
  } catch (err) {
    logger.error({ err, customerId }, "Failed to get onboarding");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── POST /api/admin-panel/onboarding/:customerId/step ───────────────────────
router.post("/admin-panel/onboarding/:customerId/step", requireAdmin, async (req: Request, res: Response) => {
  const customerId = Number(req.params["customerId"]);
  const { serviceSlug, stepKey, status, notes, subscriptionId } = req.body as {
    serviceSlug: string;
    stepKey: string;
    status: "pending" | "in_progress" | "done" | "skipped" | "failed";
    notes?: string;
    subscriptionId?: number;
  };

  if (!customerId || !serviceSlug || !stepKey || !status) {
    res.status(400).json({ error: "serviceSlug, stepKey ve status zorunludur" });
    return;
  }

  const validStatuses = ["pending", "in_progress", "done", "skipped", "failed"];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: "Geçersiz durum" });
    return;
  }

  const stepDefs = SERVICE_ONBOARDING_STEPS[serviceSlug];
  if (!stepDefs) { res.status(400).json({ error: "Bilinmeyen servis slug'ı" }); return; }
  const stepDef = stepDefs.find(s => s.key === stepKey);
  if (!stepDef) { res.status(400).json({ error: "Bilinmeyen step key" }); return; }

  // T11: Step dependency enforcement — a step cannot be marked done before its predecessor
  if (status === "done" || status === "skipped") {
    const stepIndex = stepDefs.findIndex(s => s.key === stepKey);
    if (stepIndex > 0) {
      const prevStep = stepDefs[stepIndex - 1]!;
      const [prevRecord] = await db
        .select({ status: customerServiceOnboardingTable.status })
        .from(customerServiceOnboardingTable)
        .where(and(
          eq(customerServiceOnboardingTable.customerId, customerId),
          eq(customerServiceOnboardingTable.serviceSlug, serviceSlug),
          eq(customerServiceOnboardingTable.stepKey, prevStep.key),
        )).limit(1);
      if (!prevRecord || (prevRecord.status !== "done" && prevRecord.status !== "skipped")) {
        res.status(400).json({ error: `"${prevStep.label}" adımı henüz tamamlanmadı` });
        return;
      }
    }
  }

  try {
    // Resolve admin email safely from session
    const adminEmail = await getAdminEmail(req);

    const completedAt = (status === "done" || status === "skipped") ? new Date() : null;
    const completedBy = (status === "done" || status === "skipped") ? adminEmail : null;
    const failedAt   = status === "failed" ? new Date() : null;

    // T16a: Read current retryCount before upsert so we can detect 3rd failure
    let newRetryCount = 0;
    if (status === "failed") {
      const [existing] = await db
        .select({ retryCount: customerServiceOnboardingTable.retryCount })
        .from(customerServiceOnboardingTable)
        .where(and(
          eq(customerServiceOnboardingTable.customerId, customerId),
          eq(customerServiceOnboardingTable.serviceSlug, serviceSlug),
          eq(customerServiceOnboardingTable.stepKey, stepKey),
        )).limit(1);
      newRetryCount = (existing?.retryCount ?? 0) + 1;
    }

    await db.insert(customerServiceOnboardingTable)
      .values({
        customerId,
        subscriptionId: subscriptionId ?? null,
        serviceSlug,
        stepKey,
        status,
        completedBy,
        completedAt: completedAt ?? undefined,
        failedAt: failedAt ?? undefined,
        failureReason: status === "failed" ? (notes ?? null) : null,
        retryCount: newRetryCount,
        notes: notes ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          customerServiceOnboardingTable.customerId,
          customerServiceOnboardingTable.serviceSlug,
          customerServiceOnboardingTable.stepKey,
        ],
        set: {
          status,
          completedBy: completedBy ?? undefined,
          completedAt: completedAt ?? undefined,
          failedAt: failedAt ?? undefined,
          failureReason: status === "failed" ? (notes ?? null) : undefined,
          retryCount: newRetryCount > 0 ? newRetryCount : undefined,
          notes: notes !== undefined ? notes : undefined,
          updatedAt: new Date(),
        },
      });

    // T16a: 3rd consecutive failure on this step → alert admin
    if (status === "failed" && newRetryCount >= 3) {
      const [failedCustomer] = await db.select({
        email: customersTable.email,
        fullName: customersTable.fullName,
        companyName: customersTable.companyName,
      }).from(customersTable).where(eq(customersTable.id, customerId)).limit(1);

      const adminEmail2 = process.env["SOC_ADMIN_EMAIL"] ?? process.env["SMTP_USER"] ?? "";
      if (failedCustomer && adminEmail2) {
        const safeSlug = escapeHtml(serviceSlug);
        const safeStep = escapeHtml(stepDef.label);
        const safeCompany = escapeHtml(failedCustomer.companyName ?? failedCustomer.fullName ?? `#${customerId}`);
        const safeReason = escapeHtml(notes ?? "Sebep belirtilmedi");

        setImmediate(async () => {
          try {
            await sendMail({
              to: adminEmail2,
              subject: `[Bağlantı Hatası] ${newRetryCount}× — ${safeSlug} / ${safeStep} — ${safeCompany}`,
              html: `
<!DOCTYPE html>
<html lang="tr"><head><meta charset="UTF-8"></head>
<body style="font-family:sans-serif;background:#f8fafc;padding:40px 0;margin:0;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
    <div style="background:#7f1d1d;padding:24px 32px;">
      <span style="color:#fca5a5;font-size:18px;font-weight:700;">Bağlantı Hatası Alarmı</span>
    </div>
    <div style="padding:28px 32px;">
      <p style="color:#1e293b;margin:0 0 16px;">
        <strong>${safeCompany}</strong> müşterisinin <strong>${safeSlug}</strong> servisi,
        <strong>${safeStep}</strong> adımında <strong>${newRetryCount} kez</strong> başarısız oldu.
      </p>
      <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:14px 18px;border-radius:6px;margin-bottom:20px;">
        <p style="margin:0;color:#7f1d1d;font-size:13px;">Son hata: ${safeReason}</p>
      </div>
      <a href="https://cyberstep.io/panel/musteriler/${customerId}/provizyon"
         style="display:inline-block;background:#0f172a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:13px;">
        Müşteri Provizyon Sayfası
      </a>
    </div>
    <div style="background:#f1f5f9;padding:14px 32px;font-size:11px;color:#94a3b8;text-align:center;">
      CyberStep.io — SOC Bildirim Sistemi
    </div>
  </div>
</body>
</html>`,
            });
            logger.warn({ customerId, serviceSlug, stepKey, retryCount: newRetryCount }, "Connection failure alert email sent");
          } catch (emailErr) {
            logger.warn({ emailErr }, "Failed to send connection failure alert email");
          }
        });
      }
    }

    // Check if all steps for this service are now done/skipped → send email
    if (status === "done" || status === "skipped") {
      const allStepKeys = stepDefs.map(s => s.key);
      const records = await db.select({ stepKey: customerServiceOnboardingTable.stepKey, status: customerServiceOnboardingTable.status })
        .from(customerServiceOnboardingTable)
        .where(and(
          eq(customerServiceOnboardingTable.customerId, customerId),
          eq(customerServiceOnboardingTable.serviceSlug, serviceSlug),
        ));
      const doneSet = new Set(records.filter(r => r.status === "done" || r.status === "skipped").map(r => r.stepKey));
      const allDone = allStepKeys.every(k => doneSet.has(k));

      if (allDone) {
        // T12: Auto-activate subscription status when all onboarding steps complete
        await db.update(customerServiceSubscriptionsTable)
          .set({ status: "active" })
          .where(and(
            eq(customerServiceSubscriptionsTable.customerId, customerId),
            eq(customerServiceSubscriptionsTable.serviceSlug, serviceSlug),
            eq(customerServiceSubscriptionsTable.status, "pending"),
          ));

        const [[customer], configRow] = await Promise.all([
          db.select({
            email: customersTable.email,
            fullName: customersTable.fullName,
            companyName: customersTable.companyName,
          }).from(customersTable).where(eq(customersTable.id, customerId)).limit(1),
          db.select({ config: customerServiceConfigsTable.config })
            .from(customerServiceConfigsTable)
            .where(and(
              eq(customerServiceConfigsTable.customerId, customerId),
              eq(customerServiceConfigsTable.serviceSlug, serviceSlug),
            )).limit(1).then(r => r[0] ?? null),
        ]);

        if (customer) {
          const displayName = serviceSlug.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
          const cfg = (configRow?.config ?? {}) as Record<string, unknown>;
          const webhookToken = typeof cfg["webhookToken"] === "string" && cfg["webhookToken"].length > 10 ? cfg["webhookToken"] : null;
          const snmpToken = typeof cfg["snmpToken"] === "string" && cfg["snmpToken"].length > 10 ? cfg["snmpToken"] : null;
          const analystName = typeof cfg["assignedAnalyst"] === "string" && cfg["assignedAnalyst"] ? cfg["assignedAnalyst"] : null;

          const generatedUrlsHtml = (() => {
            const rows: string[] = [];
            const tdLabel = `style="color:#64748b;padding:4px 0;font-size:13px;"`;
            const tdVal = `style="font-family:monospace;font-size:12px;color:#0f172a;padding:4px 0;word-break:break-all;"`;
            if (serviceSlug === "fortinet-fabric" && webhookToken) {
              rows.push(`<tr><td ${tdLabel}>Syslog Endpoint</td><td ${tdVal}>https://cyberstep.io/api/fabric/ingest/${webhookToken}</td></tr>`);
            }
            if (serviceSlug === "noc" && snmpToken) {
              rows.push(`<tr><td ${tdLabel}>SNMP Trap Host</td><td ${tdVal}>snmptrap.cyberstep.io:1162</td></tr>`);
              rows.push(`<tr><td ${tdLabel}>Community / Token</td><td ${tdVal}>${snmpToken}</td></tr>`);
            }
            // T19: ServiceNow webhook URL with token in email
            if ((serviceSlug === "servicenow" || serviceSlug === "servicenow-entegrasyon") && webhookToken) {
              rows.push(`<tr><td ${tdLabel}>ServiceNow Webhook URL</td><td ${tdVal}>https://cyberstep.io/api/integrations/servicenow/webhook/${webhookToken}</td></tr>`);
            }
            if (rows.length === 0) return "";
            return `
              <div style="margin:0 0 24px;">
                <p style="color:#0f172a;font-weight:600;margin:0 0 8px;font-size:14px;">Bağlantı Bilgileriniz</p>
                <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:6px;overflow:hidden;border:1px solid #e2e8f0;">
                  <tbody style="padding:12px;">
                    ${rows.join("")}
                  </tbody>
                </table>
                <p style="color:#64748b;font-size:12px;margin:6px 0 0;">Bu bilgilere istediğiniz zaman <a href="https://cyberstep.io/hesabim/kurulum" style="color:#10b981;">Kurulum Merkezinden</a> de ulaşabilirsiniz.</p>
              </div>`;
          })();

          // T7: HTML-escape user-controlled values before interpolating into email HTML
          const safeName = escapeHtml(customer.fullName ?? customer.companyName ?? "Değerli Müşterimiz");
          const safeDisplayName = escapeHtml(displayName);
          const analystHtml = analystName
            ? `<p style="color:#334155;line-height:1.6;margin:0 0 16px;">Sorumlu analistiniz: <strong>${escapeHtml(analystName)}</strong></p>`
            : "";

          setImmediate(async () => {
            try {
              await sendMail({
                to: customer.email,
                subject: `${safeDisplayName} Servisine Hazırız!`,
                html: `
<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"></head>
<body style="font-family:sans-serif;background:#f8fafc;padding:40px 0;margin:0;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
    <div style="background:#0f172a;padding:28px 32px;">
      <span style="color:#10b981;font-size:20px;font-weight:700;">CyberStep</span>
    </div>
    <div style="padding:32px;">
      <h2 style="color:#0f172a;margin:0 0 16px;">Merhaba ${safeName},</h2>
      <p style="color:#334155;line-height:1.6;margin:0 0 20px;">
        <strong>${safeDisplayName}</strong> servisinin tüm onboarding adımları tamamlandı. Artık servis tam kapasiteyle çalışmaya hazır!
      </p>
      <div style="background:#ecfdf5;border-left:4px solid #10b981;padding:16px 20px;border-radius:6px;margin-bottom:24px;">
        <p style="margin:0;color:#065f46;font-weight:600;">Servis aktif ve kullanıma hazır.</p>
      </div>
      ${analystHtml}
      ${generatedUrlsHtml}
      <p style="color:#334155;line-height:1.6;margin:0 0 24px;">
        Tüm kurulum adımlarınızı ve servis durumunuzu <strong>Kurulum Merkezi</strong>'nden takip edebilirsiniz.
      </p>
      <a href="https://cyberstep.io/hesabim/kurulum" style="display:inline-block;background:#10b981;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
        Kurulum Merkezine Git
      </a>
    </div>
    <div style="background:#f1f5f9;padding:16px 32px;font-size:12px;color:#94a3b8;text-align:center;">
      CyberStep.io — KOBİ Siber Güvenlik Platformu
    </div>
  </div>
</body>
</html>`,
              });
              logger.info({ customerId, serviceSlug }, "Onboarding completion email sent");

            } catch (emailErr) {
              logger.warn({ emailErr }, "Failed to send onboarding completion email");
            }
          });
        }
      }
    }

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err, customerId, serviceSlug, stepKey }, "Failed to update onboarding step");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── GET /api/admin-panel/onboarding — global dashboard ──────────────────────
// Shows ALL active customer services (including those with no step records yet)
router.get("/admin-panel/onboarding", requireAdmin, async (_req: Request, res: Response) => {
  try {
    // 1) Get all customers with active services (source 1: customer_services)
    const activeServices = await db.select({
      customerId: customerServicesTable.customerId,
      subscriptionId: customerServicesTable.id,
      serviceSlug: serviceCatalogTable.slug,
      serviceLabel: serviceCatalogTable.label,
      email: customersTable.email,
      fullName: customersTable.fullName,
      companyName: customersTable.companyName,
    }).from(customerServicesTable)
      .innerJoin(serviceCatalogTable, eq(customerServicesTable.serviceCatalogId, serviceCatalogTable.id))
      .innerJoin(customersTable, eq(customerServicesTable.customerId!, customersTable.id))
      .where(eq(customerServicesTable.status, "active"));

    // 2) Get all from customer_service_subscriptions (source 2)
    const subscriptions = await db.select({
      customerId: customerServiceSubscriptionsTable.customerId,
      subscriptionId: customerServiceSubscriptionsTable.id,
      serviceSlug: customerServiceSubscriptionsTable.serviceSlug,
      serviceLabel: customerServiceSubscriptionsTable.serviceLabel,
      email: customerServiceSubscriptionsTable.email,
    }).from(customerServiceSubscriptionsTable)
      .where(eq(customerServiceSubscriptionsTable.status, "active"));

    // 3) Get all existing step records
    const stepRecords = await db.select({
      customerId: customerServiceOnboardingTable.customerId,
      serviceSlug: customerServiceOnboardingTable.serviceSlug,
      stepKey: customerServiceOnboardingTable.stepKey,
      status: customerServiceOnboardingTable.status,
      updatedAt: customerServiceOnboardingTable.updatedAt,
    }).from(customerServiceOnboardingTable)
      .orderBy(desc(customerServiceOnboardingTable.updatedAt));

    // Build step record lookup: customerId::serviceSlug → { doneCount, lastActivity }
    const stepMap = new Map<string, { doneCount: number; lastActivity: number }>();
    for (const r of stepRecords) {
      const key = `${r.customerId}::${r.serviceSlug}`;
      const existing = stepMap.get(key) ?? { doneCount: 0, lastActivity: 0 };
      if (r.status === "done" || r.status === "skipped") existing.doneCount++;
      const ts = r.updatedAt ? new Date(r.updatedAt).getTime() : 0;
      if (ts > existing.lastActivity) existing.lastActivity = ts;
      stepMap.set(key, existing);
    }

    // 4) Merge into unified list (dedup by customerId::serviceSlug)
    const seen = new Set<string>();
    const rows: Array<{
      customerId: number;
      email: string;
      name: string;
      serviceSlug: string;
      doneCount: number;
      totalSteps: number;
      lastActivity: string | null;
      allDone: boolean;
    }> = [];

    const addRow = (
      customerId: number | null,
      email: string,
      fullName: string | null | undefined,
      companyName: string | null | undefined,
      serviceSlug: string,
    ) => {
      if (!customerId) return;
      const totalSteps = (SERVICE_ONBOARDING_STEPS[serviceSlug] ?? []).length;
      if (totalSteps === 0) return; // skip services with no step definitions
      const key = `${customerId}::${serviceSlug}`;
      if (seen.has(key)) return;
      seen.add(key);
      const stepData = stepMap.get(key) ?? { doneCount: 0, lastActivity: 0 };
      rows.push({
        customerId,
        email,
        name: companyName ?? fullName ?? email,
        serviceSlug,
        doneCount: stepData.doneCount,
        totalSteps,
        lastActivity: stepData.lastActivity > 0 ? new Date(stepData.lastActivity).toISOString() : null,
        allDone: stepData.doneCount >= totalSteps,
      });
    };

    for (const s of activeServices) {
      addRow(s.customerId, s.email, s.fullName, s.companyName, s.serviceSlug);
    }
    for (const s of subscriptions) {
      const custRow = rows.find(r => r.customerId === s.customerId);
      addRow(s.customerId, s.email, custRow?.name ?? null, null, s.serviceSlug);
    }

    // 5) Include all customers not yet in the list (e.g. those with no services)
    const seenCustomerIds = new Set(rows.map(r => r.customerId));
    const allCustomers = await db.select({
      id: customersTable.id,
      email: customersTable.email,
      fullName: customersTable.fullName,
      companyName: customersTable.companyName,
    }).from(customersTable);
    for (const c of allCustomers) {
      if (c.id && !seenCustomerIds.has(c.id)) {
        rows.push({
          customerId: c.id,
          email: c.email,
          name: c.companyName ?? c.fullName ?? c.email,
          serviceSlug: "__no-service__",
          doneCount: 0,
          totalSteps: 0,
          lastActivity: null,
          allDone: false,
        });
      }
    }

    res.json(rows);
  } catch (err) {
    logger.error({ err }, "Failed to get onboarding summary");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;
