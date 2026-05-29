import app from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { adminUsersTable, pricingPlansTable, questionsTable, assessmentsTable, reportsTable, domainScansTable, customersTable } from "@workspace/db";
import { eq, count, sql, and, isNull, lte } from "drizzle-orm";
import { checkSPF, checkDMARC, checkDKIM, checkMX, checkSSL, calcScore, refreshUsomList } from "./routes/domain-scan/index";
import { sendReminderEmail, sendDomainRescanEmail, sendWeeklyDeltaEmail } from "./services/email";
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

          if (scan.email) {
            await sendDomainRescanEmail({
              email: scan.email,
              domain: scan.domain,
              oldScore: scan.overallScore ?? 0,
              newScore,
              spfPass: spf.pass,
              dmarcPass: dmarc.pass,
              dkimPass: dkim.pass,
              mxPass: mx.pass,
              sslPass: ssl.pass,
            });
            if (scoreChanged) {
              logger.info({ domain: scan.domain, oldScore: scan.overallScore, newScore }, "Domain score changed — rescan email sent");
            }
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

  cron.schedule("0 8 * * 1", async () => {
    logger.info("Running weekly delta cron job");
    try {
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const recentScans = await db
        .select()
        .from(domainScansTable)
        .where(
          and(
            sql`${domainScansTable.email} IS NOT NULL`,
            sql`${domainScansTable.createdAt} >= ${sixtyDaysAgo.toISOString()}`
          )
        )
        .orderBy(sql`${domainScansTable.createdAt} DESC`);

      const seenDomains = new Set<string>();
      const uniqueScans = recentScans.filter(s => {
        if (seenDomains.has(s.domain)) return false;
        seenDomains.add(s.domain);
        return true;
      });

      for (const scan of uniqueScans) {
        try {
          const [spf, dmarc, dkim, mx, ssl] = await Promise.all([
            checkSPF(scan.domain),
            checkDMARC(scan.domain),
            checkDKIM(scan.domain),
            checkMX(scan.domain),
            checkSSL(scan.domain),
          ]);
          const newScore = calcScore(spf.pass, dmarc.pass, dkim.pass, mx.pass, ssl.pass);

          const changes: Array<{ check: string; wasPass: boolean; isPass: boolean }> = [];
          if ((scan.spfPass ?? false) !== spf.pass) changes.push({ check: "SPF (Sahte E-posta Koruması)", wasPass: scan.spfPass ?? false, isPass: spf.pass });
          if ((scan.dmarcPass ?? false) !== dmarc.pass) changes.push({ check: "DMARC (E-posta Kimlik Dogrulama)", wasPass: scan.dmarcPass ?? false, isPass: dmarc.pass });
          if ((scan.dkimPass ?? false) !== dkim.pass) changes.push({ check: "DKIM (E-posta Imzalama)", wasPass: scan.dkimPass ?? false, isPass: dkim.pass });
          if ((scan.mxPass ?? false) !== mx.pass) changes.push({ check: "MX Kayıtları", wasPass: scan.mxPass ?? false, isPass: mx.pass });
          if ((scan.sslPass ?? false) !== ssl.pass) changes.push({ check: "SSL Sertifikası", wasPass: scan.sslPass ?? false, isPass: ssl.pass });

          if (changes.length > 0 || newScore !== scan.overallScore) {
            const newIssues = changes.filter(c => !c.isPass && c.wasPass).length;
            const resolvedIssues = changes.filter(c => c.isPass && !c.wasPass).length;

            await db.insert(domainScansTable).values({
              domain: scan.domain,
              email: scan.email,
              spfPass: spf.pass, spfRecord: spf.record ?? null,
              dmarcPass: dmarc.pass, dmarcRecord: dmarc.record ?? null,
              dkimPass: dkim.pass, dkimSelectors: dkim.selectors,
              mxPass: mx.pass, mxRecords: mx.records,
              sslPass: ssl.pass, sslExpiry: ssl.expiryDate ?? null,
              sslIssuer: ssl.issuer ?? null, sslDaysUntilExpiry: ssl.daysUntilExpiry ?? null,
              overallScore: newScore,
            });

            if (scan.email) {
              await sendWeeklyDeltaEmail({
                email: scan.email,
                domain: scan.domain,
                oldScore: scan.overallScore ?? 0,
                newScore,
                changes,
                newIssues,
                resolvedIssues,
                date: new Date().toLocaleDateString("tr-TR"),
              });
            }
            logger.info({ domain: scan.domain, oldScore: scan.overallScore, newScore, changesCount: changes.length }, "Weekly delta email sent");
          } else {
            logger.info({ domain: scan.domain, score: newScore }, "Weekly delta: no changes, skipping email");
          }
        } catch (err) {
          logger.error({ err, domain: scan.domain }, "Weekly delta check failed for domain");
        }
      }
    } catch (err) {
      logger.error({ err }, "Weekly delta cron job failed");
    }
  }, { timezone: "Europe/Istanbul" });

  logger.info("Weekly delta cron scheduled (Monday 08:00 Istanbul)");
}

async function ensureTenantsTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tenants (
      id SERIAL PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT 'free',
      max_users INTEGER NOT NULL DEFAULT 1,
      max_assessments INTEGER NOT NULL DEFAULT 10,
      isr_enabled BOOLEAN NOT NULL DEFAULT false,
      logo_url TEXT,
      primary_color TEXT,
      ai_provider TEXT NOT NULL DEFAULT 'gemini-replit',
      ai_api_key TEXT,
      ai_model TEXT,
      quote_terms TEXT,
      quote_valid_days INTEGER NOT NULL DEFAULT 30,
      quote_footer TEXT,
      imap_host TEXT,
      imap_user TEXT,
      imap_pass TEXT,
      smtp_host TEXT,
      smtp_user TEXT,
      smtp_pass TEXT,
      smtp_port INTEGER NOT NULL DEFAULT 587,
      is_active BOOLEAN NOT NULL DEFAULT true,
      settings JSONB DEFAULT '{}',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tenant_users (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id),
      admin_user_id INTEGER NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      invited_by_admin_user_id INTEGER,
      joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(tenant_id, admin_user_id)
    )
  `);
}

async function ensureIsrTables() {
  // Add tenant_id columns to existing ISR tables if missing
  await db.execute(sql`ALTER TABLE IF EXISTS isr_vendors ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1`);
  await db.execute(sql`ALTER TABLE IF EXISTS isr_distributors ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1`);
  await db.execute(sql`ALTER TABLE IF EXISTS isr_deals ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1`);
  await db.execute(sql`ALTER TABLE IF EXISTS isr_margin_rules ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1`);
  await db.execute(sql`ALTER TABLE IF EXISTS isr_email_inbox ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS isr_vendors (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL DEFAULT 1,
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
      tenant_id INTEGER NOT NULL DEFAULT 1,
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
      tenant_id INTEGER NOT NULL DEFAULT 1,
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
      tenant_id INTEGER NOT NULL DEFAULT 1,
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
      tenant_id INTEGER NOT NULL DEFAULT 1,
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

async function ensureBlogContentColumns() {
  await db.execute(sql`ALTER TABLE IF EXISTS blog_posts ADD COLUMN IF NOT EXISTS seo_title TEXT`);
  await db.execute(sql`ALTER TABLE IF EXISTS blog_posts ADD COLUMN IF NOT EXISTS seo_title_en TEXT`);
  await db.execute(sql`ALTER TABLE IF EXISTS blog_posts ADD COLUMN IF NOT EXISTS meta_description TEXT`);
  await db.execute(sql`ALTER TABLE IF EXISTS blog_posts ADD COLUMN IF NOT EXISTS meta_description_en TEXT`);
  await db.execute(sql`ALTER TABLE IF EXISTS blog_posts ADD COLUMN IF NOT EXISTS focus_keyword TEXT`);
  await db.execute(sql`ALTER TABLE IF EXISTS blog_posts ADD COLUMN IF NOT EXISTS focus_keyword_en TEXT`);
  await db.execute(sql`ALTER TABLE IF EXISTS blog_posts ADD COLUMN IF NOT EXISTS seo_tags JSONB DEFAULT '[]'`);
  await db.execute(sql`ALTER TABLE IF EXISTS blog_posts ADD COLUMN IF NOT EXISTS seo_tags_en JSONB DEFAULT '[]'`);
  await db.execute(sql`ALTER TABLE IF EXISTS blog_posts ADD COLUMN IF NOT EXISTS linkedin_post_tr TEXT`);
  await db.execute(sql`ALTER TABLE IF EXISTS blog_posts ADD COLUMN IF NOT EXISTS linkedin_post_en TEXT`);
  await db.execute(sql`ALTER TABLE IF EXISTS blog_posts ADD COLUMN IF NOT EXISTS instagram_carousel_tr JSONB DEFAULT '[]'`);
  await db.execute(sql`ALTER TABLE IF EXISTS blog_posts ADD COLUMN IF NOT EXISTS instagram_carousel_en JSONB DEFAULT '[]'`);
  await db.execute(sql`ALTER TABLE IF EXISTS blog_posts ADD COLUMN IF NOT EXISTS instagram_caption_tr TEXT`);
  await db.execute(sql`ALTER TABLE IF EXISTS blog_posts ADD COLUMN IF NOT EXISTS instagram_caption_en TEXT`);
  await db.execute(sql`ALTER TABLE IF EXISTS blog_posts ADD COLUMN IF NOT EXISTS visual_prompts_tr JSONB`);
  await db.execute(sql`ALTER TABLE IF EXISTS blog_posts ADD COLUMN IF NOT EXISTS visual_prompts_en JSONB`);
  await db.execute(sql`ALTER TABLE IF EXISTS blog_posts ADD COLUMN IF NOT EXISTS refs_json JSONB DEFAULT '[]'`);
}

async function ensureDomainScanEnrichmentColumns() {
  await db.execute(sql`ALTER TABLE IF EXISTS domain_scans ADD COLUMN IF NOT EXISTS http_headers_score INTEGER NOT NULL DEFAULT 0`);
  await db.execute(sql`ALTER TABLE IF EXISTS domain_scans ADD COLUMN IF NOT EXISTS http_headers_details JSONB DEFAULT '{}'`);
  await db.execute(sql`ALTER TABLE IF EXISTS domain_scans ADD COLUMN IF NOT EXISTS urlhaus_listed BOOLEAN NOT NULL DEFAULT false`);
  await db.execute(sql`ALTER TABLE IF EXISTS domain_scans ADD COLUMN IF NOT EXISTS urlhaus_threat TEXT`);
  await db.execute(sql`ALTER TABLE IF EXISTS domain_scans ADD COLUMN IF NOT EXISTS usom_listed BOOLEAN NOT NULL DEFAULT false`);
  await db.execute(sql`ALTER TABLE IF EXISTS domain_scans ADD COLUMN IF NOT EXISTS ct_subdomains JSONB NOT NULL DEFAULT '[]'`);
  await db.execute(sql`ALTER TABLE IF EXISTS domain_scans ADD COLUMN IF NOT EXISTS ct_subdomain_count INTEGER NOT NULL DEFAULT 0`);
  await db.execute(sql`ALTER TABLE IF EXISTS domain_scans ADD COLUMN IF NOT EXISTS cve_summary JSONB NOT NULL DEFAULT '[]'`);
  await db.execute(sql`ALTER TABLE IF EXISTS domain_scans ADD COLUMN IF NOT EXISTS shodan_open_ports JSONB`);
  await db.execute(sql`ALTER TABLE IF EXISTS domain_scans ADD COLUMN IF NOT EXISTS shodan_vuln_count INTEGER NOT NULL DEFAULT 0`);
  await db.execute(sql`ALTER TABLE IF EXISTS domain_scans ADD COLUMN IF NOT EXISTS shodan_country TEXT`);
  await db.execute(sql`ALTER TABLE IF EXISTS domain_scans ADD COLUMN IF NOT EXISTS shodan_isp TEXT`);
  await db.execute(sql`ALTER TABLE IF EXISTS domain_scans ADD COLUMN IF NOT EXISTS virustotal_reputation INTEGER`);
  await db.execute(sql`ALTER TABLE IF EXISTS domain_scans ADD COLUMN IF NOT EXISTS virustotal_malicious INTEGER NOT NULL DEFAULT 0`);
  await db.execute(sql`ALTER TABLE IF EXISTS domain_scans ADD COLUMN IF NOT EXISTS virustotal_suspicious INTEGER NOT NULL DEFAULT 0`);
  await db.execute(sql`ALTER TABLE IF EXISTS domain_scans ADD COLUMN IF NOT EXISTS abuseipdb_score INTEGER`);
  await db.execute(sql`ALTER TABLE IF EXISTS domain_scans ADD COLUMN IF NOT EXISTS abuseipdb_total_reports INTEGER NOT NULL DEFAULT 0`);
  await db.execute(sql`ALTER TABLE IF EXISTS domain_scans ADD COLUMN IF NOT EXISTS abuseipdb_country TEXT`);
  await db.execute(sql`ALTER TABLE IF EXISTS domain_scans ADD COLUMN IF NOT EXISTS abuseipdb_isp TEXT`);
  await db.execute(sql`ALTER TABLE IF EXISTS domain_scans ADD COLUMN IF NOT EXISTS safe_browsing_flagged BOOLEAN`);
  await db.execute(sql`ALTER TABLE IF EXISTS domain_scans ADD COLUMN IF NOT EXISTS safe_browsing_threats JSONB NOT NULL DEFAULT '[]'`);
  await db.execute(sql`ALTER TABLE IF EXISTS domain_scans ADD COLUMN IF NOT EXISTS ssl_labs_grade TEXT`);
}

async function updatePricingPlanFeatures() {
  await db.update(pricingPlansTable).set({
    features: [
      "20 soruluk hızlı risk değerlendirmesi",
      "5 güvenlik alanı (A-E)",
      "Anlık risk skoru ve seviyesi",
      "Kırmızı alarm tespiti",
      "Yapay zeka destekli temel rapor",
      "Domain tarama: SPF, DMARC, DKIM, MX, SSL",
      "HIBP veri sızıntısı kontrolü",
      "Kara liste ve Shadow IT tespiti",
    ],
  }).where(eq(pricingPlansTable.slug, "mini"));

  await db.update(pricingPlansTable).set({
    features: [
      "55 soruluk kapsamlı risk değerlendirmesi",
      "10 güvenlik alanı (A-J)",
      "Detaylı Gemini AI raporu",
      "Mini değerlendirmedeki tüm özellikler dahil",
      "HTTP güvenlik başlıkları analizi",
      "URLhaus & USOM zararlı alan taraması",
      "crt.sh Alt Alan Şeffaflığı (subdomain tespiti)",
      "NIST NVD CVE güvenlik açığı taraması",
      "VirusTotal domain reputation taraması",
      "AbuseIPDB IP kötüye kullanım geçmişi",
      "Shodan internet maruziyet taraması (ücretli)",
      "KVKK Madde 12 Teknik Tedbir Haritası",
      "NIST CSF 2.0 Uyum Seviyesi",
      "PDF rapor indirme",
      "30 günlük otomatik yeniden tarama bildirimi",
      "Sektörel karşılaştırma",
      "Birebir uzman danışmanlık görüşmesi (1 saat)",
    ],
  }).where(eq(pricingPlansTable.slug, "full"));
}

async function ensureReportEnrichmentColumns() {
  await db.execute(sql`ALTER TABLE IF EXISTS reports ADD COLUMN IF NOT EXISTS estimated_breach_cost_min INTEGER`);
  await db.execute(sql`ALTER TABLE IF EXISTS reports ADD COLUMN IF NOT EXISTS estimated_breach_cost_max INTEGER`);
  await db.execute(sql`ALTER TABLE IF EXISTS reports ADD COLUMN IF NOT EXISTS risk_reduction_percent INTEGER`);
  await db.execute(sql`ALTER TABLE IF EXISTS reports ADD COLUMN IF NOT EXISTS weekly_action_plan JSONB NOT NULL DEFAULT '[]'::jsonb`);
  await db.execute(sql`ALTER TABLE IF EXISTS reports ADD COLUMN IF NOT EXISTS kvkk_penalty_min INTEGER`);
  await db.execute(sql`ALTER TABLE IF EXISTS reports ADD COLUMN IF NOT EXISTS kvkk_penalty_max INTEGER`);
  await db.execute(sql`ALTER TABLE IF EXISTS reports ADD COLUMN IF NOT EXISTS kvkk_risk_level TEXT`);
  await db.execute(sql`ALTER TABLE IF EXISTS reports ADD COLUMN IF NOT EXISTS kvkk_risk_articles JSONB NOT NULL DEFAULT '[]'::jsonb`);
  await db.execute(sql`ALTER TABLE IF EXISTS reports ADD COLUMN IF NOT EXISTS kvkk_risk_summary TEXT`);
  await db.execute(sql`ALTER TABLE IF EXISTS reports ADD COLUMN IF NOT EXISTS sector_benchmark_percent INTEGER`);
  await db.execute(sql`ALTER TABLE IF EXISTS reports ADD COLUMN IF NOT EXISTS sector_benchmark_comment TEXT`);
}

async function ensureSecurityAdvisoriesTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS security_advisories (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      link TEXT,
      summary TEXT,
      severity TEXT DEFAULT 'medium',
      sector TEXT,
      published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (title, source)
    )
  `);
  const res = await db.execute(sql`SELECT COUNT(*) as cnt FROM security_advisories`);
  const cnt = Number((res.rows[0] as Record<string, unknown>)["cnt"] ?? 0);
  if (cnt === 0) {
    const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000);
    const seeds = [
      { title: "Türkiye Geneli KOBİ'lere Yönelik Fidye Yazılım Saldırıları Artıyor", source: "USOM", summary: "Türkiye genelinde küçük ve orta ölçekli işletmeleri hedef alan fidye yazılım saldırılarında belirgin artış gözlemlenmektedir. Güncel yedek alınması ve e-posta filtrelerinin güncellenmesi kritik önem taşımaktadır.", severity: "high", published_at: daysAgo(2) },
      { title: "İş E-postası Ele Geçirme (BEC) Saldırıları: IBAN Değişikliği Dolandırıcılığı", source: "BTK", summary: "Muhasebe ve finans çalışanlarını hedef alan sosyal mühendislik saldırılarında artış görülmektedir. IBAN değişiklik taleplerini her zaman telefon ile doğrulayın.", severity: "high", published_at: daysAgo(5) },
      { title: "Microsoft: Windows Defender SmartScreen Kritik Güvenlik Açığı (CVE-2024-21412)", source: "Microsoft", summary: "Windows Defender SmartScreen bileşeninde güvenlik filtrelerini atlayan kritik açık tespit edildi. Tüm Windows sistemlerin güncellenmesi gerekmektedir.", severity: "critical", published_at: daysAgo(8) },
      { title: "Phishing Kampanyası: Türk Bankalarını Taklit Eden Sahte E-postalar", source: "USOM", summary: "Türk bankalarının adını kullanan kimlik avı e-postaları tespit edildi. Banka bağlantılarını e-postadan değil tarayıcıdan doğrudan açın.", severity: "medium", published_at: daysAgo(12) },
    ];
    for (const s of seeds) {
      await db.execute(sql`
        INSERT INTO security_advisories (title, source, summary, severity, published_at)
        VALUES (${s.title}, ${s.source}, ${s.summary}, ${s.severity}, ${s.published_at})
        ON CONFLICT DO NOTHING
      `);
    }
    logger.info("Security advisories demo data seeded");
  }
}

async function ensureEmailTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS email_templates (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL DEFAULT 'custom',
      subject TEXT NOT NULL,
      body_html TEXT NOT NULL,
      body_text TEXT,
      variables JSONB DEFAULT '[]',
      is_default BOOLEAN NOT NULL DEFAULT false,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS email_sends (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL,
      template_id INTEGER,
      to_email TEXT NOT NULL,
      to_name TEXT,
      subject TEXT NOT NULL,
      body_html TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'sent',
      related_type TEXT,
      related_id INTEGER,
      error TEXT,
      sent_at TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
}

// ─── Startup: demo müşteri hesabını oluştur (yoksa veya şifre yanlışsa) ───────
async function maybeSeedDemoCustomer() {
  const DEMO_EMAIL = "demo@cyberstep.io";
  const DEMO_PASSWORD = "Demo2024!";

  const [existing] = await db.select({ id: customersTable.id, passwordHash: customersTable.passwordHash })
    .from(customersTable)
    .where(eq(customersTable.email, DEMO_EMAIL));

  const correctHash = "$2b$12$KRWNZYbJaAvqMH8GoDhJteL830QrbCj3oa.cNwew0XkGEH5UACZsy";

  if (!existing) {
    await db.insert(customersTable).values({
      email: DEMO_EMAIL,
      passwordHash: correctHash,
      fullName: "Demo Kullanici",
      companyName: "Demo Sirket",
    });
    logger.info("Demo customer created");
    return;
  }

  // Şifre hash'i yanlışsa güncelle
  const ok = await bcrypt.compare(DEMO_PASSWORD, existing.passwordHash);
  if (!ok) {
    await db.update(customersTable)
      .set({ passwordHash: correctHash, updatedAt: new Date() })
      .where(eq(customersTable.id, existing.id));
    logger.info("Demo customer password reset to Demo2024!");
  }
}

async function startup() {
  await maybeResetAdminPassword();
  await ensureQuestionsTable();
  await ensureTenantsTable();
  await ensureIsrTables();
  await ensureEmailTables();
  await maybeSeedPricingPlans();
  await maybeSeedQuestions();
  await maybeSeedDemoCustomer();
  await ensureBlogContentColumns();
  await ensureDomainScanEnrichmentColumns();
  await ensureReportEnrichmentColumns();
  await ensureSecurityAdvisoriesTable();
  await updatePricingPlanFeatures();
}

startup()
  .then(() => {
    startReminderCron();
    startIsrImapCron();
    // USOM zararlı alan listesini arka planda yükle ve günlük yenile
    refreshUsomList().catch((err) => logger.warn({ err }, "USOM initial fetch failed"));
    cron.schedule("0 3 * * *", () => {
      refreshUsomList().catch((err) => logger.warn({ err }, "USOM daily refresh failed"));
    });
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
