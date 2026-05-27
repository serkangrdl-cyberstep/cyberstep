import app from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { adminUsersTable, pricingPlansTable, questionsTable, assessmentsTable, reportsTable } from "@workspace/db";
import { eq, count, sql, and, isNull, lte } from "drizzle-orm";
import cron from "node-cron";
import { sendReminderEmail } from "./services/email";
import bcrypt from "bcryptjs";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// ─── Startup: admin şifre sıfırlama (opsiyonel) ───────────────────────────────
async function maybeResetAdminPassword() {
  const resetPassword = process.env["ADMIN_RESET_PASSWORD"];
  if (!resetPassword) return;

  if (resetPassword.length < 12) {
    logger.warn("ADMIN_RESET_PASSWORD set but too short (min 12 chars) — skipping reset");
    return;
  }

  const [admin] = await db.select({ id: adminUsersTable.id, email: adminUsersTable.email })
    .from(adminUsersTable)
    .limit(1);

  if (!admin) {
    logger.warn("ADMIN_RESET_PASSWORD set but no admin user found — skipping reset");
    return;
  }

  const hash = await bcrypt.hash(resetPassword, 12);
  await db.update(adminUsersTable)
    .set({ passwordHash: hash })
    .where(eq(adminUsersTable.id, admin.id));

  logger.info({ email: admin.email }, "Admin password reset via ADMIN_RESET_PASSWORD env var — remove the var now!");
}

// ─── Startup: questions tablosunu oluştur (yoksa) ────────────────────────────
async function ensureQuestionsTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS questions (
      id SERIAL PRIMARY KEY,
      number INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'mini',
      domain TEXT NOT NULL,
      text TEXT NOT NULL,
      weight INTEGER NOT NULL DEFAULT 1,
      is_red_alarm BOOLEAN NOT NULL DEFAULT false,
      is_active BOOLEAN NOT NULL DEFAULT true,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

// ─── Startup: fiyatlandırma planlarını seed et (boşsa) ───────────────────────
async function maybeSeedPricingPlans() {
  const [{ cnt }] = await db.select({ cnt: count() }).from(pricingPlansTable);
  if (Number(cnt) > 0) return;

  await db.insert(pricingPlansTable).values([
    {
      slug: "mini",
      name: "Mini Değerlendirme",
      price: "0",
      currency: "TRY",
      description: "20 soruluk hızlı siber güvenlik risk taraması",
      features: ["20 soru, 5 alan", "Yapay zeka destekli rapor", "Risk skoru ve seviyesi", "Ücretsiz"],
      isActive: true,
      sortOrder: 0,
    },
    {
      slug: "full",
      name: "Tam Değerlendirme",
      price: "2990",
      currency: "TRY",
      description: "55 soruluk kapsamlı siber güvenlik denetimi",
      features: ["55 soru, 10 alan", "Detaylı Yapay Zeka raporu", "Sektörel karşılaştırma", "PDF rapor", "Danışman desteği"],
      isActive: true,
      sortOrder: 1,
    },
    {
      slug: "premium",
      name: "Premium Danışmanlık",
      price: "9990",
      currency: "TRY",
      description: "Tam değerlendirme + birebir danışman görüşmesi",
      features: ["Tam değerlendirme dahil", "2 saat birebir danışmanlık", "Öncelikli aksiyon planı", "Yıllık takip görüşmesi"],
      isActive: true,
      sortOrder: 2,
    },
  ]);

  logger.info("Pricing plans seeded (table was empty)");
}

// ─── Startup: Mini Assessment sorularını seed et (boşsa) ─────────────────────
async function maybeSeedQuestions() {
  const [{ cnt }] = await db.select({ cnt: count() }).from(questionsTable);
  if (Number(cnt) > 0) return;

  const MINI_SEED = [
    { number: 1,  domain: "Firma ve Yönetişim",             text: "Şirketinizde siber güvenlikten ana sorumlu bir kişi veya rol net olarak tanımlı mı?",                                       weight: 1, isRedAlarm: false },
    { number: 2,  domain: "Firma ve Yönetişim",             text: "Kritik iş uygulamalarınızın ve temel sistemlerinizin listesi güncel olarak mevcut mu?",                                       weight: 1, isRedAlarm: false },
    { number: 3,  domain: "Firma ve Yönetişim",             text: "Yeni işe giren ve işten ayrılan çalışanlar için kullanıcı hesabı açma/kapama süreci tanımlı mı?",                            weight: 2, isRedAlarm: true  },
    { number: 4,  domain: "Firma ve Yönetişim",             text: "Şirketinizde hassas bilgilerin hangi sistemlerde tutulduğu güncel bir envanterle takip ediliyor mu?",                        weight: 1, isRedAlarm: false },
    { number: 5,  domain: "Kimlik ve Erişim",               text: "Çalışanlar e-posta ve iş uygulamalarına girerken MFA/2FA kullanıyor mu?",                                                    weight: 2, isRedAlarm: true  },
    { number: 6,  domain: "Kimlik ve Erişim",               text: "Uzak erişim, VPN, yönetici yetkili hesaplarda ek doğrulama zorunlu mu?",                                                     weight: 2, isRedAlarm: true  },
    { number: 7,  domain: "Kimlik ve Erişim",               text: "İşten ayrılan çalışanların sistem erişimleri aynı gün kaldırılıyor mu?",                                                     weight: 2, isRedAlarm: true  },
    { number: 8,  domain: "Kimlik ve Erişim",               text: "Aynı kullanıcı hesabının birden fazla kişi tarafından kullanımı engelleniyor mu?",                                           weight: 1, isRedAlarm: false },
    { number: 9,  domain: "E-posta ve İnsan Faktörü",       text: "Çalışanlara şüpheli e-posta ve parola hırsızlığı riskleri hakkında farkındalık eğitimi veriliyor mu?",                       weight: 1, isRedAlarm: false },
    { number: 10, domain: "E-posta ve İnsan Faktörü",       text: "Şüpheli e-posta geldiğinde çalışanların bunu kime bildireceği biliniyor mu?",                                                weight: 1, isRedAlarm: false },
    { number: 11, domain: "E-posta ve İnsan Faktörü",       text: "IBAN değişikliği veya acil para transferi gibi durumlarda e-posta dışında ikinci doğrulama uygulanıyor mu?",                 weight: 2, isRedAlarm: true  },
    { number: 12, domain: "E-posta ve İnsan Faktörü",       text: "E-posta alan adınız üzerinden sahte mail gönderilmesini engelleyecek (SPF, DKIM, DMARC) yapılandırmalar devrede mi?",        weight: 2, isRedAlarm: true  },
    { number: 13, domain: "Cihaz Güvenliği",                text: "Şirkette kullanılan bilgisayarların güncel bir listesi tutuluyor mu?",                                                        weight: 1, isRedAlarm: false },
    { number: 14, domain: "Cihaz Güvenliği",                text: "Çalışan bilgisayarlarında zararlı yazılımlara karşı merkezi bir güvenlik çözümü bulunuyor mu?",                             weight: 2, isRedAlarm: true  },
    { number: 15, domain: "Cihaz Güvenliği",                text: "Bilgisayarlar ve iş uygulamaları düzenli olarak güncelleniyor mu?",                                                          weight: 1, isRedAlarm: false },
    { number: 16, domain: "Cihaz Güvenliği",                text: "Dizüstü veya mobil cihazlarda ekran kilidi ve güçlü parola uygulanıyor mu?",                                                 weight: 1, isRedAlarm: false },
    { number: 17, domain: "Veri Koruma ve Yedekleme",       text: "Kritik verileriniz düzenli olarak (tercihen otomatik) yedekleniyor mu?",                                                     weight: 2, isRedAlarm: true  },
    { number: 18, domain: "Veri Koruma ve Yedekleme",       text: "Alınan yedeklerin geri yüklenip çalışabildiği son 12 ayda test edildi mi?",                                                  weight: 2, isRedAlarm: true  },
    { number: 19, domain: "Veri Koruma ve Yedekleme",       text: "Bir siber olay yaşanırsa ilk kimin devreye gireceği ve ne yapılacağı yazılı olarak belli mi?",                               weight: 1, isRedAlarm: false },
    { number: 20, domain: "Veri Koruma ve Yedekleme",       text: "Hassas dosyalara kimlerin erişebildiği düzenli olarak kontrol ediliyor mu?",                                                 weight: 1, isRedAlarm: false },
  ];

  await db.insert(questionsTable).values(
    MINI_SEED.map((q, i) => ({ ...q, type: "mini", isActive: true, sortOrder: i }))
  );

  logger.info("Mini assessment questions seeded (table was empty)");
}

// ─── Cron: 30-günlük hatırlatıcı e-postası (her gün 09:00'da çalışır) ─────────
function startReminderCron() {
  cron.schedule("0 9 * * *", async () => {
    logger.info("Running 30-day reminder cron job");
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyOneDaysAgo = new Date();
      thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);

      const due = await db
        .select({
          id: assessmentsTable.id,
          companyName: assessmentsTable.companyName,
          contactName: assessmentsTable.contactName,
          email: assessmentsTable.email,
          riskLevel: assessmentsTable.riskLevel,
          totalScore: assessmentsTable.totalScore,
          maxScore: assessmentsTable.maxScore,
        })
        .from(assessmentsTable)
        .where(
          and(
            sql`${assessmentsTable.status} = 'report_ready'`,
            isNull(assessmentsTable.reminderSentAt),
            lte(assessmentsTable.completedAt, thirtyDaysAgo),
            sql`${assessmentsTable.completedAt} >= ${thirtyOneDaysAgo}`,
          )
        );

      const base = process.env["REPLIT_DOMAINS"]
        ? `https://${process.env["REPLIT_DOMAINS"].split(",")[0]?.trim()}`
        : "http://localhost:80";

      for (const a of due) {
        const scorePercent = a.totalScore && a.maxScore
          ? Math.round((a.totalScore / a.maxScore) * 100)
          : 0;
        await sendReminderEmail({
          assessmentId: a.id,
          companyName: a.companyName,
          contactName: a.contactName,
          customerEmail: a.email,
          riskLevel: a.riskLevel ?? "Bilinmiyor",
          scorePercent,
          assessmentUrl: `${base}/assessment/${a.id}/report`,
        });
        await db
          .update(assessmentsTable)
          .set({ reminderSentAt: new Date() })
          .where(eq(assessmentsTable.id, a.id));

        logger.info({ assessmentId: a.id }, "Reminder email sent and reminderSentAt updated");
      }

      if (due.length === 0) {
        logger.info("No reminders due today");
      }
    } catch (err) {
      logger.error({ err }, "Reminder cron job failed");
    }
  }, { timezone: "Europe/Istanbul" });

  logger.info("30-day reminder cron scheduled (09:00 Istanbul)");
}

async function startup() {
  await maybeResetAdminPassword();
  await ensureQuestionsTable();
  await maybeSeedPricingPlans();
  await maybeSeedQuestions();
}

startup()
  .then(() => {
    startReminderCron();
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");
    });
  })
  .catch((err: unknown) => {
    logger.error({ err }, "Startup error");
    process.exit(1);
  });
