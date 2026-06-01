import { db } from "@workspace/db";
import { emailSequenceQueueTable } from "@workspace/db";
import { eq, lte, and } from "drizzle-orm";
import { sendMail } from "./email";
import { logger } from "../lib/logger";

// ─── Şablonlar ────────────────────────────────────────────────────────────────

function renderRegistrationEmail(step: number, ctx: Record<string, unknown>): { subject: string; html: string } {
  const name = String(ctx["companyName"] ?? "Sayın Müşteri");
  const templates: Record<number, { subject: string; html: string }> = {
    1: {
      subject: "CyberStep'e Hoş Geldiniz — İlk Taramanızı Yapın",
      html: `<p>Merhaba <strong>${name}</strong>,</p>
<p>CyberStep.io'ya hoş geldiniz. İlk adım olarak domain taramanızı başlatın ve siber güvenlik risk skorunuzu öğrenin.</p>
<a href="https://cyberstep.io/domain-tarama" style="background:#0ea5e9;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">Domain Taramasını Başlat</a>
<p style="color:#64748b;font-size:13px">CyberStep.io ekibi</p>`,
    },
    2: {
      subject: "Domain'inizi Henüz Taramadınız",
      html: `<p>Merhaba <strong>${name}</strong>,</p>
<p>CyberStep'e kayıt olduğunuzdan bu yana domain taramanızı henüz gerçekleştirmediniz. 30 saniyede güvenlik açıklarınızı tespit edin.</p>
<a href="https://cyberstep.io/domain-tarama" style="background:#0ea5e9;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">Hemen Tara</a>`,
    },
    3: {
      subject: "Türkiye'deki Siber Tehditler — Sektörünüz Risk Altında mı?",
      html: `<p>Merhaba <strong>${name}</strong>,</p>
<p>Bu hafta Türkiye'de 47 yeni kimlik avı kampanyası tespit edildi. KOBİ'ler bu saldırıların %68'inin hedefinde.</p>
<p>Ücretsiz Mini Değerlendirme ile şirketinizin hazırlık düzeyini ölçün.</p>
<a href="https://cyberstep.io/degerlendirme/baslat" style="background:#0ea5e9;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">Ücretsiz Değerlendirmeye Başla</a>`,
    },
    4: {
      subject: "Ücretsiz Değerlendirme Hakkınız Sona Eriyor",
      html: `<p>Merhaba <strong>${name}</strong>,</p>
<p>Ücretsiz Mini Değerlendirme hakkınızı henüz kullanmadınız. Bu 20 soruluk analiz şirketinizin zayıf noktalarını ortaya koyar.</p>
<a href="https://cyberstep.io/degerlendirme/baslat" style="background:#ef4444;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">Son Şansı Kaçırmayın</a>`,
    },
    5: {
      subject: "Son Mesaj: CyberStep Hakkında",
      html: `<p>Merhaba <strong>${name}</strong>,</p>
<p>Size bu konuda son mesajımızı gönderiyoruz. Eğer ihtiyaç duyarsanız <a href="https://cyberstep.io">cyberstep.io</a> adresimizde her zaman buradayız.</p>
<p style="color:#64748b;font-size:13px">İyi çalışmalar dileriz.</p>`,
    },
  };
  return templates[step] ?? templates[1]!;
}

function renderAssessmentEmail(step: number, ctx: Record<string, unknown>): { subject: string; html: string } {
  const name = String(ctx["companyName"] ?? "Sayın Müşteri");
  const templates: Record<number, { subject: string; html: string }> = {
    1: {
      subject: "Değerlendirme Hazır — Başlayın",
      html: `<p>Merhaba <strong>${name}</strong>,</p>
<p>Tam Güvenlik Değerlendirmeniz aktif edildi. Değerlendirmeyi tamamlamak için hesabınıza giriş yapın.</p>
<a href="https://cyberstep.io/hesabim" style="background:#0ea5e9;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">Değerlendirmeye Git</a>`,
    },
    2: {
      subject: "Raporunuz Uzman İncelemesinde",
      html: `<p>Merhaba <strong>${name}</strong>,</p>
<p>Değerlendirmeniz uzman ekibimizde incelemede. 24-48 saat içinde doğrulanmış raporunuza ulaşabilirsiniz.</p>`,
    },
    3: {
      subject: "Uzman Doğrulaması Tamamlandı",
      html: `<p>Merhaba <strong>${name}</strong>,</p>
<p>Güvenlik değerlendirmenizdeki bulgular uzman ekibimiz tarafından doğrulandı. Raporunuzu görüntüleyin.</p>
<a href="https://cyberstep.io/hesabim" style="background:#16a34a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">Raporu Görüntüle</a>`,
    },
    4: {
      subject: "Raporunuzdaki En Kritik Bulgu İçin Çözüm",
      html: `<p>Merhaba <strong>${name}</strong>,</p>
<p>Değerlendirme raporunuzdaki en kritik bulgu için kapsamlı çözüm önerimizi inceleyin. SOC servisimiz bu riski 7/24 izler.</p>
<a href="https://cyberstep.io/satin-al/soc-lite" style="background:#0ea5e9;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">SOC Lite İncele</a>`,
    },
  };
  return templates[step] ?? templates[1]!;
}

function renderSOCEmail(step: number, ctx: Record<string, unknown>): { subject: string; html: string } {
  const name = String(ctx["companyName"] ?? "Sayın Müşteri");
  const templates: Record<number, { subject: string; html: string }> = {
    1: {
      subject: "AI SOC Aktif — İzleme Başladı",
      html: `<p>Merhaba <strong>${name}</strong>,</p>
<p>AI SOC servisiniz başarıyla aktive edildi. Sistemleriniz artık 7/24 otomatik izleme altında.</p>
<a href="https://cyberstep.io/hesabim/soc" style="background:#0ea5e9;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">SOC Dashboard'una Git</a>`,
    },
    2: {
      subject: "Fortinet Entegrasyonunu Kurun (30 Dakika)",
      html: `<p>Merhaba <strong>${name}</strong>,</p>
<p>SOC servisinizden maksimum fayda sağlamak için FortiGate entegrasyonunu 30 dakikada kurabilirsiniz.</p>
<a href="https://cyberstep.io/hesabim/fortinet-entegrasyonu" style="background:#f97316;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">Fortinet Kurulum Rehberi</a>`,
    },
    3: {
      subject: "İlk Hafta SOC Özeti",
      html: `<p>Merhaba <strong>${name}</strong>,</p>
<p>SOC servisiniz ilk haftasını tamamladı. Detaylı haftalık özet raporunuza ulaşmak için SOC dashboard'unuzu ziyaret edin.</p>
<a href="https://cyberstep.io/hesabim/soc" style="background:#0ea5e9;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">Haftalık Özeti Görüntüle</a>`,
    },
  };
  return templates[step] ?? templates[1]!;
}

function wrapHtml(content: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;background:#f4f7fb;padding:32px">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
${content}
<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
<p style="color:#94a3b8;font-size:12px">CyberStep.io — KOBİ Siber Güvenlik Platformu | <a href="https://cyberstep.io/abonelik-iptal?ref=email">Abonelikten çık</a></p>
</div></body></html>`;
}

// ─── Kuyruk Yönetimi ──────────────────────────────────────────────────────────

const DELAY_DAYS: Record<string, number[]> = {
  registration: [0, 2, 5, 10, 14],
  full_assessment_purchased: [0, 2, 4, 7],
  soc_activated: [0, 1, 7],
};

export async function enqueueSequence(params: {
  customerId?: number;
  email: string;
  sequenceType: string;
  context?: Record<string, unknown>;
}) {
  const delays = DELAY_DAYS[params.sequenceType];
  if (!delays) {
    logger.warn({ sequenceType: params.sequenceType }, "Unknown email sequence type");
    return;
  }

  const now = new Date();
  const rows = delays.map((days, idx) => {
    const sendAt = new Date(now.getTime() + days * 86_400_000);
    return {
      customerId: params.customerId ?? null,
      email: params.email,
      sequenceType: params.sequenceType,
      step: idx + 1,
      sendAt,
      status: "pending" as const,
      context: params.context ?? {},
    };
  });

  await db.insert(emailSequenceQueueTable).values(rows).onConflictDoNothing();
  logger.info({ email: params.email, sequenceType: params.sequenceType, steps: rows.length }, "Email sequence enqueued");
}

export async function processEmailQueue() {
  const now = new Date();
  const pending = await db.select()
    .from(emailSequenceQueueTable)
    .where(and(
      eq(emailSequenceQueueTable.status, "pending"),
      lte(emailSequenceQueueTable.sendAt, now),
    ))
    .limit(50);

  if (pending.length === 0) return;
  logger.info({ count: pending.length }, "Processing email sequence queue");

  for (const row of pending) {
    try {
      const ctx = (row.context ?? {}) as Record<string, unknown>;
      let template: { subject: string; html: string };

      switch (row.sequenceType) {
        case "registration":
          template = renderRegistrationEmail(row.step, ctx);
          break;
        case "full_assessment_purchased":
          template = renderAssessmentEmail(row.step, ctx);
          break;
        case "soc_activated":
          template = renderSOCEmail(row.step, ctx);
          break;
        default:
          template = { subject: row.subject ?? "CyberStep Bildirimi", html: "<p>Bildirim</p>" };
      }

      await sendMail({ to: row.email, subject: template.subject, html: wrapHtml(template.html) });

      await db.update(emailSequenceQueueTable)
        .set({ status: "sent", sentAt: now })
        .where(eq(emailSequenceQueueTable.id, row.id));

      logger.info({ id: row.id, email: row.email, step: row.step, type: row.sequenceType }, "Sequence email sent");
    } catch (err) {
      logger.error({ err, id: row.id }, "Failed to send sequence email");
      await db.update(emailSequenceQueueTable)
        .set({ status: "failed" })
        .where(eq(emailSequenceQueueTable.id, row.id));
    }
  }
}
