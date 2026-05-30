import { Router } from "express";
import type { Request, Response } from "express";
import { randomBytes } from "node:crypto";
import { db } from "@workspace/db";
import { tprmQuestionnaireLinkTable, tprmQuestionnaireResponseTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";
import { logger } from "../../lib/logger";

const router = Router();

// ─── TPRM Anket Soruları ──────────────────────────────────────────────────────
// 10 soru, Evet=10/Kısmen=5/Hayır=0 → max 100

export const TPRM_QUESTIONS = [
  { id: 1, text: "Çalışanlarınız yılda en az bir kez siber güvenlik eğitimi alıyor mu?", weight: 1 },
  { id: 2, text: "Tüm kritik sistem hesaplarında çok faktörlü doğrulama (MFA) aktif mi?", weight: 1 },
  { id: 3, text: "E-posta güvenliği için SPF, DKIM ve DMARC kaydı uyguluyor musunuz?", weight: 1 },
  { id: 4, text: "Yazılım ve işletim sistemleri otomatik veya zamanında güncelleniyor mu?", weight: 1 },
  { id: 5, text: "Kritik verilerinizin düzenli yedeği alınıyor ve geri yükleme test ediliyor mu?", weight: 1 },
  { id: 6, text: "Bir siber güvenlik olay müdahale planınız (CSIRP) var mı?", weight: 1 },
  { id: 7, text: "Sisteminize erişen üçüncü tarafların erişimleri izleniyor ve yönetiliyor mu?", weight: 1 },
  { id: 8, text: "Müşteri ve iş ortağı verilerini şifreli saklıyor musunuz?", weight: 1 },
  { id: 9, text: "Son 12 ayda bir güvenlik açığı taraması veya sızma testi yaptırdınız mı?", weight: 1 },
  { id: 10, text: "Çalışanlarınıza yönelik sosyal mühendislik / phishing simülasyonu yapıyor musunuz?", weight: 1 },
];

// ─── POST /api/tprm/questionnaire ─────────────────────────────────────────────
// Tedarikçi için anket linki oluştur

router.post("/tprm/questionnaire", async (req: Request, res: Response) => {
  const { companyName, companySector, supplierDomain, supplierName, scanScore, scanData } = req.body as {
    companyName?: string;
    companySector?: string;
    supplierDomain?: string;
    supplierName?: string;
    scanScore?: number;
    scanData?: unknown;
  };

  if (!companyName || !companySector || !supplierDomain) {
    res.status(400).json({ error: "companyName, companySector ve supplierDomain zorunludur" });
    return;
  }

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 gün

  try {
    const [link] = await db.insert(tprmQuestionnaireLinkTable).values({
      companyName,
      companySector,
      supplierDomain,
      supplierName: supplierName ?? null,
      token,
      scanScore: scanScore ?? null,
      scanData: (scanData ?? null) as Record<string, unknown> | null,
      expiresAt,
    }).returning();

    res.json({
      token,
      link: `/tprm/anket/${token}`,
      expiresAt: expiresAt.toISOString(),
      id: link.id,
    });
  } catch (err) {
    logger.error({ err }, "TPRM questionnaire link creation error");
    res.status(500).json({ error: "Link oluşturulamadı" });
  }
});

// ─── GET /api/tprm/questionnaire/:token ───────────────────────────────────────
// Tedarikçi anket detaylarını getir

router.get("/tprm/questionnaire/:token", async (req: Request, res: Response) => {
  const token = req.params["token"] as string;
  try {
    const [link] = await db.select().from(tprmQuestionnaireLinkTable)
      .where(eq(tprmQuestionnaireLinkTable.token, token));

    if (!link) {
      res.status(404).json({ error: "Anket bulunamadı" });
      return;
    }

    if (new Date() > link.expiresAt) {
      res.status(410).json({ error: "Anket süresi dolmuş" });
      return;
    }

    // Check if already completed
    const [existing] = await db.select().from(tprmQuestionnaireResponseTable)
      .where(eq(tprmQuestionnaireResponseTable.linkId, link.id));

    res.json({
      companyName: link.companyName,
      companySector: link.companySector,
      supplierDomain: link.supplierDomain,
      supplierName: link.supplierName,
      scanScore: link.scanScore,
      expiresAt: link.expiresAt,
      questions: TPRM_QUESTIONS,
      alreadyCompleted: !!existing,
      existingResult: existing ? {
        selfScore: existing.selfScore,
        combinedScore: existing.combinedScore,
        completedAt: existing.completedAt,
      } : null,
    });
  } catch (err) {
    logger.error({ err }, "TPRM questionnaire get error");
    res.status(500).json({ error: "Anket yüklenemedi" });
  }
});

// ─── POST /api/tprm/questionnaire/:token/submit ───────────────────────────────
// Tedarikçi anket yanıtlarını gönder

router.post("/tprm/questionnaire/:token/submit", async (req: Request, res: Response) => {
  const token = req.params["token"] as string;
  const { supplierContactName, supplierContactEmail, answers } = req.body as {
    supplierContactName?: string;
    supplierContactEmail?: string;
    answers?: Array<{ questionId: number; answer: "evet" | "kismen" | "hayir" }>;
  };

  if (!supplierContactName || !supplierContactEmail || !answers?.length) {
    res.status(400).json({ error: "Tüm alanlar zorunludur" });
    return;
  }

  try {
    const [link] = await db.select().from(tprmQuestionnaireLinkTable)
      .where(eq(tprmQuestionnaireLinkTable.token, token));

    if (!link) {
      res.status(404).json({ error: "Anket bulunamadı" });
      return;
    }

    if (new Date() > link.expiresAt) {
      res.status(410).json({ error: "Anket süresi dolmuş" });
      return;
    }

    // Existing check
    const [existing] = await db.select().from(tprmQuestionnaireResponseTable)
      .where(eq(tprmQuestionnaireResponseTable.linkId, link.id));
    if (existing) {
      res.status(409).json({ error: "Bu anket zaten tamamlandı" });
      return;
    }

    // Calculate self score (10 points per question: evet=10, kismen=5, hayir=0)
    const scoredAnswers = answers.map(a => ({
      questionId: a.questionId,
      answer: a.answer,
      score: a.answer === "evet" ? 10 : a.answer === "kismen" ? 5 : 0,
    }));
    const selfScore = scoredAnswers.reduce((sum, a) => sum + a.score, 0);

    // Combined score: 60% scan + 40% self-assessment
    let combinedScore: number | null = null;
    if (link.scanScore !== null && link.scanScore !== undefined) {
      combinedScore = Math.round(link.scanScore * 0.6 + selfScore * 0.4);
    }

    // AI risk değerlendirmesi
    let aiRiskComment = "";
    try {
      const prompt = `Sen tedarikçi risk uzmanısın. Tedarikçi beyanı:
Sektör: ${link.companySector}
Alan adı: ${link.supplierDomain}
Domain tarama skoru: ${link.scanScore !== null ? link.scanScore + "/100" : "mevcut değil"}
Tedarikçi öz-değerlendirme skoru: ${selfScore}/100
Bileşik risk skoru: ${combinedScore !== null ? combinedScore + "/100" : selfScore + "/100"}

Yanıtlar:
${scoredAnswers.map(a => `Q${a.questionId}: ${a.answer} (${a.score}/10)`).join("\n")}

2-3 cümle ile bu tedarikçinin risk profilini Türkçe yaz. Somut risk varsa belirt.`;

      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });
      aiRiskComment = result.text?.trim() ?? "";
    } catch {
      // AI yorumu isteğe bağlı
    }

    const [response] = await db.insert(tprmQuestionnaireResponseTable).values({
      linkId: link.id,
      supplierContactName,
      supplierContactEmail,
      answers: scoredAnswers as unknown as Record<string, unknown>[],
      selfScore,
      combinedScore,
    }).returning();

    res.json({
      selfScore,
      combinedScore,
      riskLevel: (combinedScore ?? selfScore) >= 70 ? "Düşük" : (combinedScore ?? selfScore) >= 40 ? "Orta" : "Yüksek",
      aiRiskComment,
      responseId: response.id,
    });
  } catch (err) {
    logger.error({ err }, "TPRM questionnaire submit error");
    res.status(500).json({ error: "Yanıtlar gönderilemedi" });
  }
});

// ─── GET /api/tprm/questionnaire/:token/result ────────────────────────────────
// Sonuçları incele (şirket için)

router.get("/tprm/questionnaire/:token/result", async (req: Request, res: Response) => {
  const token = req.params["token"] as string;
  try {
    const [link] = await db.select().from(tprmQuestionnaireLinkTable)
      .where(eq(tprmQuestionnaireLinkTable.token, token));

    if (!link) {
      res.status(404).json({ error: "Bulunamadı" });
      return;
    }

    const [response] = await db.select().from(tprmQuestionnaireResponseTable)
      .where(eq(tprmQuestionnaireResponseTable.linkId, link.id));

    res.json({
      link,
      response: response ?? null,
      questions: TPRM_QUESTIONS,
    });
  } catch (err) {
    logger.error({ err }, "TPRM result get error");
    res.status(500).json({ error: "Sonuçlar yüklenemedi" });
  }
});

export default router;
