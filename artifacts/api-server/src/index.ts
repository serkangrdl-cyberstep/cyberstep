import app from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { adminUsersTable, pricingPlansTable, questionsTable, assessmentsTable, reportsTable, domainScansTable, customersTable, partnersTable, workPackagesTable, blogPostsTable } from "@workspace/db";
import { eq, count, sql, and, isNull, lte } from "drizzle-orm";
import { checkSPF, checkDMARC, checkDKIM, checkMX, checkSSL, calcScore, refreshUsomList } from "./routes/domain-scan/index";
import { loadApiKeysFromDb } from "./routes/admin-panel/settings";
import { sendReminderEmail, sendDomainRescanEmail, sendWeeklyDeltaEmail, sendMail } from "./services/email";
import { generateAndPublishBlogPost } from "./services/blog-autopilot";
import { startFabricCrons } from "./services/fabric-cron";
import { scanCRTSH } from "./services/crtshScanner";
import { scanShodanFree, SHODAN_FREE_QUERIES } from "./services/shodanDiscovery";
import { qualifyPendingCandidates, getISOWeek } from "./services/discoveryPipeline";
import { processCertstreamQueue } from "./services/certstreamLeadProcessor";
import { cronStart, cronIsEnabled, cronGetLimit } from "./services/cronRegistry";
import { checkSubscriptionExpiryReminders } from "./services/subscription-renewal";
import { startSOCCrons } from "./services/soc/soc-cron";
import { startDnsCrons } from "./services/dns-cron";
import { startCertstreamClient } from "./services/certstream-client";
import { ensureCtTable } from "./routes/ct-monitor/index";
import { ensureMs365Tables } from "./routes/ms365/index";
import { ensureCustomerServiceConfigsTable } from "./routes/customer/index";
import { ensureKvkkTables, checkKvkkDeadlines } from "./services/kvkkAssessor";
import { ensureServiceNowTables, syncServiceNowIncidents, checkServiceNowConnections } from "./services/serviceNowClient";
import { ensureWebhookTables, retryFailedWebhooks } from "./services/webhookDispatcher";
import { ensureTelegramTables } from "./services/telegramNotifier";
import { ensureNetgsmTables } from "./services/netgsmNotifier";
import { initSOCWebSocket } from "./services/soc/soc-ws";
import { runScanLeadDripCron } from "./routes/scan-leads/index";
import { collectRSSFeeds, seedDefaultSources } from "./routes/digest/rss-collector";
import { generateWeeklyDigest } from "./routes/digest/claude-processor";
import { calculateAllHealthScores } from "./routes/health/index";
import { runCollectionReminderCron } from "./services/invoice";
import { runAutoTagCron, runTaskReminderCron, runNpsCron } from "./routes/crm/index";
import { startRenewalCron } from "./services/subscription-renewal";
import { processEmailQueue } from "./services/email-sequences";
import {
  runFortiGatePollCron,
  runAvailabilityCron,
  runNOCTriageCron,
  checkAndCompleteBaselines,
} from "./services/noc-service";
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
      description: "20 soruluk ücretsiz başlangıç değerlendirmesi",
      features: ["20 soruluk hızlı risk değerlendirmesi", "5 güvenlik alanı (A-E)", "Anlık risk skoru ve seviyesi", "Kırmızı alarm tespiti", "Yapay zeka destekli temel rapor"],
      isActive: true,
      sortOrder: 0,
    },
    {
      slug: "full",
      name: "Tam Değerlendirme",
      price: "5990",
      currency: "TRY",
      description: "55 soruluk kapsamlı siber güvenlik denetimi — Claude AI destekli detaylı rapor",
      features: ["55 soruluk kapsamlı risk değerlendirmesi", "10 güvenlik alanı (A-J)", "Claude AI destekli detaylı rapor", "PDF rapor indirme", "Sektörel karşılaştırma", "Birebir uzman danışmanlık görüşmesi (1 saat)"],
      isActive: true,
      sortOrder: 1,
    },
    {
      slug: "premium",
      name: "Premium Danışmanlık",
      price: "17990",
      currency: "TRY",
      description: "Kişisel danışmanlık, saha değerlendirmesi ve 6 ay uzman desteği",
      features: ["Tam değerlendirme dahil", "1-1 uzman görüşmesi", "Saha incelemesi", "Teknik yol haritası", "6 ay takip desteği"],
      isActive: true,
      sortOrder: 2,
    },
    {
      slug: "starter",
      name: "Başlangıç Aboneliği",
      price: "690",
      currency: "TRY",
      description: "1-10 çalışanlı KOBİler için aylık sürekli izleme",
      features: ["Alan adı otomatik yeniden tarama (30 günlük)", "Mini değerlendirme erişimi", "Sızıntı izleyici bildirimleri", "E-posta destek", "Claude AI destekli temel rapor"],
      isActive: true,
      sortOrder: 3,
    },
    {
      slug: "growth",
      name: "Büyüme Aboneliği",
      price: "1990",
      currency: "TRY",
      description: "11-200 çalışanlı KOBİler için kapsamlı aylık koruma",
      features: ["Tam değerlendirme (yılda 2)", "Tüm domain tarama modülleri", "KVKK uyum haritası", "Sektörel kıyaslama raporu", "Öncelikli e-posta desteği", "Claude AI destekli detaylı rapor"],
      isActive: true,
      sortOrder: 4,
    },
    {
      slug: "enterprise",
      name: "Kurumsal Abonelik",
      price: "5990",
      currency: "TRY",
      description: "200+ çalışanlı işletmeler için kurumsal siber güvenlik yönetimi",
      features: ["Sınırsız değerlendirme", "Birebir danışman görüşmesi (aylık)", "ISR tehdit istihbaratı", "TPRM tedarik zinciri taraması", "White-label raporlama", "SLA destekli öncelikli destek", "Claude AI gelişmiş analiz"],
      isActive: true,
      sortOrder: 5,
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
  // ─── Enterprise & LeadGen tables ─────────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS enterprise_prospects (
      id SERIAL PRIMARY KEY,
      company_name VARCHAR(255) NOT NULL,
      domain VARCHAR(255) NOT NULL,
      sector VARCHAR(100),
      employee_count VARCHAR(50),
      city VARCHAR(100),
      contact_name VARCHAR(255),
      contact_title VARCHAR(100),
      contact_email VARCHAR(255),
      contact_phone VARCHAR(50),
      linkedin_url VARCHAR(500),
      source VARCHAR(50) DEFAULT 'manual',
      assigned_to VARCHAR(100),
      status VARCHAR(30) DEFAULT 'new',
      notes TEXT,
      lost_reason VARCHAR(255),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      last_activity_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS teaser_reports (
      id SERIAL PRIMARY KEY,
      prospect_id INTEGER REFERENCES enterprise_prospects(id),
      domain_scan_data JSONB,
      attack_scenarios JSONB,
      overall_risk_score INTEGER,
      risk_level VARCHAR(20),
      critical_count INTEGER DEFAULT 0,
      high_count INTEGER DEFAULT 0,
      medium_count INTEGER DEFAULT 0,
      low_count INTEGER DEFAULT 0,
      teaser_headline TEXT,
      teaser_findings JSONB,
      teaser_scenario_preview TEXT,
      locked_sections_hint TEXT,
      urgency_note TEXT,
      preview_token VARCHAR(64) UNIQUE NOT NULL,
      email_sent_at TIMESTAMP,
      email_opened_at TIMESTAMP,
      preview_viewed_at TIMESTAMP,
      cta_clicked_at TIMESTAMP,
      cta_contact_name VARCHAR(255),
      cta_contact_email VARCHAR(255),
      cta_contact_phone VARCHAR(50),
      cta_message TEXT,
      followup_1_sent_at TIMESTAMP,
      followup_2_sent_at TIMESTAMP,
      approved_by VARCHAR(100),
      approved_at TIMESTAMP,
      status VARCHAR(20) DEFAULT 'draft',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS enterprise_contracts (
      id SERIAL PRIMARY KEY,
      prospect_id INTEGER REFERENCES enterprise_prospects(id),
      customer_id INTEGER,
      contract_number VARCHAR(30) UNIQUE NOT NULL,
      company_name VARCHAR(255) NOT NULL,
      company_tax_id VARCHAR(50),
      company_tax_office VARCHAR(100),
      company_address TEXT,
      billing_contact_name VARCHAR(255),
      billing_contact_email VARCHAR(255),
      contract_type VARCHAR(30) DEFAULT 'annual',
      billing_cycle VARCHAR(20) DEFAULT 'annual',
      payment_method VARCHAR(30) DEFAULT 'bank_transfer',
      payment_terms INTEGER DEFAULT 30,
      start_date DATE NOT NULL,
      end_date DATE,
      total_amount_tl DECIMAL(12,2),
      discount_pct INTEGER DEFAULT 0,
      discount_reason VARCHAR(255),
      status VARCHAR(30) DEFAULT 'draft',
      sent_at TIMESTAMP,
      signed_at TIMESTAMP,
      signed_by VARCHAR(255),
      activated_at TIMESTAMP,
      activated_by VARCHAR(100),
      contract_pdf_path VARCHAR(500),
      signed_pdf_path VARCHAR(500),
      internal_notes TEXT,
      created_by VARCHAR(100),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS enterprise_contract_services (
      id SERIAL PRIMARY KEY,
      contract_id INTEGER REFERENCES enterprise_contracts(id),
      service_slug VARCHAR(100) NOT NULL,
      service_name VARCHAR(255) NOT NULL,
      unit_price_tl DECIMAL(10,2) NOT NULL,
      quantity INTEGER DEFAULT 1,
      line_total_tl DECIMAL(10,2) NOT NULL,
      is_active BOOLEAN DEFAULT false,
      activated_at TIMESTAMP,
      expires_at TIMESTAMP,
      usage_limit INTEGER,
      usage_count INTEGER DEFAULT 0,
      notes VARCHAR(500),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS enterprise_invoices (
      id SERIAL PRIMARY KEY,
      contract_id INTEGER REFERENCES enterprise_contracts(id),
      customer_id INTEGER,
      invoice_number VARCHAR(30) UNIQUE NOT NULL,
      period_start DATE,
      period_end DATE,
      subtotal_tl DECIMAL(12,2),
      vat_rate INTEGER DEFAULT 20,
      vat_amount_tl DECIMAL(12,2),
      total_tl DECIMAL(12,2),
      due_date DATE,
      paid_at TIMESTAMP,
      paid_amount_tl DECIMAL(12,2),
      status VARCHAR(20) DEFAULT 'pending',
      pdf_path VARCHAR(500),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS lead_scan_queue (
      id SERIAL PRIMARY KEY,
      domain VARCHAR(255) NOT NULL,
      company_name VARCHAR(255),
      source VARCHAR(50),
      scan_status VARCHAR(20) DEFAULT 'pending',
      domain_scan_data JSONB,
      risk_score INTEGER,
      risk_level VARCHAR(20),
      critical_count INTEGER DEFAULT 0,
      high_count INTEGER DEFAULT 0,
      lead_score INTEGER,
      lead_score_factors JSONB,
      contacts JSONB,
      imported_at TIMESTAMP,
      imported_to_customer_id INTEGER,
      skipped_reason VARCHAR(255),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      scanned_at TIMESTAMP
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS contact_enrichment_log (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER,
      domain VARCHAR(255),
      apollo_searched_at TIMESTAMP,
      apollo_contacts_found INTEGER DEFAULT 0,
      apollo_data JSONB,
      hunter_searched_at TIMESTAMP,
      hunter_emails_found INTEGER DEFAULT 0,
      hunter_data JSONB,
      linkedin_searched_at TIMESTAMP,
      linkedin_notes TEXT,
      selected_contact_name VARCHAR(255),
      selected_contact_title VARCHAR(100),
      selected_contact_email VARCHAR(255),
      selected_contact_phone VARCHAR(50),
      selected_contact_linkedin VARCHAR(500),
      selection_confidence VARCHAR(20),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS sales_team (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      title VARCHAR(100),
      phone VARCHAR(50),
      is_active BOOLEAN DEFAULT true,
      monthly_target_tl DECIMAL(12,2),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS lead_campaigns (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      target_sectors TEXT[],
      target_employee_min INTEGER,
      target_employee_max INTEGER,
      target_cities TEXT[],
      sources TEXT[],
      status VARCHAR(20) DEFAULT 'active',
      domains_found INTEGER DEFAULT 0,
      domains_scanned INTEGER DEFAULT 0,
      leads_imported INTEGER DEFAULT 0,
      deals_created INTEGER DEFAULT 0,
      deals_won INTEGER DEFAULT 0,
      created_by VARCHAR(100),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMP
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

// ─── Cron: Scan lead e-posta aktivasyon dizisi (her saat bir kez) ─────────────
function startScanLeadDripCron() {
  cron.schedule("0 * * * *", async () => {
    try {
      await runScanLeadDripCron();
    } catch (err) {
      logger.error({ err }, "Scan lead drip cron error");
    }
  }, { timezone: "Europe/Istanbul" });
  logger.info("Scan lead drip cron scheduled (hourly)");
}

async function ensureAssessmentsColumns() {
  await db.execute(sql`ALTER TABLE IF EXISTS assessments ADD COLUMN IF NOT EXISTS tenant_id INTEGER`);
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
  await db.execute(sql`ALTER TABLE IF EXISTS domain_scans ADD COLUMN IF NOT EXISTS badge_token TEXT`);
  await db.execute(sql`ALTER TABLE IF EXISTS domain_scans ADD COLUMN IF NOT EXISTS referral_source TEXT`);
  await db.execute(sql`ALTER TABLE IF EXISTS domain_scans ADD COLUMN IF NOT EXISTS kep_configured BOOLEAN`);
  await db.execute(sql`ALTER TABLE IF EXISTS domain_scans ADD COLUMN IF NOT EXISTS kep_relays JSONB NOT NULL DEFAULT '[]'::jsonb`);
  await db.execute(sql`ALTER TABLE IF EXISTS domain_scans ADD COLUMN IF NOT EXISTS kep_secure BOOLEAN`);
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
  await db.execute(sql`ALTER TABLE IF EXISTS reports ADD COLUMN IF NOT EXISTS verbis_required BOOLEAN`);
  await db.execute(sql`ALTER TABLE IF EXISTS reports ADD COLUMN IF NOT EXISTS verbis_risk_level TEXT`);
  await db.execute(sql`ALTER TABLE IF EXISTS reports ADD COLUMN IF NOT EXISTS verbis_steps JSONB NOT NULL DEFAULT '[]'::jsonb`);
  await db.execute(sql`ALTER TABLE IF EXISTS reports ADD COLUMN IF NOT EXISTS insurance_readiness_percent INTEGER`);
  await db.execute(sql`ALTER TABLE IF EXISTS reports ADD COLUMN IF NOT EXISTS insurance_gaps JSONB NOT NULL DEFAULT '[]'::jsonb`);
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

async function maybeSeedPaidTestCustomer() {
  const TEST_EMAIL = "test@cyberstep.io";
  const TEST_HASH = "$2b$12$l/8PXqA3HJIDhY9igm5BSugQMPcpvqXE47nMN.Hdb72o43IwigVzq";

  const [existing] = await db.select({ id: customersTable.id, subscriptionPlan: customersTable.subscriptionPlan })
    .from(customersTable)
    .where(eq(customersTable.email, TEST_EMAIL));

  if (!existing) {
    await db.insert(customersTable).values({
      email: TEST_EMAIL,
      passwordHash: TEST_HASH,
      fullName: "Test Kullanici",
      companyName: "CyberStep Test A.S.",
      subscriptionPlan: "full",
      subscriptionStatus: "active",
    });
    logger.info("Paid test customer created: test@cyberstep.io");
    return;
  }

  if (existing.subscriptionPlan !== "full") {
    await db.update(customersTable)
      .set({ subscriptionPlan: "full", subscriptionStatus: "active", updatedAt: new Date() })
      .where(eq(customersTable.id, existing.id));
    logger.info("Paid test customer plan upgraded to full");
  }
}

async function seedBlogPosts() {
  const [{ cnt }] = await db.select({ cnt: count() })
    .from(blogPostsTable)
    .where(eq(blogPostsTable.slug, "kobi-siber-guvenlik-temel-onlemler"));
  if (Number(cnt) > 0) return;

  const now = new Date();
  const posts = [
    {
      slug: "kobi-siber-guvenlik-temel-onlemler",
      title: "KOBİ'ler İçin 10 Temel Siber Güvenlik Önlemi",
      excerpt: "Küçük ve orta ölçekli işletmelerin siber saldırılara karşı hemen alabileceği, düşük maliyetli ama yüksek etkili 10 güvenlik adımı.",
      content: `<h2>Neden KOBİ'ler Hedef Alınıyor?</h2>
<p>Siber saldırganlar büyük şirketleri değil, daha kolay hedefleri tercih eder. KOBİ'lerin %43'ü her yıl siber saldırıya uğruyor; ancak bunların yalnızca %14'ü savunmaya yeterince hazırlıklı. Sebebi basit: büyük kurumsal güvenlik bütçesi olmaksızın dijital varlıklar korunmaya çalışılıyor.</p>
<p>İyi haber şu ki temel güvenlik önlemlerinin büyük çoğunluğu ücretsiz ya da çok düşük maliyetlidir ve teknik bilgi gerektirmez.</p>
<h2>1. Güçlü ve Benzersiz Parolalar Kullanın</h2>
<p>Her hesap için farklı, en az 12 karakter uzunluğunda bir parola belirleyin. Rakam, büyük-küçük harf ve özel karakter içermeli. Bitwarden veya KeePass gibi ücretsiz bir parola yöneticisi bu işi kolaylaştırır.</p>
<h2>2. İki Faktörlü Kimlik Doğrulama (2FA) Açın</h2>
<p>E-posta, banka ve bulut sistemlerinizde 2FA'yı etkinleştirin. SMS yerine Google Authenticator veya Authy gibi bir uygulama kullanmak çok daha güvenlidir.</p>
<h2>3. Yazılımları Güncel Tutun</h2>
<p>Yamalar çıktıkça güncelleyin. Siber saldırıların %60'ı bilinen güvenlik açıklarını hedef alır ve bu açıkların çoğu aylar önce kapatılmıştır — yalnızca güncelleme yapılmamıştır.</p>
<h2>4. E-posta Filtrelerinizi Yapılandırın</h2>
<p>SPF, DKIM ve DMARC kayıtlarını DNS'inize ekleyin. Bu üç kayıt, alan adınızın sahte e-postalarda kullanılmasını engelleyen en temel korumadır.</p>
<h2>5. Çalışanlarınızı Eğitin</h2>
<p>Phishing saldırıları hâlâ en yaygın giriş noktası. Yılda en az bir kez bilinçlendirme eğitimi yapın; çalışanlarınıza şüpheli e-postaları nasıl tanıyacaklarını öğretin.</p>
<h2>6. Düzenli Yedekleme Yapın</h2>
<p>3-2-1 kuralını uygulayın: 3 kopya, 2 farklı ortam, 1 kopya tesis dışında. Yedekleri en az haftada bir test edin.</p>
<h2>7. Wi-Fi Ağınızı Ayırın</h2>
<p>Misafir, iş ve IoT cihazları için ayrı ağ segmentleri oluşturun. Yazıcı veya kameranız saldırıya uğrasa bile diğer sistemleriniz korunmuş olur.</p>
<h2>8. Antivirüs ve EDR Kullanın</h2>
<p>Ücretsiz antivirüsler temel koruma sağlar; ancak orta ve büyük KOBİ'ler için EDR (Endpoint Detection and Response) çözümleri çok daha etkilidir.</p>
<h2>9. Erişim Yetkilerini Sınırlayın</h2>
<p>Her çalışana yalnızca işini yapabilmesi için gereken en az yetkiyi verin. Ayrılan çalışanların erişimlerini aynı gün kapatın.</p>
<h2>10. Risk Değerlendirmesi Yaptırın</h2>
<p>Yılda en az bir kez profesyonel bir siber güvenlik risk değerlendirmesi yapın. CyberStep.io'nun ücretsiz Mini Değerlendirme aracıyla 10 dakikada mevcut durumunuzu öğrenebilirsiniz.</p>
<h2>Sonuç</h2>
<p>Siber güvenlik bir kerelik yapılıp biten bir proje değil, sürekli bir süreçtir. Yukarıdaki 10 adımı hayata geçirerek saldırganların büyük çoğunluğunu engellemiş olursunuz. Küçük adımlar, büyük fark yaratır.</p>`,
      authorName: "CyberStep.io",
      status: "published",
      publishedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      readingMinutesTr: 5,
      readingMinutesEn: 5,
    },
    {
      slug: "kvkk-uyumlulugu-kobi-rehberi",
      title: "KVKK Uyumluluğu: KOBİ'ler İçin Adım Adım Rehber",
      excerpt: "Kişisel Verilerin Korunması Kanunu kapsamında KOBİ'lerin yerine getirmesi gereken yükümlülükler ve pratik uygulama adımları.",
      content: `<h2>KVKK Nedir ve KOBİ'leri Neden İlgilendiriyor?</h2>
<p>6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK), çalışan, müşteri veya tedarikçi verisi işleyen her kuruluşu kapsar. Şirket büyüklüğünden bağımsız olarak kişisel veri işliyorsanız KVKK'ya tabissiniz. İhlaller için 1 milyon TL'ye kadar idari para cezası söz konusu olabilir.</p>
<h2>Hangi Veriler "Kişisel Veri" Sayılır?</h2>
<p>Ad-soyad, T.C. kimlik numarası, e-posta adresi, telefon numarası, konum verisi, IP adresi ve daha fazlası kişisel veri kapsamındadır. Sağlık, din ve biyometrik veriler ise "özel nitelikli kişisel veri" olarak çok daha sıkı kurallara tabidir.</p>
<h2>KOBİ'ler İçin 5 Temel Adım</h2>
<h3>1. Veri Envanteri Çıkarın</h3>
<p>Hangi verileri topladığınızı, nerede sakladığınızı, kimlerle paylaştığınızı ve ne kadar süre tuttuğunuzu bir tabloda belgeleyin. Bu "Veri İşleme Envanteri" KVKK'nın temel belgesidir.</p>
<h3>2. Aydınlatma Metinlerini Hazırlayın</h3>
<p>Müşterilerinize, çalışanlarınıza ve tedarikçilerinize hangi verileri neden topladığınızı açıklayan aydınlatma metinleri hazırlayın. Bu metinler web sitenizde, sözleşmelerde ve başvuru formlarında yer almalıdır.</p>
<h3>3. Açık Rıza Yönetimi Kurun</h3>
<p>Pazarlama e-postaları veya çerezler gibi rızaya dayalı işlemler için açık onay alın ve bu onayları kayıt altında tutun.</p>
<h3>4. Teknik Önlemler Alın</h3>
<p>Kişisel verileri şifreleyin, erişim yetkilerini kısıtlayın ve düzenli güvenlik testleri yapın. KVKK yalnızca hukuki değil, teknik uyum da ister.</p>
<h3>5. İhlal Bildirimi Prosedürü Oluşturun</h3>
<p>Veri ihlali durumunda 72 saat içinde Kişisel Verileri Koruma Kurumu'na (KVKK) bildirim yapmanız gerekiyor. Bu prosedürü önceden hazırlayın.</p>
<h2>Ceza Riski Gerçek Mi?</h2>
<p>Evet. Kurul, 2023 yılında yüzlerce şirkete toplamda onlarca milyon TL para cezası kesti. KOBİ'ler de bu denetimlerden muaf değil. Ancak uyum belgesi oluşturmuş ve iyi niyet gösteren şirketlere verilen cezaların çok daha düşük olduğu gözlemleniyor.</p>
<h2>Neden Şimdi Başlamalısınız?</h2>
<p>KVKK uyumu bir defada tamamlanan bir proje değildir; devam eden bir süreçtir. Ne kadar erken başlarsanız, olası denetimde o kadar güçlü konumda olursunuz. CyberStep.io'nun risk değerlendirme aracı KVKK'ya dair açık noktalarınızı tespit etmenize yardımcı olur.</p>`,
      authorName: "CyberStep.io",
      status: "published",
      publishedAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
      readingMinutesTr: 6,
      readingMinutesEn: 6,
    },
    {
      slug: "fidye-yazilimi-saldirilarindan-korunma",
      title: "Fidye Yazılımı Saldırıları: İşletmenizi Nasıl Korursunuz?",
      excerpt: "Ransomware saldırıları KOBİ'leri giderek daha fazla hedef alıyor. Saldırı nasıl gerçekleşir, nasıl önlenir ve saldırı sonrası ne yapılır?",
      content: `<h2>Fidye Yazılımı Nedir?</h2>
<p>Fidye yazılımı (ransomware), sisteminize sızan ve dosyalarınızı şifreleyerek erişiminizi engelleyen bir kötü amaçlı yazılım türüdür. Saldırganlar, dosyaları geri vermek için genellikle kripto para cinsinden fidye talep eder. Ödeme yapsanız bile verilerinizi geri almanızın garantisi yoktur.</p>
<h2>KOBİ'ler Neden Özellikle Risk Altında?</h2>
<p>2023 verilerine göre fidye yazılımı saldırılarının %82'si 1.000'den az çalışana sahip şirketleri hedef aldı. Sebep açık: büyük şirketlere kıyasla daha zayıf savunma, ama yeterince değerli veri ve ödeme kapasitesi.</p>
<h2>Saldırı Nasıl Gerçekleşir?</h2>
<p>En yaygın giriş noktaları şunlardır:</p>
<ul>
<li><strong>Phishing e-postaları:</strong> Sahte fatura, kargo bildirimi veya iş teklifi görünümlü e-postalar</li>
<li><strong>Uzak masaüstü (RDP) açıkları:</strong> Zayıf parola veya yama yapılmamış RDP portları</li>
<li><strong>Yazılım açıkları:</strong> Güncellenmemiş işletim sistemi veya uygulamalar</li>
<li><strong>Tedarikçi zinciri saldırıları:</strong> Güvendiğiniz bir tedarikçi üzerinden giriş</li>
</ul>
<h2>Önleme Stratejileri</h2>
<h3>Yedekleme — En Kritik Savunma</h3>
<p>3-2-1 yedekleme kuralını uygulayın: en az 3 kopya, 2 farklı ortam, 1 kopya çevrimdışı veya bulutta izole. Yedekleri haftada bir test edin. Fidye yazılımı bulaştıktan sonra tek kurtuluş yolunuz temiz yedektir.</p>
<h3>E-posta Güvenliği</h3>
<p>SPF, DKIM, DMARC kayıtlarını yapılandırın. E-posta filtreleme çözümü kullanın. Çalışanlarınızı phishing simülasyonlarıyla eğitin.</p>
<h3>Yama Yönetimi</h3>
<p>İşletim sistemleri ve uygulamaları otomatik güncelleyin. RDP portu varsa VPN arkasına alın veya kapatın.</p>
<h3>Ağ Segmentasyonu</h3>
<p>Kritik sistemleri ayrı ağ segmentlerinde tutun. Böylece bir cihaz bulaşsa bile tüm sisteme yayılmasını yavaşlatabilirsiniz.</p>
<h2>Saldırı Gerçekleşirse Ne Yapmalısınız?</h2>
<ol>
<li><strong>Sistemi izole edin:</strong> Etkilenen cihazları ağdan hemen kesin</li>
<li><strong>Fidye ödemeyin:</strong> Ödeme, dosyaların geri geleceğini garantilemez ve sizi tekrar hedef yapar</li>
<li><strong>Yetkililere bildirin:</strong> BTK ve KVKK'ya bildirim zorunluluğunuz olabilir</li>
<li><strong>Yedekten geri yükleyin:</strong> Temiz yedekten sistemleri sıfırdan kurun</li>
<li><strong>Forensic analiz yaptırın:</strong> Giriş noktasını tespit etmeden sistemi açmayın</li>
</ol>
<h2>Sonuç</h2>
<p>Fidye yazılımına karşı %100 güvenli bir sistem yoktur. Ancak doğru önlemlerle saldırıyı çok daha zorlaştırabilir ve saldırı gerçekleşse bile zararı minimize edebilirsiniz. Güçlü yedekleme + e-posta güvenliği + çalışan eğitimi üçlüsü, en etkili savunma hattını oluşturur.</p>`,
      authorName: "CyberStep.io",
      status: "published",
      publishedAt: new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000),
      readingMinutesTr: 7,
      readingMinutesEn: 7,
    },
    {
      slug: "e-posta-guvenligi-spf-dmarc-dkim",
      title: "E-posta Güvenliği: SPF, DKIM ve DMARC Nedir, Nasıl Kurulur?",
      excerpt: "İşletme e-postanızın sahte gönderilere karşı korunması için kritik üç DNS kaydı — SPF, DKIM ve DMARC — adım adım açıklaması.",
      content: `<h2>E-posta Sahteciliği (Spoofing) Nedir?</h2>
<p>E-posta sahteciliği, bir saldırganın sizin alan adınızı (@sirketiniz.com) kullanarak sanki sizden gönderiliyormuş gibi e-posta göndermesidir. Bu teknik; müşterilerinizi kandırmak, tedarikçilerle sahte fatura iletişimi kurmak veya çalışanlarınızı hedef almak için kullanılır. İyi haber: SPF, DKIM ve DMARC kayıtlarıyla bu saldırıların büyük çoğunluğunu önleyebilirsiniz.</p>
<h2>SPF (Sender Policy Framework)</h2>
<p>SPF, alan adınız adına e-posta göndermeye yetkili IP adreslerini listeleyen bir DNS kaydıdır. Alıcı sunucu, e-posta geldiğinde "Bu IP adresine bu alan adı adına e-posta gönderme izni var mı?" diye kontrol eder.</p>
<p><strong>Örnek SPF kaydı:</strong></p>
<pre><code>v=spf1 include:_spf.google.com include:mail.sirketiniz.com ~all</code></pre>
<p>TXT kaydı olarak DNS'inize ekleyin. <code>~all</code> "yumuşak ret" (soft fail), <code>-all</code> ise "sert ret" (hard fail) anlamına gelir. Başlangıç için <code>~all</code> önerilir.</p>
<h2>DKIM (DomainKeys Identified Mail)</h2>
<p>DKIM, e-postanın gönderilirken kriptografik olarak imzalanmasını sağlar. Alıcı sunucu bu imzayı doğrulayarak e-postanın yolda değiştirilmediğini ve gerçekten sizin sunucunuzdan geldiğini teyit eder.</p>
<p>E-posta servis sağlayıcınız (Google Workspace, Microsoft 365, vb.) DKIM anahtarlarını sizin için oluşturur. Sağlayıcınızın yönetim panelinden "DKIM" ayarlarına girerek oluşturulan TXT kaydını DNS'inize ekleyin.</p>
<h2>DMARC (Domain-based Message Authentication)</h2>
<p>DMARC, SPF ve DKIM'den birinin başarısız olması durumunda ne yapılacağını tanımlar. Ayrıca size raporlama imkânı sunar.</p>
<p><strong>Örnek DMARC kaydı:</strong></p>
<pre><code>v=DMARC1; p=quarantine; rua=mailto:dmarc-raporlar@sirketiniz.com; pct=100</code></pre>
<p><code>_dmarc.sirketiniz.com</code> adıyla TXT kaydı olarak ekleyin.</p>
<ul>
<li><code>p=none</code> — sadece raporla, aksiyon alma (başlangıç için ideal)</li>
<li><code>p=quarantine</code> — başarısız e-postaları spam klasörüne gönder</li>
<li><code>p=reject</code> — başarısız e-postaları tamamen reddet (hedef politika)</li>
</ul>
<h2>Doğrulama Adımları</h2>
<ol>
<li>MXToolbox.com adresinden alan adınızın SPF, DKIM ve DMARC kayıtlarını kontrol edin</li>
<li>CyberStep.io'nun Alan Tarama aracıyla e-posta güvenlik skorunuzu görün</li>
<li>DMARC raporlarını birkaç hafta izleyin, ardından politikayı <code>reject</code>'e yükseltin</li>
</ol>
<h2>Ne Kadar Sürer?</h2>
<p>Teknik bilgiye sahip biri için SPF ve DMARC kurulumu 15-30 dakika alır. DKIM, e-posta sağlayıcınıza göre değişir ancak genellikle bir saatten fazla sürmez. Yayılma (propagation) için 24-48 saat beklenebilir.</p>
<h2>Sonuç</h2>
<p>Bu üç kayıt, e-posta güvenliğinin temel katmanını oluşturur ve tamamen ücretsizdir. Kurulu olmayan her alan adı, saldırganların kolayca kullanabileceği açık bir kapı bırakmaktadır. Alan adınızın durumunu hemen kontrol edin.</p>`,
      authorName: "CyberStep.io",
      status: "published",
      publishedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      readingMinutesTr: 6,
      readingMinutesEn: 6,
    },
  ];

  for (const p of posts) {
    await db.insert(blogPostsTable).values({
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      content: p.content,
      authorName: p.authorName,
      status: p.status,
      publishedAt: p.publishedAt,
    });
  }
  logger.info({ count: posts.length }, "Blog seed: inserted starter posts");
}

async function ensurePartnerEcosystemTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS partners (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER,
      company_name TEXT NOT NULL,
      contact_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      website TEXT,
      categories TEXT[] DEFAULT '{}',
      tier TEXT NOT NULL DEFAULT 'silver',
      status TEXT NOT NULL DEFAULT 'pending',
      monthly_fee INTEGER DEFAULT 0,
      subscription_status TEXT DEFAULT 'trial',
      password_hash TEXT,
      description TEXT,
      total_projects_completed INTEGER DEFAULT 0,
      total_revenue INTEGER DEFAULT 0,
      rating INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      approved_at TIMESTAMP
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS work_packages (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER,
      assessment_id INTEGER,
      domain_scan_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium',
      estimated_cost INTEGER,
      commission_rate INTEGER DEFAULT 15,
      status TEXT NOT NULL DEFAULT 'open',
      partner_id INTEGER,
      assigned_at TIMESTAMP,
      completed_at TIMESTAMP,
      verified_at TIMESTAMP,
      completion_note TEXT,
      score_before INTEGER,
      score_after INTEGER,
      company_name TEXT,
      domain TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
}

async function ensurePasswordResetColumns() {
  await db.execute(sql`ALTER TABLE IF EXISTS customers ADD COLUMN IF NOT EXISTS password_reset_token TEXT`);
  await db.execute(sql`ALTER TABLE IF EXISTS customers ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMP`);
}

async function ensureReferralCodeColumn() {
  await db.execute(sql`ALTER TABLE IF EXISTS assessments ADD COLUMN IF NOT EXISTS referral_code TEXT`);
}

async function ensureBreachMonitorTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS breach_monitor_requests (
      id          SERIAL PRIMARY KEY,
      domain      TEXT NOT NULL,
      ip_hash     TEXT NOT NULL,
      breach_count INTEGER NOT NULL DEFAULT 0,
      queried_at  TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS breach_monitor_domain_idx ON breach_monitor_requests (domain)`);
}

async function ensureVerificationColumns() {
  await db.execute(sql`ALTER TABLE IF EXISTS reports ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP`);
  await db.execute(sql`ALTER TABLE IF EXISTS reports ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMP`);
  await db.execute(sql`ALTER TABLE IF EXISTS reports ADD COLUMN IF NOT EXISTS verification_duration_years INTEGER`);
}

async function ensureDomainScanLimitColumn() {
  await db.execute(sql`ALTER TABLE IF EXISTS customers ADD COLUMN IF NOT EXISTS domain_scan_limit INTEGER`);
}

async function ensureBadgeAdvantagesTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS badge_advantages (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      partner_name TEXT NOT NULL,
      description TEXT NOT NULL,
      discount_percent INTEGER,
      badge_text TEXT,
      logo_url TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
}

async function startup() {
  await maybeResetAdminPassword();
  await ensureAssessmentsColumns();
  await ensureQuestionsTable();
  await ensureTenantsTable();
  await ensureIsrTables();
  await ensureEmailTables();
  await maybeSeedPricingPlans();
  await maybeSeedQuestions();
  await maybeSeedDemoCustomer();
  await maybeSeedPaidTestCustomer();
  await ensureBlogContentColumns();
  await ensureDomainScanEnrichmentColumns();
  await ensureReportEnrichmentColumns();
  await ensureSecurityAdvisoriesTable();
  await updatePricingPlanFeatures();
  await ensurePartnerEcosystemTables();
  await seedBlogPosts();
  await ensureVerificationColumns();
  await ensureBadgeAdvantagesTable();
  await ensureDomainScanLimitColumn();
  await ensurePasswordResetColumns();
  await ensureBreachMonitorTable();
  await ensureReferralCodeColumn();
  await ensureDomainScanPurchasesTable();
  await ensureDnsTables();
  await ensureCtTable();
  await ensureMs365Tables();
  await ensureCustomerServiceConfigsTable();
  await ensureKvkkTables();
  await ensureServiceNowTables();
  await ensureWebhookTables();
  await ensureTelegramTables();
  await ensureNetgsmTables();
  await ensureOnboardingEmailColumns();
  await loadApiKeysFromDb();
}

async function ensureDnsTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS dns_watched_domains (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      domain TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      last_checked_at TIMESTAMP,
      UNIQUE(customer_id, domain)
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS dns_snapshots (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL,
      domain TEXT NOT NULL,
      a_records JSONB NOT NULL DEFAULT '[]',
      mx_records JSONB NOT NULL DEFAULT '[]',
      ns_records JSONB NOT NULL DEFAULT '[]',
      txt_records JSONB NOT NULL DEFAULT '[]',
      cname_records JSONB NOT NULL DEFAULT '[]',
      checked_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS dns_snapshots_customer_domain_idx
    ON dns_snapshots(customer_id, domain, checked_at DESC)
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS dns_change_events (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL,
      domain TEXT NOT NULL,
      record_type TEXT NOT NULL,
      old_values JSONB,
      new_values JSONB,
      severity TEXT NOT NULL DEFAULT 'medium',
      soc_case_id INTEGER,
      detected_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS dns_change_events_customer_idx
    ON dns_change_events(customer_id, detected_at DESC)
  `);
}

async function ensureOnboardingEmailColumns() {
  await db.execute(sql`ALTER TABLE IF EXISTS customers ADD COLUMN IF NOT EXISTS onboarding_d3_sent_at TIMESTAMP`);
  await db.execute(sql`ALTER TABLE IF EXISTS customers ADD COLUMN IF NOT EXISTS onboarding_d7_sent_at TIMESTAMP`);
}

async function ensureDomainScanPurchasesTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS domain_scan_purchases (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      domain TEXT,
      scan_id INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      amount_try INTEGER NOT NULL DEFAULT 99000,
      payment_ref TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      paid_at TIMESTAMP
    )
  `);
}

// ─── Cron: 6-aylık fiyat güncelleme hatırlatıcısı (her Pazartesi 09:00'da) ────
function startInflationReminderCron() {
  cron.schedule("0 9 * * 1", async () => {
    try {
      const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;
      const plans = await db.select().from(pricingPlansTable).orderBy(pricingPlansTable.updatedAt);
      if (plans.length === 0) return;

      const oldestDate = new Date(plans[0].updatedAt);
      const ageMs = Date.now() - oldestDate.getTime();
      if (ageMs < SIX_MONTHS_MS) return;

      const monthsOld = Math.floor(ageMs / (30 * 24 * 60 * 60 * 1000));
      const adminEmail = process.env.SMTP_USER ?? process.env.ADMIN_EMAIL;
      if (!adminEmail) {
        logger.warn("Inflation reminder: no admin email configured (SMTP_USER missing)");
        return;
      }

      const planLines = plans
        .filter(p => Number(p.price) > 0)
        .map(p => `<tr><td style="padding:4px 12px">${p.name}</td><td style="padding:4px 12px">${Number(p.price).toLocaleString("tr-TR")} TL</td><td style="padding:4px 12px">${Math.round(Number(p.price) * 1.25).toLocaleString("tr-TR")} TL</td></tr>`)
        .join("");

      await sendMail({
        to: adminEmail,
        subject: `CyberStep — Fiyat Güncelleme Hatırlatıcısı (${monthsOld} ay geçti)`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:#f59e0b">Fiyat Güncelleme Zamanı</h2>
            <p>Fiyatlarınız en son <strong>${oldestDate.toLocaleDateString("tr-TR", { day:"numeric", month:"long", year:"numeric" })}</strong> tarihinde güncellendi (<strong>${monthsOld} ay önce</strong>).</p>
            <p>TÜFE verilerine göre önerilen <strong>%25 artış</strong> uygulandığında:</p>
            <table border="1" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;border-color:#374151">
              <thead><tr style="background:#1f2937;color:#9ca3af">
                <th style="padding:6px 12px;text-align:left">Plan</th>
                <th style="padding:6px 12px;text-align:left">Mevcut</th>
                <th style="padding:6px 12px;text-align:left">Önerilen</th>
              </tr></thead>
              <tbody style="color:#111827">${planLines}</tbody>
            </table>
            <p style="margin-top:20px">
              <a href="${process.env.ADMIN_URL ?? "https://cyberstep.io"}/admin/fiyatlandirma"
                 style="background:#10b981;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">
                Fiyatları Güncelle
              </a>
            </p>
            <p style="color:#6b7280;font-size:12px;margin-top:24px">Bu hatırlatıcı her Pazartesi sabahı kontrol edilir ve güncelleme gerektiren planlar varsa gönderilir.</p>
          </div>`,
      });
      logger.info({ monthsOld, adminEmail }, "Inflation reminder email sent");
    } catch (err) {
      logger.warn({ err }, "Inflation reminder cron failed");
    }
  });
  logger.info("Inflation reminder cron scheduled (every Monday 09:00)");
}

// ─── Digest Cron ─────────────────────────────────────────────────────────────
// Haber topla: her gün 06:00; Digest oluştur: her Cuma 07:00 İstanbul
function startDigestCron() {
  cron.schedule("0 3 * * *", async () => {
    logger.info("Digest: RSS haber toplama başlıyor");
    try {
      await collectRSSFeeds();
    } catch (err) {
      logger.error({ err }, "Digest: RSS haber toplama başarısız");
    }
  }, { timezone: "Europe/Istanbul" });

  cron.schedule("0 4 * * 5", async () => {
    logger.info("Digest: Haftalık digest oluşturma başlıyor");
    try {
      const id = await generateWeeklyDigest();
      logger.info({ id }, "Digest: Haftalık digest oluşturuldu");
    } catch (err) {
      logger.error({ err }, "Digest: Haftalık digest oluşturma başarısız");
    }
  }, { timezone: "Europe/Istanbul" });

  logger.info("Digest cron scheduled (daily 06:00 collect, Friday 07:00 generate Istanbul)");
}

// ─── Blog Autopilot Cron ──────────────────────────────────────────────────────
// Pazartesi + Perşembe 09:00 İstanbul (UTC+3 = 06:00 UTC)
function startBlogAutopilotCron() {
  const runJob = async () => {
    try {
      logger.info("Blog autopilot: yazı üretimi başlıyor");
      await generateAndPublishBlogPost();
    } catch (err) {
      logger.error({ err }, "Blog autopilot: yazı üretimi başarısız");
    }
  };
  cron.schedule("0 6 * * 1", runJob); // Her Pazartesi 09:00 İstanbul
  cron.schedule("0 6 * * 4", runJob); // Her Perşembe 09:00 İstanbul
  logger.info("Blog autopilot cron scheduled (Mon & Thu 09:00 Istanbul)");
}

// ─── Cron: AI Araç Politika İzleme (her Pazar 02:00 İstanbul) ─────────────────
function startAiToolMonitorCron() {
  cron.schedule("0 2 * * 0", async () => {
    try {
      logger.info("AI araç politika kontrolü başlıyor");
      const { checkAllToolsForChanges } = await import("./services/ai-tool-monitor");
      await checkAllToolsForChanges();
    } catch (err) {
      logger.error({ err }, "AI araç politika kontrol cron hatası");
    }
  }, { timezone: "Europe/Istanbul" });
  logger.info("AI araç politika izleme cron zamanlandı (Pazar 02:00 İstanbul)");
}

// ─── Cron: AI Politika Çeyreklik Güncelleme (1 Oca/Nis/Tem/Eki 03:00) ─────────
function startQuarterlyPolicyUpdateCron() {
  cron.schedule("0 3 1 1,4,7,10 *", async () => {
    try {
      logger.info("AI politika çeyreklik güncelleme başlıyor");
      const { runQuarterlyPolicyUpdate } = await import("./services/policy-generator");
      await runQuarterlyPolicyUpdate();
    } catch (err) {
      logger.error({ err }, "AI politika çeyreklik güncelleme cron hatası");
    }
  }, { timezone: "Europe/Istanbul" });
  logger.info("AI politika çeyreklik güncelleme cron zamanlandı (1 Oca/Nis/Tem/Eki 03:00 İstanbul)");
}

// ─── Growth Engine Crons ──────────────────────────────────────────────────────
function startGrowthEngineCrons() {
  // SSL bitiş taraması — her gece 01:00 İstanbul (22:00 UTC)
  cron.schedule("0 22 * * *", async () => {
    try {
      const { runSSLExpiryCron } = await import("./services/growth-engine");
      await runSSLExpiryCron();
    } catch (err) {
      logger.warn({ err }, "SSL expiry growth cron failed");
    }
  });
  // CVE uyarısı — her gece 02:30 İstanbul (23:30 UTC)
  cron.schedule("30 23 * * *", async () => {
    try {
      const { runCVEAlertCron } = await import("./services/growth-engine");
      await runCVEAlertCron();
    } catch (err) {
      logger.warn({ err }, "CVE alert growth cron failed");
    }
  });
  // Port değişikliği — her Pazar 04:00 İstanbul (01:00 UTC)
  cron.schedule("0 1 * * 0", async () => {
    try {
      const { runPortChangeCron } = await import("./services/growth-engine");
      await runPortChangeCron();
    } catch (err) {
      logger.warn({ err }, "Port change growth cron failed");
    }
  });
  logger.info("Growth engine crons scheduled (SSL 01:00, CVE 02:30, Port Sun 04:00 Istanbul)");
}

startup()
  .then(() => {
    startReminderCron();
    startScanLeadDripCron();
    startIsrImapCron();
    startInflationReminderCron();
    startBlogAutopilotCron();
    startDigestCron();
    startAiToolMonitorCron();
    startQuarterlyPolicyUpdateCron();
    startGrowthEngineCrons();
    seedDefaultSources().catch((err) => logger.warn({ err }, "Digest: default sources seed failed"));
    // USOM zararlı alan listesini arka planda yükle ve günlük yenile
    refreshUsomList().catch((err) => logger.warn({ err }, "USOM initial fetch failed"));
    cron.schedule("0 3 * * *", () => {
      refreshUsomList().catch((err) => logger.warn({ err }, "USOM daily refresh failed"));
    });
    // Müşteri sağlık skoru — her gece 02:00'de hesapla
    cron.schedule("0 2 * * *", () => {
      calculateAllHealthScores().catch((err) => logger.warn({ err }, "Health score cron failed"));
    }, { timezone: "Europe/Istanbul" });
    logger.info("Health score cron scheduled (02:00 Istanbul)");
    // Tahsilat hatırlatıcı — her gün 10:00'da vadesi geçen faturaları kontrol et
    cron.schedule("0 10 * * *", () => {
      runCollectionReminderCron(sendMail).catch((err) => logger.warn({ err }, "Collection reminder cron failed"));
    }, { timezone: "Europe/Istanbul" });
    logger.info("Collection reminder cron scheduled (10:00 Istanbul)");
    // Otomatik CRM etiketleme — her gece 03:30'da
    cron.schedule("30 3 * * *", () => {
      runAutoTagCron().catch((err) => logger.warn({ err }, "Auto-tag cron failed"));
    }, { timezone: "Europe/Istanbul" });
    logger.info("Auto-tag cron scheduled (03:30 Istanbul)");
    // Görev hatırlatıcı — her gün 08:30'da
    cron.schedule("30 8 * * *", () => {
      runTaskReminderCron().catch((err) => logger.warn({ err }, "Task reminder cron failed"));
    }, { timezone: "Europe/Istanbul" });
    logger.info("Task reminder cron scheduled (08:30 Istanbul)");
    // NPS otomatik gönderim — her Salı 11:00'da
    cron.schedule("0 11 * * 2", () => {
      runNpsCron().catch((err) => logger.warn({ err }, "NPS cron failed"));
    }, { timezone: "Europe/Istanbul" });
    logger.info("NPS cron scheduled (Tuesday 11:00 Istanbul)");
    startFabricCrons();
    startSOCCrons();
    startDnsCrons();
    startCertstreamClient();

    // ─── Microsoft 365 Graph API poller — her 15 dakikada ────────────────────
    cron.schedule("*/15 * * * *", async () => {
      try {
        const { pollAllMs365Integrations } = await import("./services/ms365Graph");
        await pollAllMs365Integrations();
      } catch (err) {
        logger.error({ err }, "MS365 poll cron failed");
      }
    }, { timezone: "Europe/Istanbul" });
    logger.info("MS365 Graph API poller scheduled (every 15 min)");

    // ─── Onboarding email serisi — Her gün 10:30 (D+3 ve D+7) ───────────────
    cron.schedule("30 10 * * *", async () => {
      logger.info("Running onboarding email cron (D+3, D+7)");
      try {
        const { sendOnboardingD3Email, sendOnboardingD7Email } = await import("./services/email");
        const base = process.env["REPLIT_DOMAINS"]
          ? `https://${process.env["REPLIT_DOMAINS"].split(",")[0]?.trim()}`
          : "http://localhost:80";

        // D+3: kayıt 3-4 gün önce, d3 emaili henüz gönderilmemiş
        const d3Due = await db.execute<{ id: number; email: string; full_name: string; company_name: string | null }>(sql`
          SELECT id, email, full_name, company_name
          FROM customers
          WHERE created_at >= NOW() - INTERVAL '4 days'
            AND created_at < NOW() - INTERVAL '3 days'
            AND onboarding_d3_sent_at IS NULL
          LIMIT 50
        `);
        for (const c of (d3Due as unknown as { rows: { id: number; email: string; full_name: string; company_name: string | null }[] }).rows) {
          await sendOnboardingD3Email({
            email: c.email, fullName: c.full_name,
            companyName: c.company_name ?? undefined,
            assessmentUrl: `${base}/assessment/start`,
          }).catch(err => logger.warn({ err, email: c.email }, "Onboarding D+3 email failed"));
          await db.execute(sql`UPDATE customers SET onboarding_d3_sent_at = NOW() WHERE id = ${c.id}`);
          logger.info({ customerId: c.id }, "Onboarding D+3 email sent");
        }

        // D+7: kayıt 7-8 gün önce, d7 emaili henüz gönderilmemiş
        const d7Due = await db.execute<{ id: number; email: string; full_name: string; company_name: string | null }>(sql`
          SELECT id, email, full_name, company_name
          FROM customers
          WHERE created_at >= NOW() - INTERVAL '8 days'
            AND created_at < NOW() - INTERVAL '7 days'
            AND onboarding_d7_sent_at IS NULL
          LIMIT 50
        `);
        for (const c of (d7Due as unknown as { rows: { id: number; email: string; full_name: string; company_name: string | null }[] }).rows) {
          await sendOnboardingD7Email({
            email: c.email, fullName: c.full_name,
            companyName: c.company_name ?? undefined,
            fullAssessmentUrl: `${base}/assessment/full/start`,
            assessmentUrl: `${base}/assessment/start`,
          }).catch(err => logger.warn({ err, email: c.email }, "Onboarding D+7 email failed"));
          await db.execute(sql`UPDATE customers SET onboarding_d7_sent_at = NOW() WHERE id = ${c.id}`);
          logger.info({ customerId: c.id }, "Onboarding D+7 email sent");
        }
      } catch (err) {
        logger.error({ err }, "Onboarding email cron failed");
      }
    }, { timezone: "Europe/Istanbul" });
    logger.info("Onboarding email cron scheduled (10:30 Istanbul, D+3 & D+7)");

    // ─── CASM: Attack Path analizi — Her gece 02:00 ─────────────────────────
    cron.schedule("0 2 * * *", async () => {
      try {
        const { analyzeAttackPaths, getLatestScan, getActiveCustomers } = await import("./services/attackPathAnalyzer");
        const customers = await getActiveCustomers();
        for (const c of customers) {
          const scan = await getLatestScan(c.id);
          if (scan) {
            await analyzeAttackPaths(c.id, scan.id);
            await new Promise(r => setTimeout(r, 3000));
          }
        }
      } catch (err) {
        logger.error({ err }, "Attack path cron failed");
      }
    }, { timezone: "Europe/Istanbul" });
    logger.info("Attack path analysis cron scheduled (02:00 Istanbul)");

    // ─── CASM: Remediation doğrulama kuyruğu — Her saat ─────────────────────
    cron.schedule("0 * * * *", async () => {
      try {
        const { processVerificationQueue } = await import("./services/verificationScanner");
        await processVerificationQueue();
      } catch (err) {
        logger.error({ err }, "Verification queue cron failed");
      }
    }, { timezone: "Europe/Istanbul" });
    logger.info("Verification queue cron scheduled (hourly)");

    // ─── CASM: SLA ihlal kontrolü — Her gün 08:00 ────────────────────────────
    cron.schedule("0 8 * * *", async () => {
      try {
        const { checkRemediationSLABreaches } = await import("./services/verificationScanner");
        await checkRemediationSLABreaches();
      } catch (err) {
        logger.error({ err }, "SLA breach check cron failed");
      }
    }, { timezone: "Europe/Istanbul" });
    logger.info("SLA breach cron scheduled (08:00 Istanbul)");

    // ─── CASM: Cloud CSPM taraması — Her gece 03:00 ──────────────────────────
    cron.schedule("0 3 * * *", async () => {
      try {
        const { db: dbI } = await import("@workspace/db");
        const { cloudConnectionsTable } = await import("@workspace/db");
        const { eq } = await import("drizzle-orm");
        const { runCloudScan } = await import("./routes/cloud-cspm/index");
        const conns = await dbI.select().from(cloudConnectionsTable).where(eq(cloudConnectionsTable.isActive, true));
        for (const conn of conns) {
          await runCloudScan(conn, conn.customerId!);
          await new Promise(r => setTimeout(r, 5000));
        }
      } catch (err) {
        logger.error({ err }, "Cloud CSPM cron failed");
      }
    }, { timezone: "Europe/Istanbul" });
    logger.info("Cloud CSPM cron scheduled (03:00 Istanbul)");

    // ─── CASM: GitHub secrets tarama — Her Pazar 04:00 ───────────────────────
    cron.schedule("0 4 * * 0", async () => {
      try {
        const { getCustomersWithGitHub, scanGitHubOrg } = await import("./services/githubScanner");
        const { db: dbI } = await import("@workspace/db");
        const { codeSecretsFindingsTable } = await import("@workspace/db");
        const customers = await getCustomersWithGitHub();
        for (const c of customers) {
          if (!c.githubOrg) continue;
          const findings = await scanGitHubOrg(c.githubOrg, c.id);
          for (const f of findings) {
            await dbI.insert(codeSecretsFindingsTable).values(f).onConflictDoNothing();
          }
          await new Promise(r => setTimeout(r, 10000));
        }
      } catch (err) {
        logger.error({ err }, "GitHub secrets cron failed");
      }
    }, { timezone: "Europe/Istanbul" });
    logger.info("GitHub secrets scan cron scheduled (Sunday 04:00 Istanbul)");

    cron.schedule("*/30 * * * *", async () => {
      try { await checkKvkkDeadlines(); } catch (err) { logger.error({ err }, "KVKK deadline cron failed"); }
    });
    logger.info("KVKK 72h deadline cron scheduled (every 30 min)");

    cron.schedule("*/15 * * * *", async () => {
      try { await syncServiceNowIncidents(); } catch (err) { logger.error({ err }, "ServiceNow sync cron failed"); }
    });
    logger.info("ServiceNow incident sync cron scheduled (every 15 min)");

    // ─── ServiceNow bağlantı sağlık kontrolü — Her saat ──────────────────────
    cron.schedule("0 * * * *", async () => {
      logger.info("Running ServiceNow connection health check cron");
      try { await checkServiceNowConnections(); } catch (err) { logger.error({ err }, "ServiceNow connection health check cron failed"); }
    });
    logger.info("ServiceNow connection health check cron scheduled (every hour)");

    cron.schedule("*/10 * * * *", async () => {
      try { await retryFailedWebhooks(); } catch (err) { logger.error({ err }, "Webhook retry cron failed"); }
    });
    logger.info("Webhook retry cron scheduled (every 10 min)");

    startRenewalCron();

    // ─── E-posta dizi kuyruğu — her 30 dakika ─────────────────────────────────
    cron.schedule("*/30 * * * *", async () => {
      try { await processEmailQueue(); } catch (err) { logger.warn({ err }, "Email sequence cron failed"); }
    });
    logger.info("Email sequence cron scheduled (every 30 min)");

    // ─── NOC: FortiGate polling — her 5 dakika ────────────────────────────────
    cron.schedule("*/5 * * * *", async () => {
      try { await runFortiGatePollCron(); } catch (err) { logger.warn({ err }, "NOC FortiGate poll cron failed"); }
    });
    logger.info("NOC FortiGate poll cron scheduled (every 5 min)");

    // ─── NOC: Availability monitor — her 5 dakika ─────────────────────────────
    cron.schedule("*/5 * * * *", async () => {
      try { await runAvailabilityCron(); } catch (err) { logger.warn({ err }, "NOC availability cron failed"); }
    });
    logger.info("NOC availability cron scheduled (every 5 min)");

    // ─── NOC: Claude triage — her 15 dakika ───────────────────────────────────
    cron.schedule("*/15 * * * *", async () => {
      try { await runNOCTriageCron(); } catch (err) { logger.warn({ err }, "NOC triage cron failed"); }
    });
    logger.info("NOC triage cron scheduled (every 15 min)");

    // ─── NOC: Baseline tamamlama — her saat ──────────────────────────────────
    cron.schedule("0 * * * *", async () => {
      try { await checkAndCompleteBaselines(); } catch (err) { logger.warn({ err }, "NOC baseline cron failed"); }
    });
    logger.info("NOC baseline check cron scheduled (every hour)");

    // ─── Lead Discovery: crt.sh — Her Pazartesi 03:00 ────────────────────────
    cron.schedule("0 3 * * 1", async () => {
      if (!await cronIsEnabled("crtsh")) { logger.info("crt.sh cron devre dışı, atlanıyor"); return; }
      const done = cronStart("crtsh");
      try {
        const limit = await cronGetLimit("crtsh", 300);
        await scanCRTSH("%.com.tr", { daysBack: 7, minCorporateScore: 70, limit });
        await new Promise((r) => setTimeout(r, 5000));
        await scanCRTSH("%.net.tr", { daysBack: 7, minCorporateScore: 70, limit: Math.floor(limit / 3) });
        done(true);
      } catch (err) { done(false, err instanceof Error ? err.message : String(err)); logger.warn({ err }, "crt.sh discovery cron failed"); }
    });
    logger.info("crt.sh discovery cron scheduled (Monday 03:00)");

    // ─── Lead Discovery: Shodan — Her Salı 03:00 ─────────────────────────────
    cron.schedule("0 3 * * 2", async () => {
      if (!process.env["SHODAN_API_KEY"]) return;
      if (!await cronIsEnabled("shodan")) { logger.info("Shodan cron devre dışı, atlanıyor"); return; }
      const done = cronStart("shodan");
      try {
        const limit = await cronGetLimit("shodan", 100);
        const queryIdx = getISOWeek(new Date()) % SHODAN_FREE_QUERIES.length;
        await scanShodanFree(queryIdx, limit);
        done(true);
      } catch (err) { done(false, err instanceof Error ? err.message : String(err)); logger.warn({ err }, "Shodan discovery cron failed"); }
    });
    logger.info("Shodan discovery cron scheduled (Tuesday 03:00)");

    // ─── Lead Discovery: Kalifikasyon — Her gece 04:00 ───────────────────────
    cron.schedule("0 4 * * *", async () => {
      if (!await cronIsEnabled("lead_qual")) { logger.info("Lead kalifikasyon cron devre dışı, atlanıyor"); return; }
      const done = cronStart("lead_qual");
      try {
        const limit = await cronGetLimit("lead_qual", 20);
        await qualifyPendingCandidates(limit);
        done(true);
      } catch (err) { done(false, err instanceof Error ? err.message : String(err)); logger.warn({ err }, "Lead qualification cron failed"); }
    });
    logger.info("Lead qualification cron scheduled (daily 04:00)");

    // ─── Certstream queue işleyici — her saat ─────────────────────────────────
    cron.schedule("0 * * * *", async () => {
      if (!await cronIsEnabled("certstream_proc")) { logger.info("Certstream cron devre dışı, atlanıyor"); return; }
      const done = cronStart("certstream_proc");
      try {
        const limit = await cronGetLimit("certstream_proc", 100);
        const result = await processCertstreamQueue(limit);
        if (result.added > 0) logger.info(result, "Certstream queue: yeni leadler eklendi");
        done(true);
      } catch (err) { done(false, err instanceof Error ? err.message : String(err)); logger.warn({ err }, "Certstream queue cron failed"); }
    });
    logger.info("Certstream queue processor cron scheduled (hourly)");

    // ─── Abonelik bitiş hatırlatmaları — her gün 10:00 İstanbul ──────────────
    cron.schedule("0 10 * * *", async () => {
      try {
        await checkSubscriptionExpiryReminders();
      } catch (err) { logger.warn({ err }, "Subscription expiry reminder cron failed"); }
    }, { timezone: "Europe/Istanbul" });
    logger.info("Subscription expiry reminder cron scheduled (daily 10:00 Istanbul)");

    const server = app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");
    });
    initSOCWebSocket(server);
  })
  .catch((err: unknown) => {
    logger.error({ err }, "Startup error");
    process.exit(1);
  });
