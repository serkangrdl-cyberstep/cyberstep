/**
 * Seeds default email templates for a tenant on first setup.
 * Called after tenant creation or via startup for existing tenants with no templates.
 */
import { db } from "@workspace/db";
import { emailTemplatesTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { logger } from "../lib/logger";

const DEFAULT_TEMPLATES = [
  {
    name: "Teklif Takip",
    description: "Gönderilen teklif için müşteri takip maili",
    category: "deal",
    subject: "{{companyName}} — Teklifiniz Hazır",
    bodyHtml: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0">
  <div style="background:#0f172a;padding:24px 32px">
    <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700">Teklifiniz Hazır</h1>
  </div>
  <div style="padding:32px">
    <p style="color:#334155;margin:0 0 16px">Sayın <strong>{{contactName}}</strong>,</p>
    <p style="color:#334155;margin:0 0 16px">
      <strong>{{companyName}}</strong> için hazırladığımız teklifi incelemenizi rica ederiz.
    </p>
    <p style="color:#334155;margin:0 0 24px">
      Herhangi bir sorunuz veya değişiklik talebiniz olursa bu e-postayı yanıtlayabilirsiniz.
    </p>
    <div style="background:#f8fafc;border-radius:6px;padding:16px;margin-bottom:24px">
      <p style="color:#64748b;margin:0;font-size:14px">Teklif Referansı: <strong>#{{dealId}}</strong></p>
    </div>
    <p style="color:#64748b;font-size:13px;margin:0">Saygılarımızla,<br><strong>{{senderName}}</strong><br>{{tenantName}}</p>
  </div>
</div>`,
    variables: ["companyName", "contactName", "dealId", "senderName", "tenantName"],
    isDefault: true,
  },
  {
    name: "Revizyon Yanıtı",
    description: "Müşterinin revizyon talebine yanıt",
    category: "deal",
    subject: "Re: [ISR-REF:DEAL-{{dealId}}] — Revize Teklifiniz",
    bodyHtml: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0">
  <div style="background:#0f172a;padding:24px 32px">
    <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700">Revize Teklifiniz</h1>
  </div>
  <div style="padding:32px">
    <p style="color:#334155;margin:0 0 16px">Sayın <strong>{{contactName}}</strong>,</p>
    <p style="color:#334155;margin:0 0 16px">
      Talebiniz doğrultusunda <strong>{{companyName}}</strong> için teklifimizi güncelledik.
    </p>
    <p style="color:#334155;margin:0 0 24px">
      Revize teklifiniz ekte yer almaktadır. Onayınızı bekliyoruz.
    </p>
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;padding:16px;margin-bottom:24px">
      <p style="color:#9a3412;margin:0;font-size:14px;font-weight:600">Revizyon Notu</p>
      <p style="color:#9a3412;margin:8px 0 0;font-size:14px">{{revisionNotes}}</p>
    </div>
    <p style="color:#64748b;font-size:13px;margin:0">Saygılarımızla,<br><strong>{{senderName}}</strong><br>{{tenantName}}</p>
  </div>
</div>`,
    variables: ["companyName", "contactName", "dealId", "revisionNotes", "senderName", "tenantName"],
    isDefault: true,
  },
  {
    name: "Teklif Onay Talebi",
    description: "Müşteriden teklif onayı iste",
    category: "deal",
    subject: "{{companyName}} — Teklif Onayınız Bekleniyor",
    bodyHtml: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0">
  <div style="background:#0f172a;padding:24px 32px">
    <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700">Teklif Onayınız Bekleniyor</h1>
  </div>
  <div style="padding:32px">
    <p style="color:#334155;margin:0 0 16px">Sayın <strong>{{contactName}}</strong>,</p>
    <p style="color:#334155;margin:0 0 16px">
      <strong>{{companyName}}</strong> için hazırladığımız teklif onayınızı bekliyor.
    </p>
    <p style="color:#334155;margin:0 0 16px">
      Teklife onay vermek veya değişiklik talep etmek için bu e-postayı yanıtlamanız yeterlidir.
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:16px;margin-bottom:24px">
      <p style="color:#166534;margin:0;font-size:14px">Teklif geçerlilik tarihi: <strong>{{validUntil}}</strong></p>
    </div>
    <p style="color:#64748b;font-size:13px;margin:0">Saygılarımızla,<br><strong>{{senderName}}</strong><br>{{tenantName}}</p>
  </div>
</div>`,
    variables: ["companyName", "contactName", "validUntil", "senderName", "tenantName"],
    isDefault: true,
  },
  {
    name: "Siber Güvenlik Hatırlatma",
    description: "Değerlendirme yapmayan müşterilere hatırlatma",
    category: "assessment",
    subject: "{{companyName}} — Siber Güvenlik Değerlendirmenizi Tamamladınız mı?",
    bodyHtml: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0">
  <div style="background:#0f172a;padding:24px 32px">
    <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700">Siber Güvenlik Durumunuzu Biliyor musunuz?</h1>
  </div>
  <div style="padding:32px">
    <p style="color:#334155;margin:0 0 16px">Sayın <strong>{{contactName}}</strong>,</p>
    <p style="color:#334155;margin:0 0 16px">
      KOBİ'lerin %60'ı siber saldırı sonrası 6 ay içinde kapanıyor. 
      <strong>{{companyName}}</strong>'ın risk profilini öğrenmek için 5 dakikanızı ayırın.
    </p>
    <div style="text-align:center;margin:24px 0">
      <a href="{{baseUrl}}/assessment/start" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:600;display:inline-block">
        Ücretsiz Değerlendirme Başlat
      </a>
    </div>
    <p style="color:#64748b;font-size:13px;margin:0">Saygılarımızla,<br><strong>{{senderName}}</strong><br>{{tenantName}}</p>
  </div>
</div>`,
    variables: ["companyName", "contactName", "baseUrl", "senderName", "tenantName"],
    isDefault: true,
  },
];

export async function seedDefaultTemplates(tenantId: number): Promise<void> {
  try {
    const [{ count: existing }] = await db
      .select({ count: count() })
      .from(emailTemplatesTable)
      .where(eq(emailTemplatesTable.tenantId, tenantId));

    if (Number(existing) > 0) return; // Already seeded

    await db.insert(emailTemplatesTable).values(
      DEFAULT_TEMPLATES.map((t) => ({ ...t, tenantId })),
    );

    logger.info({ tenantId, count: DEFAULT_TEMPLATES.length }, "Default email templates seeded");
  } catch (err) {
    logger.error({ err, tenantId }, "Failed to seed default email templates");
  }
}
