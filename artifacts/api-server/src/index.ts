import app from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { adminUsersTable, pricingPlansTable, questionsTable, assessmentsTable, reportsTable, domainScansTable } from "@workspace/db";
import { eq, count, sql, and, isNull, lte } from "drizzle-orm";
import { checkSPF, checkDMARC, checkDKIM, checkMX, checkSSL, calcScore } from "./routes/domain-scan/index";
import { sendReminderEmail } from "./services/email";
import cron from "node-cron";
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

  // Domain re-tarama: e-postası olan ve 30+ gün önce taranan kayıtları yeniden tara
  cron.schedule("30 9 * * *", async () => {
    logger.info("Running domain re-scan cron job");
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const due = await db
        .select()
        .from(domainScansTable)
        .where(
          and(
            sql`${domainScansTable.email} IS NOT NULL`,
            lte(domainScansTable.createdAt, thirtyDaysAgo),
            isNull(domainScansTable.notifiedAt),
          )
        );

      for (const scan of due) {
        try {
          const [spf, dmarc, dkim, mx, ssl] = await Promise.all([
            checkSPF(scan.domain),
            checkDMARC(scan.domain),
            checkDKIM(scan.domain),
            checkMX(scan.domain),
            checkSSL(scan.domain),
          ]);
          const newScore = calcScore(spf.pass, dmarc.pass, dkim.pass, mx.pass, ssl.pass);
          const scoreChanged = newScore !== scan.overallScore;

          await db.insert(domainScansTable).values({
            domain: scan.domain,
            email: scan.email,
            spfPass: spf.pass,
            spfRecord: spf.record,
            dmarcPass: dmarc.pass,
            dmarcRecord: dmarc.record,
            dkimPass: dkim.pass,
            dkimSelectors: dkim.selectors,
            mxPass: mx.pass,
            mxRecords: mx.records,
            sslPass: ssl.pass,
            sslExpiry: ssl.expiryDate,
            sslIssuer: ssl.issuer,
            sslDaysUntilExpiry: ssl.daysUntilExpiry,
            overallScore: newScore,
            notifiedAt: new Date(),
          });

          await db.update(domainScansTable)
            .set({ notifiedAt: new Date() })
            .where(eq(domainScansTable.id, scan.id));

          if (scoreChanged && scan.email) {
            logger.info({ domain: scan.domain, oldScore: scan.overallScore, newScore }, "Domain score changed — email notification skipped (TODO: implement domain change email)");
          }
          logger.info({ domain: scan.domain, newScore }, "Domain re-scan complete");
        } catch (err) {
          logger.error({ err, domain: scan.domain }, "Domain re-scan failed for single domain");
        }
      }
    } catch (err) {
      logger.error({ err }, "Domain re-scan cron job failed");
    }
  }, { timezone: "Europe/Istanbul" });

  logger.info("Domain re-scan cron scheduled (09:30 Istanbul)");
}

async function ensureIsrTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS isr_vendors (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      display_name TEXT NOT NULL,
      logo_url TEXT,
      sales_rep_name TEXT,
      sales_rep_email TEXT,
      deal_reg_url TEXT,
      notes TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS isr_distributors (
      id SERIAL PRIMARY KEY,
      vendor_id INTEGER NOT NULL REFERENCES isr_vendors(id),
      name TEXT NOT NULL,
      contact_name TEXT,
      contact_email TEXT NOT NULL,
      phone TEXT,
      notes TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS isr_deals (
      id SERIAL PRIMARY KEY,
      customer_name TEXT,
      customer_email TEXT NOT NULL,
      customer_company TEXT,
      customer_phone TEXT,
      vendor_id INTEGER REFERENCES isr_vendors(id),
      vendor_name TEXT,
      product_keywords TEXT,
      original_subject TEXT,
      original_body TEXT,
      ai_summary TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      assigned_rep_email TEXT,
      priority TEXT NOT NULL DEFAULT 'normal',
      notes TEXT,
      email_message_id TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS isr_rfqs (
      id SERIAL PRIMARY KEY,
      deal_id INTEGER NOT NULL REFERENCES isr_deals(id),
      distributor_id INTEGER REFERENCES isr_distributors(id),
      sent_to_email TEXT NOT NULL,
      sent_to_name TEXT,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'sent',
      email_message_id TEXT,
      sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
      responded_at TIMESTAMP
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS isr_rfq_responses (
      id SERIAL PRIMARY KEY,
      rfq_id INTEGER NOT NULL REFERENCES isr_rfqs(id),
      deal_id INTEGER NOT NULL REFERENCES isr_deals(id),
      from_email TEXT NOT NULL,
      subject TEXT,
      body TEXT,
      ai_parsed JSONB,
      currency TEXT NOT NULL DEFAULT 'TRY',
      valid_until TEXT,
      notes TEXT,
      received_at TIMESTAMP NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS isr_quote_lines (
      id SERIAL PRIMARY KEY,
      rfq_response_id INTEGER REFERENCES isr_rfq_responses(id),
      quote_id INTEGER,
      sku TEXT,
      description TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_cost NUMERIC(18,4),
      unit_price NUMERIC(18,4),
      discount NUMERIC(5,2) DEFAULT 0,
      line_total NUMERIC(18,4),
      currency TEXT NOT NULL DEFAULT 'TRY',
      is_custom BOOLEAN NOT NULL DEFAULT false,
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS isr_quotes (
      id SERIAL PRIMARY KEY,
      deal_id INTEGER NOT NULL REFERENCES isr_deals(id),
      quote_number TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'TRY',
      subtotal NUMERIC(18,4),
      kdv_rate NUMERIC(5,2) DEFAULT 20,
      kdv_amount NUMERIC(18,4),
      total NUMERIC(18,4),
      valid_days INTEGER NOT NULL DEFAULT 30,
      notes TEXT,
      terms TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      approved_by_email TEXT,
      approved_at TIMESTAMP,
      sent_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS isr_margin_rules (
      id SERIAL PRIMARY KEY,
      vendor_id INTEGER REFERENCES isr_vendors(id),
      name TEXT NOT NULL,
      min_margin_pct NUMERIC(5,2) NOT NULL DEFAULT 15,
      target_margin_pct NUMERIC(5,2) NOT NULL DEFAULT 25,
      max_discount_pct NUMERIC(5,2) NOT NULL DEFAULT 10,
      auto_approve_below NUMERIC(18,4),
      require_approval_above NUMERIC(18,4),
      is_default BOOLEAN NOT NULL DEFAULT false,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS isr_email_inbox (
      id SERIAL PRIMARY KEY,
      message_id TEXT NOT NULL UNIQUE,
      from_email TEXT NOT NULL,
      from_name TEXT,
      to_email TEXT,
      subject TEXT,
      body_text TEXT,
      body_html TEXT,
      processed_as TEXT,
      deal_id INTEGER REFERENCES isr_deals(id),
      rfq_id INTEGER REFERENCES isr_rfqs(id),
      received_at TIMESTAMP NOT NULL,
      processed_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
}

function startIsrImapCron() {
  cron.schedule("*/5 * * * *", async () => {
    try {
      const { processInbox } = await import("./services/isr-imap");
      await processInbox();
    } catch (err) {
      logger.error({ err }, "ISR IMAP cron error");
    }
  });
  logger.info("ISR IMAP poller scheduled (every 5 minutes)");
}

async function startup() {
  await maybeResetAdminPassword();
  await ensureQuestionsTable();
  await ensureIsrTables();
  await maybeSeedPricingPlans();
  await maybeSeedQuestions();
}

startup()
  .then(() => {
    startReminderCron();
    startIsrImapCron();
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
