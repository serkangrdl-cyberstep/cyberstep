/**
 * Onboarding Email Serisi — D+0 / D+1 / D+3 / D+7
 *
 * Tablo eşleştirmesi:
 *   customerOnboarding.welcomeEmailSentAt → customer_onboarding.welcome_email_sent_at
 *   customerOnboarding.day1EmailSentAt    → customer_onboarding.day1_email_sent_at
 *   D+3 / D+7                            → mevcut sendOnboardingD3/D7Email korunuyor
 */

import { db } from "@workspace/db";
import { customersTable, customerOnboardingTable } from "@workspace/db";
import { eq, and, isNull, gte, lte, lt } from "drizzle-orm";
import { sendMail } from "./email";
import { getClaudeAiFn } from "./ai-client";
import { logger } from "../lib/logger";

const BASE_URL = process.env["REPLIT_DOMAINS"]
  ? `https://${process.env["REPLIT_DOMAINS"].split(",")[0]?.trim()}`
  : "http://localhost:80";

const ai = getClaudeAiFn("claude-haiku-4-5");

// ─── Onboarding durumu yardımcısı ─────────────────────────────────────────────

async function getOnboarding(customerId: number) {
  const [row] = await db.select().from(customerOnboardingTable)
    .where(eq(customerOnboardingTable.customerId, customerId)).limit(1);
  return row;
}

// ─── Hoşgeldin emaili (D+0 — ödeme sonrası tetiklenir) ───────────────────────

export async function sendWelcomeEmail(customerId: number): Promise<void> {
  const [customer] = await db.select().from(customersTable)
    .where(eq(customersTable.id, customerId)).limit(1);
  if (!customer) return;

  const onboarding = await getOnboarding(customerId);
  if (onboarding?.welcomeEmailSentAt) return;

  await db.insert(customerOnboardingTable).values({
    customerId,
    stepPayment: true,
    welcomeEmailSentAt: new Date(),
  }).onConflictDoNothing();

  if (onboarding) {
    await db.update(customerOnboardingTable)
      .set({ stepPayment: true, welcomeEmailSentAt: new Date() })
      .where(eq(customerOnboardingTable.customerId, customerId));
  }

  const body = `Sayın ${customer.fullName},<br><br>
CyberStep hesabınız hazır! Aşağıdaki adımları tamamlayarak siber güvenlik izlemenizi başlatın:<br><br>
<ol>
<li><a href="${BASE_URL}/portal">Portale giriş yapın</a></li>
<li>İlk domain'inizi ekleyin</li>
<li>Otomatik tarama başlasın</li>
</ol>
<p><a href="${BASE_URL}/portal" style="background:#10b981;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block">Portale Git</a></p>`;

  await sendMail({
    to: customer.email,
    subject: "CyberStep hesabınız hazır — hemen başlayın",
    html: `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">${body}<hr><p style="font-size:12px;color:#888">CyberStep.io</p></body></html>`,
  });

  logger.info({ customerId }, "Welcome email sent");
}

// ─── Servis-özel onboarding içeriği ──────────────────────────────────────────

export function getServiceSpecificOnboardingContent(serviceSlug: string): {
  d1_extra: string;
  d3_extra: string;
  expectations: string;
} {
  const content: Record<string, { d1_extra: string; d3_extra: string; expectations: string }> = {
    "microsoft-365": {
      d1_extra:
        `Microsoft 365 entegrasyonu için 15 dakikalık kurulum rehberini inceleyin: ${BASE_URL}/hesabim/kurulum`,
      d3_extra:
        "Henüz bağlamadıysanız kurulum sırasında sorun yaşarsanız destek@cyberstep.io yazın.",
      expectations:
        "Kurulum 15 dakika sürüyor. Azure AD riskli girişleri ve M365 güvenlik uyarıları otomatik izlenmeye başlar.",
    },
    "full-assessment": {
      d1_extra:
        `60 soruluk değerlendirmeye başlamak için portalınızı ziyaret edin: ${BASE_URL}/hesabim`,
      d3_extra:
        "Değerlendirmenizi tamamladıysanız raporunuz 3-5 iş günü içinde gelecek.",
      expectations:
        "Bu değerlendirme dışarıdan görünen güvenlik risklerini, KVKK ve 7545 uyum boşluklarını tespit eder. Aktif sızma testi (pentest) değildir. Raporunuz 3-5 iş günü içinde emailinize gelecek.",
    },
    "pentest-lite-tek": {
      d1_extra:
        `Analiz kapsamını belirtmek için formu doldurun: ${BASE_URL}/hesabim/kurulum`,
      d3_extra:
        "Kapsam formu onaylandıktan sonra analiz 5-7 iş günü içinde tamamlanır.",
      expectations:
        "Bu hizmet penetrasyon testi (pentest) değildir. Sisteme aktif erişim yapılmaz. Dışarıdan saldırgan perspektifini simüle eder.",
    },
    "pentest-lite-5domain": {
      d1_extra:
        `5 domain için analiz kapsamını belirtmek için formu doldurun: ${BASE_URL}/hesabim/kurulum`,
      d3_extra:
        "Kapsam formu onaylandıktan sonra analiz 5-7 iş günü içinde tamamlanır.",
      expectations:
        "Bu hizmet penetrasyon testi (pentest) değildir. Sisteme aktif erişim yapılmaz. Dışarıdan saldırgan perspektifini simüle eder.",
    },
    "pentest-lite-yillik": {
      d1_extra:
        `Yıllık analiz kapsamını belirtmek için formu doldurun: ${BASE_URL}/hesabim/kurulum`,
      d3_extra:
        "İlk kapsam formu onaylandıktan sonra analiz 5-7 iş günü içinde tamamlanır.",
      expectations:
        "Bu hizmet penetrasyon testi (pentest) değildir. Sisteme aktif erişim yapılmaz. Her çeyrek dışarıdan pasif analiz yapılır.",
    },
    "cve-izleme-pro": {
      d1_extra:
        `FortiGate bağlantısı için kurulum rehberine bakın: ${BASE_URL}/hesabim/kurulum`,
      d3_extra:
        "Otomatik blok açmadan önce beyaz listeyi kurmayı unutmayın!",
      expectations:
        "Otomatik blok varsayılan kapalıdır. Aktif ettiğinizde her blok işlemi loglanır ve geri alınabilir.",
    },
    "phishing-simulation": {
      d1_extra:
        `Analiz formunu doldurun: ${BASE_URL}/hesabim/kurulum`,
      d3_extra:
        "Formunuzu aldık. Rapor 2-3 iş günü içinde gelecek.",
      expectations:
        "Bu hizmet gerçek email göndermez. Saldırı senaryoları ve çalışan farkındalık raporu üretilir.",
    },
    "servicenow": {
      d1_extra:
        "Kurulum randevusu için: destek@cyberstep.io adresine yazın. Teknik ekibimiz aynı gün döner.",
      d3_extra:
        "Kurulum toplantısı henüz planlanmadıysa lütfen iletişime geçin: destek@cyberstep.io",
      expectations:
        "Kurulum CyberStep teknik ekibiyle birlikte yapılır (2-4 saat). 3.000 TL kurulum ücreti tek seferlik.",
    },
  };

  return content[serviceSlug] ?? { d1_extra: "", d3_extra: "", expectations: "" };
}

// ─── D+1 emaili ──────────────────────────────────────────────────────────────

export async function runDay1EmailCron(): Promise<number> {
  const from = new Date(Date.now() - 2 * 86_400_000);
  const to   = new Date(Date.now() - 1 * 86_400_000);

  const targets = await db.select({
    customer: customersTable,
    onboarding: customerOnboardingTable,
  }).from(customersTable)
    .innerJoin(customerOnboardingTable, eq(customerOnboardingTable.customerId, customersTable.id))
    .where(
      and(
        gte(customersTable.createdAt, from),
        lt(customersTable.createdAt, to),
        isNull(customerOnboardingTable.day1EmailSentAt),
      )
    );

  let sent = 0;

  for (const { customer, onboarding } of targets) {
    const completedCount = [
      onboarding.stepPayment,
      onboarding.stepFirstScan,
      onboarding.stepMiniAssessment,
      onboarding.stepServiceActivated,
    ].filter(Boolean).length;

    const prompt = `Müşteri ${customer.companyName ?? customer.fullName} için 1. gün onboarding emaili yaz.
${!onboarding.stepFirstScan ? "Domain eklemedilerse nasıl ekleyeceklerini anlat." : "İlk taramaları tamamlandı, tebrik et."}
Tamamlanan adım: ${completedCount}/6. Türkçe, kısa, max 4 cümle.`;

    const content = await ai(prompt).catch(() =>
      `Portale girerek ilk domain'inizi ekleyin ve otomatik taramayı başlatın. Sadece birkaç dakika sürer.`,
    );

    await sendMail({
      to: customer.email,
      subject: "CyberStep — 1. gün hatırlatması",
      html: `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
<p>Sayın ${customer.fullName},</p>
<p>${content.replace(/\n/g, "<br>")}</p>
<p><a href="${BASE_URL}/portal" style="background:#10b981;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block">Portale Git</a></p>
<hr><p style="font-size:12px;color:#888">CyberStep.io</p>
</body></html>`,
    }).catch(err => logger.warn({ err, customerId: customer.id }, "D+1 email failed"));

    await db.update(customerOnboardingTable)
      .set({ day1EmailSentAt: new Date() })
      .where(eq(customerOnboardingTable.customerId, customer.id));

    sent++;
  }

  return sent;
}
