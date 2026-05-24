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
import { eq, desc, sql, count, avg } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";
import { calculateScore, MINI_QUESTIONS } from "./scoring";
import { logger } from "../../lib/logger";
import { sendAdminNotificationEmail } from "../../services/email";

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

  res.status(201).json(assessment);
});

// GET /api/assessments/stats/summary — must come before /:id
router.get("/assessments/stats/summary", async (_req, res) => {
  const totalResult = await db
    .select({ count: count() })
    .from(assessmentsTable);

  const completedResult = await db
    .select({ count: count() })
    .from(assessmentsTable)
    .where(sql`${assessmentsTable.status} != 'in_progress'`);

  const avgResult = await db
    .select({ avg: avg(assessmentsTable.totalScore) })
    .from(assessmentsTable)
    .where(sql`${assessmentsTable.totalScore} IS NOT NULL`);

  const riskResults = await db
    .select({
      riskLevel: assessmentsTable.riskLevel,
      count: count(),
    })
    .from(assessmentsTable)
    .where(sql`${assessmentsTable.riskLevel} IS NOT NULL`)
    .groupBy(assessmentsTable.riskLevel);

  const riskDistribution = {
    kritik: 0,
    yuksek: 0,
    orta: 0,
    dusuk: 0,
  };

  for (const row of riskResults) {
    if (row.riskLevel === "Kritik") riskDistribution.kritik = Number(row.count);
    else if (row.riskLevel === "Yüksek") riskDistribution.yuksek = Number(row.count);
    else if (row.riskLevel === "Orta") riskDistribution.orta = Number(row.count);
    else if (row.riskLevel === "Düşük") riskDistribution.dusuk = Number(row.count);
  }

  const recentAssessments = await db
    .select()
    .from(assessmentsTable)
    .orderBy(desc(assessmentsTable.createdAt))
    .limit(5);

  res.json({
    totalAssessments: Number(totalResult[0]?.count ?? 0),
    completedAssessments: Number(completedResult[0]?.count ?? 0),
    averageScore: Number(avgResult[0]?.avg ?? 0),
    riskDistribution,
    recentAssessments,
  });
});

// GET /api/assessments/:id
router.get("/assessments/:id", async (req, res) => {
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
router.post("/assessments/:id/answers", async (req, res) => {
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
router.post("/assessments/:id/complete", async (req, res) => {
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

  const prompt = `Sen bir siber güvenlik uzmanısın. Aşağıdaki KOBİ'nin siber güvenlik değerlendirme sonuçlarını analiz et.

Firma: ${assessment.companyName}
Sektör: ${assessment.sector}
Çalışan Sayısı: ${assessment.employeeCount}
Değerlendirme Türü: Mini (20 soru)

SONUÇLAR:
- Toplam Puan: ${scoring.totalScore}/${scoring.maxScore} (${scoring.scorePercent}%)
- Risk Seviyesi: ${scoring.riskLevel}
- Kırmızı Alarm Sayısı: ${scoring.redAlarmCount}
- Kırmızı Alarm Sorular: ${redAlarmDetails || "Yok"}

DOMAIN PUANLARI:
${scoring.domainScores.map((d) => `- ${d.domain}: ${d.score}/${d.maxScore} (%${d.percent})`).join("\n")}

CEVAPLAR:
${answersText}

KURALLAR (kesinlikle uy):
- Yanıtın SADECE geçerli bir JSON nesnesi olmalı, başka hiçbir şey yazma
- Düşünce süreci, açıklama, yorum, başlık YAZMA — sadece JSON
- aiAnalysis içinde markdown kullanma: #, ##, **, *, -, liste numarası KULLANMA
- aiAnalysis düz paragraf metni olmalı, birden fazla paragraf için sadece \\n\\n kullan
- recommendations dizisindeki her eleman düz Türkçe cümle, markdown yok
- Yanıtı şu JSON şablonuyla başlat: {"aiAnalysis":

JSON şablonu:
{
  "aiAnalysis": "Burada 400-600 kelimelik Türkçe analiz. Firmanın güçlü/zayıf yönleri, kırmızı alarm alanları, sektöre özgü riskler. Düz paragraf, markdown yok.",
  "recommendations": [
    "Türkçe somut öneri 1.",
    "Türkçe somut öneri 2."
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
        reviewStatus: "pending_review",
      });
    }

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
      }).catch(() => {});
    }
  }
}

// GET /api/assessments/:id/report
router.get("/assessments/:id/report", async (req, res) => {
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

  res.json(report);
});

export default router;
