/**
 * CISO Asistan — Güvenlik Politikası Kütüphanesi
 * 7 politika şablonunu Claude ile üretir, security_policies tablosuna kaydeder.
 */

import { callModel } from "@workspace/ai";
import { db } from "@workspace/db";
import {
  cisoAssistantSubscriptionsTable,
  securityPoliciesTable,
  customersTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../../lib/logger";

const SYSTEM_PROMPT = `Sen Türkiye'deki işletmeler için siber güvenlik politikaları yazan uzman bir hukuk+güvenlik danışmanısın.
7545 Sayılı Siber Güvenlik Kanunu ve KVKK uyumlu, profesyonel, uygulanabilir Türkçe politikalar yaz.
Madde madde, net başlıklar. Gereksiz uzatma.`;

async function callClaude(prompt: string, maxTokens = 1200): Promise<string> {
  try {
    return await callModel({ task: "policy-gen", system: SYSTEM_PROMPT, messages: [{ role: "user", content: prompt }], maxTokens });
  } catch (err) {
    logger.warn({ err }, "Politika üretimi Claude hatası");
    return "";
  }
}

const POLICIES: Record<string, { title: string; prompt: string }> = {
  information_security: {
    title: "Bilgi Güvenliği Politikası",
    prompt: `{COMPANY} ({SECTOR} sektörü, ~{EMPLOYEES} çalışan) için kapsamlı Bilgi Güvenliği Politikası yaz.
Bölümler: Amaç, Kapsam, Sorumluluklar, Bilgi Sınıflandırma, Erişim Kontrolü, Şifre Politikası, Olay Bildirimi, Uyumsuzluk Sonuçları.
7545 ve KVKK uyumlu. Türkçe, sade, uygulanabilir.`,
  },
  password: {
    title: "Şifre Yönetimi Politikası",
    prompt: `{COMPANY} için Şifre Yönetimi Politikası yaz.
Minimum 12 karakter, karmaşıklık kuralları, 90 günlük değiştirme, MFA zorunluluğu, şifre paylaşım yasağı, şifre yöneticisi kullanımı.
Türkçe, madde madde.`,
  },
  remote_work: {
    title: "Uzaktan Çalışma Güvenlik Politikası",
    prompt: `{COMPANY} için Uzaktan Çalışma Güvenlik Politikası yaz.
VPN zorunluluğu, güvenli ağ kullanımı, ekran kilidi, cihaz şifreleme, rapor ve veri koruma, ev ağı güvenliği.
Türkçe, uygulanabilir.`,
  },
  byod: {
    title: "Kişisel Cihaz (BYOD) Politikası",
    prompt: `{COMPANY} için BYOD Politikası yaz.
Hangi cihazlar izinli, kayıt zorunluluğu, MDM gereksinimleri, kurumsal veri silme hakkı, kayıp/çalıntı durumu, güvenlik gereksinimleri.
Türkçe.`,
  },
  data_classification: {
    title: "Veri Sınıflandırma Politikası",
    prompt: `{COMPANY} için Veri Sınıflandırma Politikası yaz.
KVKK kapsamında kişisel veri kategorileri. 4 gizlilik seviyesi: Halka Açık, İç Kullanım, Gizli, Çok Gizli — her seviye için işleme kuralları.
VERBİS uyumlu. Türkçe.`,
  },
  incident_response: {
    title: "Siber Olay Müdahale Prosedürü",
    prompt: `{COMPANY} için Siber Olay Müdahale Prosedürü yaz.
7545 kapsamında 72 saat BTK bildirim yükümlülüğü. P1/P2/P3 olay seviyeleri, eskalasyon zinciri, ilk müdahale adımları, iletişim planı, olay kapatma ve post-mortem.
Türkçe, adım adım.`,
  },
  vendor_assessment: {
    title: "Tedarikçi Güvenlik Değerlendirme Formu",
    prompt: `{COMPANY} için tedarikçi güvenlik değerlendirme formu yaz.
KVKK madde 12 ve BDDK 3. taraf risk yönetimi uyumlu. 20-25 soru: Evet/Hayır + kanıt belgesi alanı.
Konular: veri işleme, şifreleme, erişim kontrolü, olay bildirimi, denetim hakkı, alt işlemciler.
Türkçe, tablo formatı.`,
  },
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function generatePolicyLibrary(customerId: number): Promise<number> {
  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, customerId))
    .limit(1);

  if (!customer) throw new Error(`Müşteri bulunamadı: ${customerId}`);

  const [sub] = await db
    .select()
    .from(cisoAssistantSubscriptionsTable)
    .where(eq(cisoAssistantSubscriptionsTable.customerId, customerId))
    .limit(1);

  const companyVars = {
    COMPANY: customer.companyName ?? customer.email,
    SECTOR: sub?.sector ?? (customer as unknown as { sector?: string }).sector ?? "teknoloji",
    EMPLOYEES: sub?.employeeCount?.toString() ?? "50-200",
  };

  let generated = 0;

  for (const [key, policy] of Object.entries(POLICIES)) {
    const existing = await db
      .select({ id: securityPoliciesTable.id })
      .from(securityPoliciesTable)
      .where(
        and(
          eq(securityPoliciesTable.customerId, customerId),
          eq(securityPoliciesTable.policyType, key)
        )
      )
      .limit(1);

    if (existing[0]) continue;

    const prompt = policy.prompt
      .replace(/{COMPANY}/g, companyVars.COMPANY)
      .replace(/{SECTOR}/g, companyVars.SECTOR)
      .replace(/{EMPLOYEES}/g, companyVars.EMPLOYEES);

    const content = await callClaude(prompt);
    if (!content) continue;

    await db.insert(securityPoliciesTable).values({
      customerId,
      policyType: key,
      title: policy.title,
      content,
      status: "draft",
    });

    generated++;
    logger.info({ customerId, policyType: key }, "Politika üretildi");
    await sleep(900);
  }

  if (sub) {
    await db
      .update(cisoAssistantSubscriptionsTable)
      .set({
        policiesGeneratedAt: new Date(),
        policiesCount: generated,
        updatedAt: new Date(),
      })
      .where(eq(cisoAssistantSubscriptionsTable.customerId, customerId));
  }

  return generated;
}
