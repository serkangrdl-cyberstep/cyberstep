import { Router } from "express";
import type { Request } from "express";
import { db } from "@workspace/db";
import {
  assessmentsTable,
  assessmentAnswersTable,
  reportsTable,
  tenantsTable,
  domainScansTable,
  badgeAdvantagesTable,
} from "@workspace/db";
import {
  checkSPF, checkDMARC, checkDKIM, checkMX, checkSSL,
  calcScore, sanitizeDomain, checkHIBP, checkBlacklists, checkShadowIT,
  checkHTTPHeaders, checkURLhaus, checkUsomList, checkCertTransparency,
} from "../domain-scan/index";
import {
  CreateAssessmentBody,
  SubmitAnswersBody,
  GetAssessmentParams,
  SubmitAnswersParams,
  CompleteAssessmentParams,
  GetReportParams,
} from "@workspace/api-zod";
import { eq, desc, sql, count, avg, gte, lte, and, asc } from "drizzle-orm";
import { getTenantAiFn, getClaudeAiFn } from "../../services/ai-client";
import { calculateScore, MINI_QUESTIONS, FULL_QUESTIONS } from "./scoring";
import { logger } from "../../lib/logger";
import { sendAdminNotificationEmail, sendCustomerConfirmationEmail } from "../../services/email";
import { generateReportPDF } from "../../services/pdf";
import { requireAdmin, requireAssessmentOwner, addAssessmentToSession } from "../../middleware/auth";
import { parseAiJson, extractReportFields, recoverReportFields, AI_ANALYSIS_FALLBACK } from "../../lib/report-json";

function getSessionTenantId(req: Request): number | undefined {
  return (req.session as unknown as Record<string, unknown>)["tenantId"] as number | undefined;
}

const router = Router();

// POST /api/assessments
router.post("/assessments", async (req, res) => {
  const parsed = CreateAssessmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Geçersiz istek verisi" });
    return;
  }

  const tenantId = getSessionTenantId(req);

  // Plan limit enforcement for tenant-scoped requests
  if (tenantId) {
    const [tenant] = await db
      .select({ maxAssessments: tenantsTable.maxAssessments })
      .from(tenantsTable)
      .where(eq(tenantsTable.id, tenantId));

    if (tenant?.maxAssessments != null) {
      const [countResult] = await db
        .select({ count: count() })
        .from(assessmentsTable)
        .where(eq(assessmentsTable.tenantId, tenantId));
      if (Number(countResult?.count ?? 0) >= tenant.maxAssessments) {
        res.status(403).json({ error: "Plan limitine ulaşıldı. Lütfen planınızı yükseltin.", code: "PLAN_LIMIT" });
        return;
      }
    }
  }

  const data = parsed.data;
  // Referral code: ?ref= query param veya body'den gelir
  const rawRef = req.query["ref"] ?? (req.body as Record<string, unknown>)?.referralCode;
  const referralCode = typeof rawRef === "string" && rawRef.trim() ? rawRef.trim().slice(0, 64) : null;

  const insertValues = {
    companyName: data.companyName,
    contactName: data.contactName,
    email: data.email,
    phone: data.phone ?? null,
    sector: data.sector,
    employeeCount: data.employeeCount,
    assessmentType: data.assessmentType as "mini" | "full",
    status: "in_progress" as const,
    tenantId: tenantId ?? null,
    companyDomain: data.companyDomain ?? null,
    referralCode,
  };
  const [assessment] = await db
    .insert(assessmentsTable)
    .values(insertValues)
    .returning();

  // Track ownership in session so only this browser can access/modify this assessment
  addAssessmentToSession(req, assessment.id);

  res.status(201).json(assessment);
});

// GET /api/assessments/stats/summary — must come before /:id — admin only
// Supports optional query params: sector, dateFrom, dateTo, limit
router.get("/assessments/stats/summary", requireAdmin, async (req, res) => {
  const { sector, dateFrom, dateTo, limit: limitParam } = req.query;
  const tableLimit = Math.min(parseInt(String(limitParam ?? "20"), 10) || 20, 100);

  const tenantId = getSessionTenantId(req);
  const tenantCond = tenantId ? eq(assessmentsTable.tenantId, tenantId) : undefined;
  const sectorCond = sector && sector !== "all" ? eq(assessmentsTable.sector, sector as string) : undefined;
  const fromCond = dateFrom ? gte(assessmentsTable.createdAt, new Date(dateFrom as string)) : undefined;
  const toCond = dateTo ? lte(assessmentsTable.createdAt, new Date(dateTo as string)) : undefined;
  const whereClause = and(tenantCond, sectorCond, fromCond, toCond);

  const [totalResult, completedResult, avgResult, riskResults, recentAssessments, sectorResult, scoreDistResult, allSectorsResult] = await Promise.all([
    db.select({ count: count() }).from(assessmentsTable).where(whereClause),
    db.select({ count: count() }).from(assessmentsTable)
      .where(and(whereClause, sql`${assessmentsTable.status} != 'in_progress'`)),
    db.select({ avg: avg(assessmentsTable.totalScore) }).from(assessmentsTable)
      .where(and(whereClause, sql`${assessmentsTable.totalScore} IS NOT NULL`)),
    db.select({ riskLevel: assessmentsTable.riskLevel, count: count() })
      .from(assessmentsTable)
      .where(and(whereClause, sql`${assessmentsTable.riskLevel} IS NOT NULL`))
      .groupBy(assessmentsTable.riskLevel),
    db.select().from(assessmentsTable)
      .where(whereClause)
      .orderBy(desc(assessmentsTable.createdAt))
      .limit(tableLimit),
    db.select({ sector: assessmentsTable.sector, count: count() })
      .from(assessmentsTable)
      .where(whereClause)
      .groupBy(assessmentsTable.sector)
      .orderBy(desc(count())),
    db.select({
      bucket: sql<string>`
        CASE
          WHEN ${assessmentsTable.totalScore}::float / NULLIF(${assessmentsTable.maxScore}::float, 0) < 0.26 THEN '0-25%'
          WHEN ${assessmentsTable.totalScore}::float / NULLIF(${assessmentsTable.maxScore}::float, 0) < 0.51 THEN '26-50%'
          WHEN ${assessmentsTable.totalScore}::float / NULLIF(${assessmentsTable.maxScore}::float, 0) < 0.76 THEN '51-75%'
          ELSE '76-100%'
        END`,
      count: count(),
    })
    .from(assessmentsTable)
    .where(and(whereClause, sql`${assessmentsTable.totalScore} IS NOT NULL`))
    .groupBy(sql`1`)
    .orderBy(sql`1`),
    db.select({ sector: assessmentsTable.sector })
      .from(assessmentsTable)
      .groupBy(assessmentsTable.sector)
      .orderBy(assessmentsTable.sector),
  ]);

  const riskDistribution = { kritik: 0, yuksek: 0, orta: 0, dusuk: 0 };
  for (const row of riskResults) {
    if (row.riskLevel === "Kritik") riskDistribution.kritik = Number(row.count);
    else if (row.riskLevel === "Yüksek") riskDistribution.yuksek = Number(row.count);
    else if (row.riskLevel === "Orta") riskDistribution.orta = Number(row.count);
    else if (row.riskLevel === "Düşük") riskDistribution.dusuk = Number(row.count);
  }

  const BUCKET_ORDER = ["0-25%", "26-50%", "51-75%", "76-100%"];
  const scoreDistMap: Record<string, number> = {};
  for (const r of scoreDistResult) scoreDistMap[r.bucket] = Number(r.count);
  const scoreDistribution = BUCKET_ORDER.map(b => ({ bucket: b, count: scoreDistMap[b] ?? 0 }));

  res.json({
    totalAssessments: Number(totalResult[0]?.count ?? 0),
    completedAssessments: Number(completedResult[0]?.count ?? 0),
    averageScore: Number(avgResult[0]?.avg ?? 0),
    riskDistribution,
    recentAssessments,
    sectorBreakdown: sectorResult.map(r => ({ sector: r.sector, count: Number(r.count) })),
    scoreDistribution,
    allSectors: allSectorsResult.map(r => r.sector),
  });
});

// GET /api/assessments/:id
router.get("/assessments/:id", requireAssessmentOwner, async (req, res) => {
  const id = Number(req.params.id);
  const params = GetAssessmentParams.safeParse({ id });
  if (!params.success) {
    res.status(400).json({ error: "Geçersiz ID" });
    return;
  }

  const [assessment] = await db
    .select()
    .from(assessmentsTable)
    .where(eq(assessmentsTable.id, params.data.id));

  if (!assessment) {
    res.status(404).json({ error: "Değerlendirme bulunamadı" });
    return;
  }

  const answers = await db
    .select()
    .from(assessmentAnswersTable)
    .where(eq(assessmentAnswersTable.assessmentId, params.data.id))
    .orderBy(assessmentAnswersTable.questionNumber);

  res.json({ ...assessment, answers });
});

// POST /api/assessments/:id/answers
router.post("/assessments/:id/answers", requireAssessmentOwner, async (req, res) => {
  const params = SubmitAnswersParams.safeParse({ id: Number(req.params.id) });
  const body = SubmitAnswersBody.safeParse(req.body);

  if (!params.success || !body.success) {
    res.status(400).json({ error: "Geçersiz veri" });
    return;
  }

  const [assessment] = await db
    .select()
    .from(assessmentsTable)
    .where(eq(assessmentsTable.id, params.data.id));

  if (!assessment) {
    res.status(404).json({ error: "Değerlendirme bulunamadı" });
    return;
  }

  // Delete existing answers and re-insert
  await db
    .delete(assessmentAnswersTable)
    .where(eq(assessmentAnswersTable.assessmentId, params.data.id));

  const answerRows = body.data.answers.map((a) => ({
    assessmentId: params.data.id,
    questionNumber: a.questionNumber,
    answer: a.answer as "evet" | "kismen" | "bilmiyorum" | "hayir",
    score: a.answer === "evet" ? 5 : a.answer === "kismen" ? 3 : 0,
  }));

  await db.insert(assessmentAnswersTable).values(answerRows);

  const [updated] = await db
    .update(assessmentsTable)
    .set({ status: "completed" })
    .where(eq(assessmentsTable.id, params.data.id))
    .returning();

  res.json(updated);
});

// POST /api/assessments/:id/complete
router.post("/assessments/:id/complete", requireAssessmentOwner, async (req, res) => {
  const params = CompleteAssessmentParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Geçersiz ID" });
    return;
  }

  const [assessment] = await db
    .select()
    .from(assessmentsTable)
    .where(eq(assessmentsTable.id, params.data.id));

  if (!assessment) {
    res.status(404).json({ error: "Değerlendirme bulunamadı" });
    return;
  }

  const answers = await db
    .select()
    .from(assessmentAnswersTable)
    .where(eq(assessmentAnswersTable.assessmentId, params.data.id));

  const questionSet = assessment.assessmentType === "full" ? FULL_QUESTIONS : MINI_QUESTIONS;
  const scoring = calculateScore(
    answers.map((a) => ({ questionNumber: a.questionNumber, answer: a.answer })),
    questionSet
  );

  // Update assessment with score
  const [updated] = await db
    .update(assessmentsTable)
    .set({
      status: "report_ready",
      totalScore: scoring.totalScore,
      maxScore: scoring.maxScore,
      riskLevel: scoring.riskLevel,
      redAlarmCount: scoring.redAlarmCount,
      completedAt: new Date(),
    })
    .where(eq(assessmentsTable.id, params.data.id))
    .returning();

  // Send customer confirmation email (fire-and-forget)
  sendCustomerConfirmationEmail({
    assessmentId: params.data.id,
    tenantId: assessment.tenantId ?? undefined,
    companyName: assessment.companyName,
    contactName: assessment.contactName,
    customerEmail: assessment.email,
    riskLevel: scoring.riskLevel,
    scorePercent: scoring.scorePercent,
    totalScore: scoring.totalScore,
    maxScore: scoring.maxScore,
    redAlarmCount: scoring.redAlarmCount,
  }).catch((err) => {
    logger.error({ err, assessmentId: params.data.id }, "Customer confirmation email failed");
  });

  // Generate AI report asynchronously (don't await)
  generateAIReport(params.data.id, assessment, answers, scoring).catch((err) => {
    logger.error({ err, assessmentId: params.data.id }, "AI report generation failed");
  });

  res.json(updated);
});

async function generateAIReport(
  assessmentId: number,
  assessment: typeof assessmentsTable.$inferSelect,
  answers: (typeof assessmentAnswersTable.$inferSelect)[],
  scoring: ReturnType<typeof calculateScore>
): Promise<void> {
  // ─── Domain scan (fire alongside AI if company domain provided) ──────────────
  let domainScan: typeof domainScansTable.$inferSelect | null = null;
  if (assessment.companyDomain) {
    try {
      const domain = sanitizeDomain(assessment.companyDomain);
      if (/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z]{2,})+$/.test(domain)) {
        logger.info({ domain, assessmentId }, "Running domain scan for assessment");
        const [spf, dmarc, dkim, mx, ssl, hibp, blacklist, shadowIt, httpHeaders, urlhaus, usom, certTrans] = await Promise.all([
          checkSPF(domain), checkDMARC(domain), checkDKIM(domain), checkMX(domain),
          checkSSL(domain), checkHIBP(domain), checkBlacklists(domain), checkShadowIT(domain),
          checkHTTPHeaders(domain), checkURLhaus(domain), checkUsomList(domain), checkCertTransparency(domain),
        ]);
        const overallScore = calcScore(spf.pass, dmarc.pass, dkim.pass, mx.pass, ssl.pass);
        const [inserted] = await db.insert(domainScansTable).values({
          domain,
          email: assessment.email,
          tenantId: assessment.tenantId,
          spfPass: spf.pass, spfRecord: spf.record ?? null,
          dmarcPass: dmarc.pass, dmarcRecord: dmarc.record ?? null,
          dkimPass: dkim.pass, dkimSelectors: dkim.selectors,
          mxPass: mx.pass, mxRecords: mx.records,
          sslPass: ssl.pass, sslExpiry: ssl.expiryDate ?? null, sslIssuer: ssl.issuer ?? null, sslDaysUntilExpiry: ssl.daysUntilExpiry ?? null,
          overallScore,
          hibpBreachCount: hibp.breachCount, hibpBreaches: hibp.breaches,
          blacklisted: blacklist.blacklisted, blacklistCount: blacklist.blacklistCount, blacklistResults: blacklist.results,
          shadowItServices: shadowIt.services,
          httpHeadersScore: httpHeaders.score,
          httpHeadersDetails: { hsts: httpHeaders.hsts, xFrameOptions: httpHeaders.xFrameOptions, xContentTypeOptions: httpHeaders.xContentTypeOptions, csp: httpHeaders.csp, referrerPolicy: httpHeaders.referrerPolicy },
          urlhausListed: urlhaus.listed, urlhausThreat: urlhaus.threat,
          usomListed: usom.listed,
          ctSubdomains: certTrans.subdomains, ctSubdomainCount: certTrans.count,
        }).returning();
        domainScan = inserted ?? null;
        logger.info({ domain, overallScore, scanId: domainScan?.id }, "Domain scan complete for assessment");
      }
    } catch (err) {
      logger.warn({ err, assessmentId }, "Domain scan failed during assessment report generation");
    }
  }

  const questions = assessment.assessmentType === "full" ? FULL_QUESTIONS : MINI_QUESTIONS;
  const questionMap = new Map(questions.map((q) => [q.number, q]));
  const redAlarmDetails = scoring.redAlarmQuestions
    .map((qNum) => `Soru ${qNum}`)
    .join(", ");

  const answersText = answers
    .map((a) => {
      const q = questionMap.get(a.questionNumber);
      return `S${a.questionNumber} [${q?.domain ?? ""}/${q?.weight === 3 ? "Kritik" : q?.weight === 2 ? "Önemli" : "Normal"}]: ${a.answer}`;
    })
    .join("\n");

  const domainScanSection = domainScan ? `

ALAN ADI GÜVENLİK TARAMASI (${domainScan.domain}):
- SPF (sahte e-posta koruması): ${domainScan.spfPass ? "Aktif" : "Eksik — şirket adınıza sahte e-posta gönderilebilir"}
- DMARC (e-posta kimlik doğrulama): ${domainScan.dmarcPass ? "Aktif" : "Eksik — phishing saldırıları tespit edilemiyor"}
- DKIM (e-posta imzalama): ${domainScan.dkimPass ? "Aktif" : "Eksik — e-postalarınız değiştirilebilir"}
- SSL Sertifikası: ${domainScan.sslPass ? `Geçerli (${domainScan.sslDaysUntilExpiry ?? "?"} gün kaldı)` : "Hatalı veya süresi dolmuş — ziyaretçiler güvenlik uyarısı görüyor"}
- Kara Liste: ${domainScan.blacklisted ? `${domainScan.blacklistCount} spam listesinde kayıtlı — e-postalar müşterilere ulaşmıyor olabilir` : "Temiz"}
- Veri İhlali Geçmişi: ${domainScan.hibpBreachCount > 0 ? `${domainScan.hibpBreachCount} önceki veri ihlali tespit edildi — çalınan veriler hâlâ dolaşımda olabilir` : "Bilinen ihlal bulunamadı"}
- Tespit Edilen 3. Taraf Servisler (${(domainScan.shadowItServices as any[]).length}): ${(domainScan.shadowItServices as any[]).length > 0 ? (domainScan.shadowItServices as any[]).map((s: any) => `${s.name} (${s.risk} risk)`).join(", ") : "Yok"}
- Alan Adı Güvenlik Skoru: ${domainScan.overallScore}/100` : "";

  const prompt = `Sen KOBİ sahiplerine siber güvenlik danışmanlığı yapan kıdemli bir uzmansın. Görevin: teknik jargon KULLANMADAN, iş sahibinin anlayacağı dilde; iş sürekliliği, fidye saldırısı riski ve yasal uyum (KVKK vb.) odaklı bir Siber Sağlık Karnesi analizi yazmak.

ÖNEMLİ BAĞLAM: Bu analiz bir KOBİ sahibine sunulacak. "MFA", "EDR", "SPF", "DMARC", "endpoint", "patch", "vulnerability", "zero-day" gibi teknik terimler KOBİ sahibi için anlamsızdır. Her zayıflığı şu çerçevede ifade et: "Bu açık varsa → şirkete şu iş sonucu çıkar (üretim durur / fidye ödenir / müşteri verisi sızar / KVKK cezası gelir)".

Firma: ${assessment.companyName}
Sektör: ${assessment.sector}
Çalışan Sayısı: ${assessment.employeeCount}

SONUÇLAR:
- Siber Sağlık Skoru: ${scoring.totalScore}/${scoring.maxScore} (%${scoring.scorePercent})
- Risk Seviyesi: ${scoring.riskLevel}
- Acil Müdahale Gerektiren Alan Sayısı: ${scoring.redAlarmCount}
- Acil Alanlar: ${redAlarmDetails || "Yok"}

ALAN PUANLARI:
${scoring.domainScores.map((d) => `- ${d.domain}: %${d.percent} (${d.score}/${d.maxScore})`).join("\n")}
${domainScanSection}

CEVAPLAR:
${answersText}

JARGON DÖNÜŞÜM SÖZLÜĞÜ — bu listedeki teknik terimleri ASLA kullanma, karşısındaki iş dilini kullan:
- "MFA / 2FA / çift faktör" → "şifre çalınsa bile sisteme girilemez hale getirme"
- "MFA eksik" → "bir çalışanın şifresi ele geçirilirse sisteme doğrudan girilebilir, fidye yazılımı bu yolla yayılır"
- "EDR / antivirüs / endpoint koruma" → "bilgisayarlarda zararlı yazılım tespit ve engelleme sistemi"
- "EDR yok" → "bilgisayarlara bulaşan fidye yazılımı tüm sisteme yayılana kadar fark edilmez"
- "SPF / DKIM / DMARC" → "e-posta güvenlik kayıtları"
- "SPF/DMARC eksik" → "şirket adınıza sahte e-posta gönderilebilir, çalışanlarınız veya müşterileriniz dolandırılabilir"
- "patch / güncelleme eksikliği" → "bilinen güvenlik açıkları kapatılmamış, saldırganlar bu açıklardan sisteme girebilir"
- "access control / least privilege" → "kimin hangi bilgilere erişebildiği kontrol edilmiyor"
- "ayrıcalıklı hesap / admin hesabı açığı" → "yönetici yetkisine sahip hesap ele geçirilirse tüm sistem kontrol altına alınır"
- "yedek ayrımı yok / offline backup yok" → "fidye saldırısında yedekler de şifrelenir, sıfırdan başlamak zorunda kalırsınız"
- "BIA / business impact analysis" → "hangi sistemin durması işi ne kadar etkiler analizi"
- "penetrasyon testi / pentest" → "güvenlik uzmanlarının gerçek saldırı senaryolarıyla sistemi test etmesi"
- "VLAN / ağ segmentasyonu" → "kritik sistemlerin diğer bilgisayarlardan ayrılması"
- "firewall" → "dış dünyadan gelen saldırıları engelleyen ağ güvenlik duvarı"
- "phishing" → "sahte e-posta veya link yoluyla şifre/para çalma"
- "BEC / business email compromise" → "muhasebe veya yöneticiden geliyormuş gibi görünen sahte e-postayla para transferi"
- "ransomware / fidye yazılımı" → "sisteminizi kilitleyen ve şifreyi açmak için para talep eden zararlı yazılım"
- "KVKK ihlali" → "kişisel veri ihlali nedeniyle KVKK kapsamında idari para cezası ve müşteri güveni kaybı"
- "SSL sertifikası süresi dolmuş" → "web sitenizi ziyaret edenler güvenlik uyarısıyla karşılaşıyor, müşteri güveni zedeleniyor"
- "shadow IT" → "şirket onayı olmadan kullanılan uygulamalar, veri nereye gittiği bilinmiyor"

YAZIM KURALLARI (kesinlikle uy):
- Yanıtın SADECE geçerli bir JSON nesnesi olmalı, başka hiçbir şey yazma
- Düşünce süreci, açıklama, yorum YAZMA — sadece JSON
- Yukarıdaki jargon sözlüğündeki teknik terimleri KULLANMA
- Her zayıflığı şu formatta ifade et: "X eksik/yok → bu durumda Y iş sonucu çıkar"
- İş sonuçlarını somutlaştır: üretim durması, fidye ödeme, KVKK cezası, müşteri kaybı, banka/sigorta güvensizliği
- Fidye yazılımı riskini her değerlendirmede öne çıkar — özellikle yedekleme ve erişim kontrolü zayıfsa
- KVKK uyumunu sektöre göre vurgula (sağlık, finans, perakende için daha kritik)
- Analizi "Bu rapor, işletmenizin siber sağlık karnesinin ilk adımıdır" cümlesiyle kapat${domainScan ? "\n- Alan adı tarama sonuçlarındaki eksiklikleri iş etkisiyle birlikte analize dahil et" : ""}
- aiAnalysis düz paragraf metni olmalı, birden fazla paragraf için sadece \\n\\n kullan
- aiAnalysis içinde markdown yok: #, ##, **, *, - KULLANMA
- recommendations: iş sahibinin o gün uygulayabileceği veya IT/danışmana verebileceği somut talimatlar. Her madde "X yapın/yaptırın" formatında tek cümle. Teknik terim yok.${domainScan ? " Alan adı sorunları için somut adımlar ekle." : ""}
- Önerileri öncelik sırasına göre listele: önce iş sürekliliğini en çok tehdit eden açık
- estimatedBreachCostMin ve estimatedBreachCostMax: sektör, çalışan sayısı, risk seviyesi ve tespit edilen açıklara göre Türk Lirası cinsinden gerçekçi ihlal maliyeti tahmini (fidye, üretim kaybı, KVKK cezası, itibar kaybı dahil). Türkiye KOBİ gerçeklerini yansıt. Sadece tam sayı, sembol/noktalama yok.
- riskReductionPercent: önerileri tam uygularsa beklenen risk azalma yüzdesi (0–100 arası tam sayı).
- weeklyActionPlan: 4 haftalık eylem planı. Her haftada 2–3 somut, uygulanabilir görev. KOBİ sahibinin bizzat yapabileceği veya IT'ye yaptırabileceği. Teknik jargon yok. Görevler reports ile tutarlı olmalı.
- kvkkPenaltyMin ve kvkkPenaltyMax: Tespit edilen açıkları Türkiye KVKK Madde 12 (teknik ve idari tedbirler zorunluluğu) ve Madde 18 (yaptırımlar) kapsamında değerlendir. KVK Kurulu'nun 2022-2024 emsal kararlarından hareketle şirketin sektörü, çalışan sayısı ve ihlal ağırlığına göre olası idari para cezası aralığını TL cinsinden hesapla. Sadece tam sayı (sembol/virgül/nokta yok).
- kvkkRiskLevel: KVKK ihlal riski seviyesi — yalnızca şu değerlerden biri: "Düşük", "Orta", "Yüksek" veya "Kritik"
- kvkkRiskArticles: İhlal riski taşıyan KVKK maddeleri dizisi. Örn: ["Md.12", "Md.18"]
- kvkkRiskSummary: 2-3 cümle, KOBİ sahibinin anlayacağı dilde KVKK riski özeti. Teknik jargon yok — somut iş ve hukuki etki. Cezanın kişisel yönetim sorumluluğu boyutuna değin.
- sectorBenchmarkPercent: Bu firmayı Türkiye'de aynı sektör ve çalışan grubundaki şirketler içinde kaçıncı yüzdelik dilime koyarsın? Genel siber güvenlik raporları ve sektörel veriyi kullan. 0=en kötü, 100=en iyi yüzdelik dilim. Tam sayı.
- sectorBenchmarkComment: Tek cümle sektör karşılaştırması. Örn: "Türkiye perakende sektöründeki KOBİlerin %58'i sizden daha iyi skora sahip."
- verbisRequired: Bu şirketin Türkiye KVKK kapsamında VERBİS (Veri Sorumluları Sicili Bilgi Sistemi)'ne kayıt yaptırması zorunlu mu? Sağlık, hukuk, finans, e-ticaret sektörleri ve 50+ çalışanlı firmalar için genellikle zorunlu. true veya false döndür.
- verbisRiskLevel: VERBİS kaydı yaptırmamış olmanın getirdiği risk seviyesi — yalnızca: "Düşük", "Orta", "Yüksek" veya "Acil". Kayıt zorunluysa ve yoksa "Acil" veya "Yüksek" ver.
- verbisSteps: VERBİS kaydı için somut 4-5 adımlık yol haritası. Her adım tek cümle, KOBİ sahibinin anlayacağı dilde. Kayıtlıysa iyileştirme adımları ver.
- insuranceReadinessPercent: Bu şirketin siber sigorta için hazırlık puanı (0-100). Türkiye'de Allianz, AXA, Zurich gibi şirketlerin değerlendirme kriterlerini baz al: MFA, yedekleme, şifreleme, olay müdahale planı, e-posta güvenliği, yama yönetimi. Tam sayı.
- insuranceGaps: Sigorta kapsamını engelleyen veya primi artıran eksikleri listele. Her madde tek cümle, somut. 3-5 madde.
- Yanıtı şu JSON şablonuyla başlat: {"aiAnalysis":

JSON şablonu:
{
  "aiAnalysis": "500-700 kelimelik Türkçe analiz. Genel değerlendirme → güçlü yönler → kritik açıklar (iş etkisiyle) → fidye/iş sürekliliği riski → KVKK/regülasyon uyum değerlendirmesi → sektöre özgü riskler${domainScan ? " → alan adı/e-posta güvenlik değerlendirmesi" : ""}. Son cümle: 'Bu rapor, işletmenizin siber sağlık karnesinin ilk adımıdır.' Düz paragraf, jargon yok.",
  "recommendations": [
    "En kritik iş sürekliliği önlemi — somut, uygulanabilir talimat.",
    "İkinci öncelikli öneri.",
    "Üçüncü öneri.",
    "Dördüncü öneri.",
    "Beşinci öneri.",
    "Altıncı öneri (varsa)."
  ],
  "estimatedBreachCostMin": 150000,
  "estimatedBreachCostMax": 750000,
  "riskReductionPercent": 65,
  "weeklyActionPlan": [
    { "week": 1, "title": "Acil Önlemler (Bu Hafta)", "tasks": ["Somut aksiyon 1", "Somut aksiyon 2"] },
    { "week": 2, "title": "İkinci Hafta: E-posta ve Kimlik Güvenliği", "tasks": ["Somut aksiyon 1", "Somut aksiyon 2"] },
    { "week": 3, "title": "Üçüncü Hafta: Veri ve Cihaz Koruması", "tasks": ["Somut aksiyon 1", "Somut aksiyon 2"] },
    { "week": 4, "title": "Dördüncü Hafta: Süreklilik ve İzleme", "tasks": ["Somut aksiyon 1", "Somut aksiyon 2"] }
  ],
  "kvkkPenaltyMin": 50000,
  "kvkkPenaltyMax": 250000,
  "kvkkRiskLevel": "Yüksek",
  "kvkkRiskArticles": ["Md.12", "Md.18"],
  "kvkkRiskSummary": "KVKK riski 2-3 cümle özeti.",
  "sectorBenchmarkPercent": 42,
  "sectorBenchmarkComment": "Türkiye perakende sektöründeki KOBİlerin %58'i sizden daha iyi skora sahip.",
  "verbisRequired": true,
  "verbisRiskLevel": "Yüksek",
  "verbisSteps": ["Adım 1: verbis.kvkk.gov.tr adresine gidin.", "Adım 2: Veri sorumlusu olarak kayıt başlatın."],
  "insuranceReadinessPercent": 45,
  "insuranceGaps": ["MFA (çok faktörlü doğrulama) aktif değil.", "Düzenli yedekleme politikası yok."]
}`;

  // Full assessment: extended prompt with maturityLevel + findings + 8-week plan
  const fullPrompt = assessment.assessmentType === "full" ? `Sen KOBİ sahiplerine siber güvenlik danışmanlığı yapan kıdemli bir uzmansın. Görevin: teknik jargon KULLANMADAN, iş sahibinin anlayacağı dilde; 55 soruluk kapsamlı Siber Güvenlik Olgunluk Analizi yazmak.

ÖNEMLİ BAĞLAM: Bu analiz ücretli tam değerlendirme raporu. Daha kapsamlı, daha analitik ve daha fazla sektöre özgü öngörü içermeli.

Firma: ${assessment.companyName}
Sektör: ${assessment.sector}
Çalışan Sayısı: ${assessment.employeeCount}

SONUÇLAR:
- Siber Sağlık Skoru: ${scoring.totalScore}/${scoring.maxScore} (%${scoring.scorePercent})
- Risk Seviyesi: ${scoring.riskLevel}
- Acil Müdahale Gerektiren Alan Sayısı: ${scoring.redAlarmCount}
- Acil Alanlar: ${redAlarmDetails || "Yok"}

10 ALAN PUANLARI:
${scoring.domainScores.map((d) => `- ${d.domain}: %${d.percent} (${d.score}/${d.maxScore})`).join("\n")}
${domainScanSection}

CEVAPLAR:
${answersText}

YAZIM KURALLARI:
- Yanıtın SADECE geçerli bir JSON nesnesi olmalı
- Teknik jargon kullanma; her zayıflığı iş etkisiyle ifade et
- aiAnalysis: 700-900 kelime, kapsamlı yönetici özeti, düz paragraf, markdown yok
- maturityLevel: ISO 27001 / NIST CSF olgunluk çerçevesine göre şirketin genel seviyesi. Tam olarak şu değerlerden birini seç: "Başlangıç (Seviye 1)", "Gelişmekte (Seviye 2)", "Tanımlanmış (Seviye 3)", "Yönetilen (Seviye 4)", "Optimize Edilmiş (Seviye 5)"
- findings: 10 alan için per-domain bulgular. Her bulgu: domain (tam alan adı), severity ("Kritik", "Yüksek", "Orta", "Düşük"), title (kısa başlık), description (2-3 cümle iş etkisi), recommendation (tek uygulanabilir adım)
- weeklyActionPlan: 8 haftalık (mini yerine 8 hafta) eylem planı
- Diğer alanlar mini raporla aynı kurallara uyar (kvkk, sigorta, verbis, benchmark, maliyet tahmini vb.)
- Yanıtı şu JSON şablonuyla başlat: {"aiAnalysis":

JSON şablonu:
{
  "aiAnalysis": "700-900 kelimelik kapsamlı Türkçe analiz. Yönetici özeti → güçlü yönler → kritik alanlar → alan bazlı riskler → fidye/iş sürekliliği → KVKK/regülasyon → sektöre özgü tehditler${domainScan ? " → alan adı güvenlik değerlendirmesi" : ""}. Son cümle: 'Bu rapor, işletmenizin siber güvenlik olgunluk yolculuğunda önemli bir mihenk taşıdır.'",
  "maturityLevel": "Gelişmekte (Seviye 2)",
  "findings": [
    { "domain": "Yönetişim ve Risk Yönetimi", "severity": "Yüksek", "title": "Yazılı politika eksikliği", "description": "...", "recommendation": "..." },
    { "domain": "Kimlik ve Erişim Yönetimi", "severity": "Kritik", "title": "MFA uygulanmamış", "description": "...", "recommendation": "..." }
  ],
  "recommendations": ["En kritik önlem.", "İkinci öneri.", "Üçüncü öneri.", "Dördüncü öneri.", "Beşinci öneri.", "Altıncı öneri.", "Yedinci öneri.", "Sekizinci öneri."],
  "estimatedBreachCostMin": 200000,
  "estimatedBreachCostMax": 1200000,
  "riskReductionPercent": 72,
  "weeklyActionPlan": [
    { "week": 1, "title": "Hafta 1: Acil Önlemler", "tasks": ["Aksiyon 1", "Aksiyon 2", "Aksiyon 3"] },
    { "week": 2, "title": "Hafta 2: Kimlik ve Erişim", "tasks": ["Aksiyon 1", "Aksiyon 2"] },
    { "week": 3, "title": "Hafta 3: E-posta Güvenliği", "tasks": ["Aksiyon 1", "Aksiyon 2"] },
    { "week": 4, "title": "Hafta 4: Cihaz ve Uç Nokta", "tasks": ["Aksiyon 1", "Aksiyon 2"] },
    { "week": 5, "title": "Hafta 5: Ağ Güvenliği", "tasks": ["Aksiyon 1", "Aksiyon 2"] },
    { "week": 6, "title": "Hafta 6: Veri Koruma", "tasks": ["Aksiyon 1", "Aksiyon 2"] },
    { "week": 7, "title": "Hafta 7: Tedarik Zinciri", "tasks": ["Aksiyon 1", "Aksiyon 2"] },
    { "week": 8, "title": "Hafta 8: Süreklilik ve İzleme", "tasks": ["Aksiyon 1", "Aksiyon 2"] }
  ],
  "kvkkPenaltyMin": 75000,
  "kvkkPenaltyMax": 400000,
  "kvkkRiskLevel": "Yüksek",
  "kvkkRiskArticles": ["Md.12", "Md.18"],
  "kvkkRiskSummary": "KVKK riski özeti.",
  "sectorBenchmarkPercent": 38,
  "sectorBenchmarkComment": "Sektör karşılaştırması.",
  "verbisRequired": true,
  "verbisRiskLevel": "Yüksek",
  "verbisSteps": ["Adım 1", "Adım 2", "Adım 3", "Adım 4"],
  "insuranceReadinessPercent": 40,
  "insuranceGaps": ["Eksik 1", "Eksik 2", "Eksik 3"]
}` : null;

  try {
    let text: string;
    if (assessment.assessmentType === "full" && fullPrompt) {
      const claudeFn = getClaudeAiFn();
      text = await claudeFn(fullPrompt);
    } else {
      const aiFn = await getTenantAiFn(assessment.tenantId ?? undefined);
      text = await aiFn(prompt);
    }
    const parsed = parseAiJson(text);
    if (!parsed) {
      logger.error({ assessmentId, textPreview: text.slice(0, 200) }, "AI report JSON parse failed");
    }
    // On parse failure, fall back to the placeholder message — never store the
    // raw AI/JSON blob into aiAnalysis (that leaks JSON onto the report + PDF).
    const fields = parsed
      ? extractReportFields(parsed)
      : extractReportFields({ aiAnalysis: AI_ANALYSIS_FALLBACK });
    const {
      aiAnalysis,
      recommendations,
      estimatedBreachCostMin,
      estimatedBreachCostMax,
      riskReductionPercent,
      weeklyActionPlan,
      kvkkPenaltyMin,
      kvkkPenaltyMax,
      kvkkRiskLevel,
      kvkkRiskArticles,
      kvkkRiskSummary,
      sectorBenchmarkPercent,
      sectorBenchmarkComment,
      verbisRequired,
      verbisRiskLevel,
      verbisSteps,
      insuranceReadinessPercent,
      insuranceGaps,
      maturityLevel,
      findings,
    } = fields;

    const [existingReport] = await db
      .select()
      .from(reportsTable)
      .where(eq(reportsTable.assessmentId, assessmentId));

    const reviewToken = crypto.randomUUID();

    if (existingReport) {
      await db
        .update(reportsTable)
        .set({ aiAnalysis, recommendations, estimatedBreachCostMin, estimatedBreachCostMax, riskReductionPercent, weeklyActionPlan, kvkkPenaltyMin, kvkkPenaltyMax, kvkkRiskLevel, kvkkRiskArticles, kvkkRiskSummary, sectorBenchmarkPercent, sectorBenchmarkComment, verbisRequired, verbisRiskLevel, verbisSteps, insuranceReadinessPercent, insuranceGaps, maturityLevel, findings, reviewToken, reviewStatus: "pending_review", ...(domainScan ? { domainScanId: domainScan.id } : {}) })
        .where(eq(reportsTable.assessmentId, assessmentId));
    } else {
      await db.insert(reportsTable).values({
        assessmentId,
        totalScore: scoring.totalScore,
        maxScore: scoring.maxScore,
        scorePercent: scoring.scorePercent,
        riskLevel: scoring.riskLevel,
        redAlarmCount: scoring.redAlarmCount,
        redAlarmQuestions: scoring.redAlarmQuestions,
        aiAnalysis,
        recommendations,
        estimatedBreachCostMin,
        estimatedBreachCostMax,
        riskReductionPercent,
        weeklyActionPlan,
        kvkkPenaltyMin,
        kvkkPenaltyMax,
        kvkkRiskLevel,
        kvkkRiskArticles,
        kvkkRiskSummary,
        sectorBenchmarkPercent,
        sectorBenchmarkComment,
        verbisRequired,
        verbisRiskLevel,
        verbisSteps,
        insuranceReadinessPercent,
        insuranceGaps,
        maturityLevel,
        findings,
        domainScores: scoring.domainScores,
        reviewToken,
        reviewStatus: "pending_review",
        ...(domainScan ? { domainScanId: domainScan.id } : {}),
      });
    }

    // Build enriched answers with question text for the admin email
    const enrichedAnswers = answers.map((a) => {
      const q = questionMap.get(a.questionNumber);
      return {
        questionNumber: a.questionNumber,
        answer: a.answer,
        text: q?.text ?? `Soru ${a.questionNumber}`,
        domain: q?.domain ?? "",
        isRedAlarm: q?.isRedAlarm ?? false,
      };
    });

    // Notify admin
    await sendAdminNotificationEmail({
      assessmentId,
      companyName: assessment.companyName,
      contactName: assessment.contactName,
      customerEmail: assessment.email,
      sector: assessment.sector,
      employeeCount: assessment.employeeCount,
      riskLevel: scoring.riskLevel,
      scorePercent: scoring.scorePercent,
      redAlarmCount: scoring.redAlarmCount,
      reviewToken,
      aiAnalysis,
      answers: enrichedAnswers,
    });
  } catch (err) {
    logger.error({ err, assessmentId }, "Failed to generate AI report");
    const [existingReport] = await db
      .select()
      .from(reportsTable)
      .where(eq(reportsTable.assessmentId, assessmentId));

    const reviewToken = crypto.randomUUID();
    if (!existingReport) {
      await db.insert(reportsTable).values({
        assessmentId,
        totalScore: scoring.totalScore,
        maxScore: scoring.maxScore,
        scorePercent: scoring.scorePercent,
        riskLevel: scoring.riskLevel,
        redAlarmCount: scoring.redAlarmCount,
        redAlarmQuestions: scoring.redAlarmQuestions,
        aiAnalysis: "AI analizi şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.",
        recommendations: [],
        domainScores: scoring.domainScores,
        reviewToken,
        reviewStatus: "pending_review",
        ...(domainScan ? { domainScanId: domainScan.id } : {}),
      });

      await sendAdminNotificationEmail({
        assessmentId,
        companyName: assessment.companyName,
        contactName: assessment.contactName,
        customerEmail: assessment.email,
        sector: assessment.sector,
        employeeCount: assessment.employeeCount,
        riskLevel: scoring.riskLevel,
        scorePercent: scoring.scorePercent,
        redAlarmCount: scoring.redAlarmCount,
        reviewToken,
        aiAnalysis: "AI analizi oluşturulamadı.",
        answers: answers.map((a) => {
          const qset = assessment.assessmentType === "full" ? FULL_QUESTIONS : MINI_QUESTIONS;
          const q = new Map(qset.map((q) => [q.number, q])).get(a.questionNumber);
          return {
            questionNumber: a.questionNumber,
            answer: a.answer,
            text: q?.text ?? `Soru ${a.questionNumber}`,
            domain: q?.domain ?? "",
            isRedAlarm: q?.isRedAlarm ?? false,
          };
        }),
      }).catch(() => {});
    }
  }
}

// GET /api/assessments/:id/report
router.get("/assessments/:id/report", requireAssessmentOwner, async (req, res) => {
  const params = GetReportParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Geçersiz ID" });
    return;
  }

  const [assessment] = await db
    .select()
    .from(assessmentsTable)
    .where(eq(assessmentsTable.id, params.data.id));

  if (!assessment) {
    res.status(404).json({ error: "Değerlendirme bulunamadı" });
    return;
  }

  const [report] = await db
    .select()
    .from(reportsTable)
    .where(eq(reportsTable.assessmentId, params.data.id));

  if (!report) {
    res.status(202).json({ status: "pending", message: "Rapor hazırlanıyor..." });
    return;
  }

  // ─── Domain scan (fetch if linked, filter by plan) ────────────────────────────
  let domainScanData: Record<string, unknown> | null = null;
  if (report.domainScanId) {
    const [scan] = await db.select().from(domainScansTable).where(eq(domainScansTable.id, report.domainScanId));
    if (scan) {
      if (assessment.assessmentType === "full") {
        // Paid: full details
        domainScanData = scan as unknown as Record<string, unknown>;
      } else {
        // Free: only overview score
        domainScanData = {
          id: scan.id,
          domain: scan.domain,
          overallScore: scan.overallScore,
          createdAt: scan.createdAt,
        };
      }
    }
  }

  // ─── Skor takibi: aynı e-postanın önceki tamamlanmış değerlendirmesi ─────────
  const [previousAssessment] = await db
    .select({
      id: assessmentsTable.id,
      totalScore: assessmentsTable.totalScore,
      maxScore: assessmentsTable.maxScore,
      riskLevel: assessmentsTable.riskLevel,
      createdAt: assessmentsTable.createdAt,
    })
    .from(assessmentsTable)
    .where(
      and(
        eq(assessmentsTable.email, assessment.email),
        sql`${assessmentsTable.id} < ${params.data.id}`,
        sql`${assessmentsTable.status} != 'in_progress'`,
        sql`${assessmentsTable.totalScore} IS NOT NULL`,
      )
    )
    .orderBy(desc(assessmentsTable.createdAt))
    .limit(1);

  // ─── Sektörel kıyaslama: gerçek DB ortalaması (≥3 kayıt varsa kullan) ────────
  const [sectorStats] = await db
    .select({
      cnt: count(),
      avgPct: sql<number>`ROUND(AVG(${assessmentsTable.totalScore}::float / NULLIF(${assessmentsTable.maxScore}::float,0) * 100))`,
    })
    .from(assessmentsTable)
    .where(
      and(
        eq(assessmentsTable.sector, assessment.sector),
        sql`${assessmentsTable.totalScore} IS NOT NULL`,
        sql`${assessmentsTable.id} != ${params.data.id}`,
      )
    );

  const sectorAvg =
    Number(sectorStats?.cnt ?? 0) >= 3
      ? { value: Number(sectorStats.avgPct), source: "real" as const }
      : null; // frontend falls back to static table

  const previousScore = previousAssessment
    ? {
        id: previousAssessment.id,
        scorePercent: Math.round(
          (Number(previousAssessment.totalScore) / Number(previousAssessment.maxScore)) * 100
        ),
        riskLevel: previousAssessment.riskLevel,
        createdAt: previousAssessment.createdAt,
      }
    : null;

  res.json({ ...recoverReportFields(report), previousScore, sectorAvg, domainScan: domainScanData });
});

// GET /api/assessments/:id/insurance-report
router.get("/assessments/:id/insurance-report", requireAssessmentOwner, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return void res.status(400).json({ error: "Geçersiz ID" });
  const [assessment] = await db.select().from(assessmentsTable).where(eq(assessmentsTable.id, id));
  if (!assessment) return void res.status(404).json({ error: "Değerlendirme bulunamadı" });
  const [report] = await db.select().from(reportsTable).where(eq(reportsTable.assessmentId, id));
  if (!report) return void res.status(404).json({ error: "Rapor henüz hazır değil" });
  const healed = recoverReportFields(report);
  try {
    const { generateInsuranceReport } = await import("../../services/pdf");
    const buf = await generateInsuranceReport({
      companyName: assessment.companyName,
      sector: assessment.sector ?? "Belirtilmemiş",
      employeeCount: assessment.employeeCount ?? "Belirtilmemiş",
      score: healed.scorePercent ?? 0,
      insuranceReadinessPercent: healed.insuranceReadinessPercent ?? null,
      insuranceGaps: (healed.insuranceGaps as string[]) ?? [],
      kvkkRiskLevel: healed.kvkkRiskLevel ?? null,
      recommendations: (healed.recommendations as string[]) ?? [],
      createdAt: report.createdAt.toISOString(),
      assessmentId: id,
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="CyberStep_Sigorta_Raporu_${id}.pdf"`);
    res.setHeader("Content-Length", buf.length);
    res.send(buf);
  } catch (err) {
    req.log.error({ err, assessmentId: id }, "Insurance report PDF generation failed");
    res.status(500).json({ error: "Sigorta raporu oluşturulamadı" });
  }
});

// GET /api/assessments/:id/report/pdf
router.get("/assessments/:id/report/pdf", requireAssessmentOwner, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id) || id <= 0) {
    res.status(400).json({ error: "Geçersiz ID" });
    return;
  }

  const [assessment] = await db
    .select()
    .from(assessmentsTable)
    .where(eq(assessmentsTable.id, id));

  if (!assessment) {
    res.status(404).json({ error: "Değerlendirme bulunamadı" });
    return;
  }

  const [report] = await db
    .select()
    .from(reportsTable)
    .where(eq(reportsTable.assessmentId, id));

  if (!report) {
    res.status(404).json({ error: "Rapor henüz hazır değil" });
    return;
  }

  const healed = recoverReportFields(report);

  try {
    const pdfBuffer = await generateReportPDF({
      assessmentId: id,
      companyName: assessment.companyName,
      contactName: assessment.contactName,
      sector: assessment.sector,
      employeeCount: assessment.employeeCount,
      riskLevel: healed.riskLevel,
      scorePercent: healed.scorePercent,
      totalScore: healed.totalScore,
      maxScore: healed.maxScore,
      redAlarmCount: healed.redAlarmCount,
      aiAnalysis: healed.aiAnalysis ?? "",
      recommendations: (healed.recommendations as string[]) ?? [],
      domainScores: (healed.domainScores as any[]) ?? [],
      adminNotes: report.adminNotes ?? null,
      createdAt: report.createdAt?.toISOString(),
    });

    const safeCompany = assessment.companyName.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="CyberStep_Rapor_${safeCompany}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err) {
    logger.error({ err, assessmentId: id }, "PDF generation failed");
    res.status(500).json({ error: "PDF oluşturulamadı" });
  }
});

// GET /api/verify/:token  — public verification page data (no auth required)
router.get("/verify/:token", async (req, res) => {
  const token = req.params.token?.trim();
  if (!token) {
    res.status(400).json({ error: "Geçersiz token" });
    return;
  }

  const [report] = await db
    .select({
      id: reportsTable.id,
      assessmentId: reportsTable.assessmentId,
      scorePercent: reportsTable.scorePercent,
      riskLevel: reportsTable.riskLevel,
      createdAt: reportsTable.createdAt,
      verificationToken: reportsTable.verificationToken,
      verifiedAt: reportsTable.verifiedAt,
      verificationExpiresAt: reportsTable.verificationExpiresAt,
      certificationTier: reportsTable.certificationTier,
    })
    .from(reportsTable)
    .where(eq(reportsTable.verificationToken, token))
    .limit(1);

  if (!report) {
    res.status(404).json({ error: "Doğrulama bulunamadı" });
    return;
  }

  const [assessment] = await db
    .select({
      companyName: assessmentsTable.companyName,
      sector: assessmentsTable.sector,
      employeeCount: assessmentsTable.employeeCount,
      completedAt: assessmentsTable.completedAt,
    })
    .from(assessmentsTable)
    .where(eq(assessmentsTable.id, report.assessmentId));

  if (!assessment) {
    res.status(404).json({ error: "Değerlendirme bulunamadı" });
    return;
  }

  const now = new Date();
  if (report.verificationExpiresAt && new Date(report.verificationExpiresAt) < now) {
    res.status(410).json({ error: "Bu doğrulama rozeti süresi dolmuştur", expired: true });
    return;
  }

  res.json({
    companyName: assessment.companyName,
    sector: assessment.sector,
    employeeCount: assessment.employeeCount,
    riskLevel: report.riskLevel,
    scorePercent: report.scorePercent,
    completedAt: assessment.completedAt ?? report.createdAt,
    verifiedAt: report.verifiedAt ?? report.createdAt,
    verificationExpiresAt: report.verificationExpiresAt ?? null,
    certificationTier: report.certificationTier ?? 1,
    verificationCode: `TR-${new Date(report.verifiedAt ?? report.createdAt).getFullYear()}-${token.slice(0, 5).toUpperCase()}`,
  });
});

// GET /api/badge-advantages — aktif avantajları herkese açık döndür
router.get("/badge-advantages", async (_req, res) => {
  const rows = await db
    .select()
    .from(badgeAdvantagesTable)
    .where(eq(badgeAdvantagesTable.isActive, true))
    .orderBy(asc(badgeAdvantagesTable.sortOrder), asc(badgeAdvantagesTable.id));
  res.json(rows);
});

export default router;
