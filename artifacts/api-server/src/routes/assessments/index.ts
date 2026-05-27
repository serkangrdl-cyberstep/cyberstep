import { Router } from "express";
import { db } from "@workspace/db";
import {
  assessmentsTable,
  assessmentAnswersTable,
  reportsTable,
} from "@workspace/db";
import {
  CreateAssessmentBody,
  SubmitAnswersBody,
  GetAssessmentParams,
  SubmitAnswersParams,
  CompleteAssessmentParams,
  GetReportParams,
} from "@workspace/api-zod";
import { eq, desc, sql, count, avg, gte, lte, and } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";
import { calculateScore, MINI_QUESTIONS } from "./scoring";
import { logger } from "../../lib/logger";
import { sendAdminNotificationEmail, sendCustomerConfirmationEmail } from "../../services/email";
import { generateReportPDF } from "../../services/pdf";
import { requireAdmin, requireAssessmentOwner, addAssessmentToSession } from "../../middleware/auth";

const router = Router();

// POST /api/assessments
router.post("/assessments", async (req, res) => {
  const parsed = CreateAssessmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Geçersiz istek verisi" });
    return;
  }

  const data = parsed.data;
  const [assessment] = await db
    .insert(assessmentsTable)
    .values({
      companyName: data.companyName,
      contactName: data.contactName,
      email: data.email,
      phone: data.phone ?? null,
      sector: data.sector,
      employeeCount: data.employeeCount,
      assessmentType: data.assessmentType as "mini" | "full",
      status: "in_progress",
    })
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

  const sectorCond = sector && sector !== "all" ? eq(assessmentsTable.sector, sector as string) : undefined;
  const fromCond = dateFrom ? gte(assessmentsTable.createdAt, new Date(dateFrom as string)) : undefined;
  const toCond = dateTo ? lte(assessmentsTable.createdAt, new Date(dateTo as string)) : undefined;
  const whereClause = and(sectorCond, fromCond, toCond);

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
    score: a.answer === "evet" ? 5 : a.answer === "kismen" ? 3 : a.answer === "bilmiyorum" ? 1 : 0,
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

  const scoring = calculateScore(
    answers.map((a) => ({ questionNumber: a.questionNumber, answer: a.answer }))
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
) {
  const questionMap = new Map(MINI_QUESTIONS.map((q) => [q.number, q]));
  const redAlarmDetails = scoring.redAlarmQuestions
    .map((qNum) => `Soru ${qNum}`)
    .join(", ");

  const answersText = answers
    .map((a) => {
      const q = questionMap.get(a.questionNumber);
      return `S${a.questionNumber} [${q?.domain ?? ""}/${q?.weight === 2 ? "Kritik" : "Normal"}]: ${a.answer}`;
    })
    .join("\n");

  const prompt = `Sen KOBİ sahiplerine siber güvenlik danışmanlığı yapan bir uzmansın. Görevin teknik jargon kullanmadan, iş sonuçlarına odaklanan sade Türkçe bir analiz yazmak.

Firma: ${assessment.companyName}
Sektör: ${assessment.sector}
Çalışan Sayısı: ${assessment.employeeCount}

SONUÇLAR:
- Toplam Puan: ${scoring.totalScore}/${scoring.maxScore} (%${scoring.scorePercent})
- Risk Seviyesi: ${scoring.riskLevel}
- Acil Müdahale Gerektiren Alan Sayısı: ${scoring.redAlarmCount}
- Acil Alanlar: ${redAlarmDetails || "Yok"}

ALAN PUANLARI:
${scoring.domainScores.map((d) => `- ${d.domain}: %${d.percent} (${d.score}/${d.maxScore})`).join("\n")}

CEVAPLAR:
${answersText}

YAZIM KURALLARI (kesinlikle uy):
- Yanıtın SADECE geçerli bir JSON nesnesi olmalı, başka hiçbir şey yazma
- Düşünce süreci, açıklama, yorum YAZMA — sadece JSON
- Teknik terim KULLANMA. Şu örnekleri izle:
    * "MFA/2FA eksikliği" yerine → "çalışan hesaplarına şifre çalınırsa ikinci engel yok"
    * "DKIM/SPF yapılandırması" yerine → "şirket adınıza sahte e-posta gönderilebilir"
    * "endpoint protection" yerine → "bilgisayarlarda zararlı yazılım koruması"
    * "access control" yerine → "kimin hangi bilgilere erişebildiği kontrol edilmiyor"
- Her zayıflığı şöyle ifade et: ne olabilir → şirkete maliyeti ne olur
- aiAnalysis düz paragraf metni olmalı, birden fazla paragraf için sadece \\n\\n kullan
- aiAnalysis içinde markdown yok: #, ##, **, *, - KULLANMA
- recommendations: iş sahibinin anlayacağı, somut, uygulanabilir adımlar. Her madde tek cümle.
- Yanıtı şu JSON şablonuyla başlat: {"aiAnalysis":

JSON şablonu:
{
  "aiAnalysis": "400-600 kelimelik Türkçe analiz. Güçlü yönler → zayıf yönler (iş etkisiyle) → acil müdahale gerektiren durumlar → sektöre özgü değerlendirme. Düz paragraf, jargon yok.",
  "recommendations": [
    "İş sahibinin anlayacağı somut öneri 1.",
    "İş sahibinin anlayacağı somut öneri 2.",
    "İş sahibinin anlayacağı somut öneri 3.",
    "İş sahibinin anlayacağı somut öneri 4.",
    "İş sahibinin anlayacağı somut öneri 5."
  ]
}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        maxOutputTokens: 4096,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const text = response.text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    let aiAnalysis = "AI analizi yüklenemedi.";
    let recommendations: string[] = [];

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        aiAnalysis = parsed.aiAnalysis ?? aiAnalysis;
        recommendations = parsed.recommendations ?? [];
      } catch {
        aiAnalysis = text;
      }
    }

    const [existingReport] = await db
      .select()
      .from(reportsTable)
      .where(eq(reportsTable.assessmentId, assessmentId));

    const reviewToken = crypto.randomUUID();
    const verificationToken = crypto.randomUUID();

    if (existingReport) {
      await db
        .update(reportsTable)
        .set({ aiAnalysis, recommendations, reviewToken, reviewStatus: "pending_review" })
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
        domainScores: scoring.domainScores,
        reviewToken,
        verificationToken,
        reviewStatus: "pending_review",
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
        verificationToken: crypto.randomUUID(),
        reviewStatus: "pending_review",
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
          const q = new Map(MINI_QUESTIONS.map((q) => [q.number, q])).get(a.questionNumber);
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

  res.json({ ...report, previousScore, sectorAvg });
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

  try {
    const pdfBuffer = await generateReportPDF({
      assessmentId: id,
      companyName: assessment.companyName,
      contactName: assessment.contactName,
      sector: assessment.sector,
      employeeCount: assessment.employeeCount,
      riskLevel: report.riskLevel,
      scorePercent: report.scorePercent,
      totalScore: report.totalScore,
      maxScore: report.maxScore,
      redAlarmCount: report.redAlarmCount,
      aiAnalysis: report.aiAnalysis ?? "",
      recommendations: (report.recommendations as string[]) ?? [],
      domainScores: (report.domainScores as any[]) ?? [],
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

  res.json({
    companyName: assessment.companyName,
    sector: assessment.sector,
    employeeCount: assessment.employeeCount,
    riskLevel: report.riskLevel,
    scorePercent: report.scorePercent,
    completedAt: assessment.completedAt ?? report.createdAt,
    verifiedAt: report.createdAt,
  });
});

export default router;
