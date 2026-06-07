import { Router } from "express";
import type { Request } from "express";
import { db } from "@workspace/db";
import {
  aiAssessmentsTable,
  aiAssessmentAnswersTable,
  aiToolsRegistryTable,
} from "@workspace/db";
import { eq, desc, and, or, isNull, lt, inArray } from "drizzle-orm";
import { getClaudeAiFn } from "../../services/ai-client";
import { requireAdmin } from "../../middleware/auth";
import { logger } from "../../lib/logger";

const router = Router();

function sess(req: Request) {
  return req.session as unknown as Record<string, unknown>;
}

function addAiAssessmentToSession(req: Request, id: number) {
  const s = sess(req);
  const existing = (s["ownedAiAssessmentIds"] as number[] | undefined) ?? [];
  s["ownedAiAssessmentIds"] = [...new Set([...existing, id])];
}

function requireAiAssessmentOwner(req: Request, res: import("express").Response, next: import("express").NextFunction): void {
  const adminId = sess(req)["adminId"] as number | undefined;
  if (adminId) { next(); return; }
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  const owned = (sess(req)["ownedAiAssessmentIds"] as number[] | undefined) ?? [];
  if (!owned.includes(id)) { res.status(403).json({ error: "Bu değerlendirmeye erişim izniniz yok" }); return; }
  next();
}

// ─── Soru listesi ─────────────────────────────────────────────────────────────
export const AI_QUESTIONS: Array<{
  number: number;
  area: string;
  areaLabel: string;
  text: string;
  helpText: string;
  weight: 1 | 2 | 3;
  isRedAlarm: boolean;
}> = [
  // Alan 1 — Yapay Zeka Araç Yönetimi
  { number: 1,  area: "AI1", areaLabel: "Yapay Zeka Araç Yönetimi",      weight: 3, isRedAlarm: true,  text: "Şirketinizde çalışanların hangi yapay zeka araçlarını kullandığı takip ediliyor mu?",                                                                                          helpText: "ChatGPT, Gemini, Copilot gibi araçların kimler tarafından, ne amaçla kullanıldığını biliyor musunuz?" },
  { number: 2,  area: "AI1", areaLabel: "Yapay Zeka Araç Yönetimi",      weight: 2, isRedAlarm: true,  text: "IT departmanının onaylamadığı yapay zeka araçlarının kullanımı kısıtlanıyor mu?",                                                                                            helpText: "Çalışanlar herhangi bir yapay zeka aracını serbestçe kullanabiliyor mu? Onay mekanizması var mı?" },
  { number: 3,  area: "AI1", areaLabel: "Yapay Zeka Araç Yönetimi",      weight: 2, isRedAlarm: false, text: "Yapay zeka araçları kullanımı için yazılı bir şirket politikası veya kural seti var mı?",                                                                                    helpText: '"Yapay zekaya şu tür veri girilmez" gibi yazılı bir kural belgesi hazırlandı mı?' },
  { number: 4,  area: "AI1", areaLabel: "Yapay Zeka Araç Yönetimi",      weight: 1, isRedAlarm: false, text: "Çalışanlara hangi yapay zeka araçlarını kullanabilecekleri ve nasıl güvenli kullanacakları konusunda eğitim verildi mi?",                                                   helpText: "Farkındalık eğitimi olmadan çalışanlar risk oluşturduğunun farkında olmayabilir." },
  { number: 5,  area: "AI1", areaLabel: "Yapay Zeka Araç Yönetimi",      weight: 2, isRedAlarm: false, text: "Şirkette kullanılan yapay zeka araçları için kurumsal (işletme) hesap mı yoksa kişisel hesap mı kullanılıyor?",                                                             helpText: "Kişisel hesapla kullanılan araçlar şirket kontrolü dışında. Kurumsal hesap veri güvenliğini artırır." },
  // Alan 2 — Veri Maruz Kalma Riski
  { number: 6,  area: "AI2", areaLabel: "Veri Maruz Kalma Riski",        weight: 3, isRedAlarm: true,  text: "Çalışanlar müşteri adı, telefon veya e-posta gibi kişisel bilgileri yapay zeka araçlarına giriyor mu?",                                                                     helpText: "KVKK kapsamındaki kişisel veri, açık rıza olmadan yurt dışı bir AI sunucusuna gönderilemez." },
  { number: 7,  area: "AI2", areaLabel: "Veri Maruz Kalma Riski",        weight: 3, isRedAlarm: true,  text: "Finansal veriler (fatura detayı, banka bilgisi, maaş bilgisi) yapay zeka araçlarına kopyalanıyor mu?",                                                                      helpText: "Finansal veri hem KVKK hem ticari sır kapsamında. AI aracına yapıştırılması ciddi risk." },
  { number: 8,  area: "AI2", areaLabel: "Veri Maruz Kalma Riski",        weight: 3, isRedAlarm: true,  text: "Şirket sözleşmeleri, teklifler veya gizlilik anlaşmaları yapay zeka araçlarına yükleniyor mu?",                                                                             helpText: "Sözleşme içeriği rakiplerin veya kötü niyetli kişilerin eline geçebilir. Ticari sır riski yüksek." },
  { number: 9,  area: "AI2", areaLabel: "Veri Maruz Kalma Riski",        weight: 3, isRedAlarm: true,  text: "Çalışan özlük dosyası, maaş bilgisi veya performans değerlendirmesi gibi personel verileri AI araçlarında işleniyor mu?",                                                   helpText: "Personel verisi KVKK özel kategorisine yakın. AI araçlarına girişi ciddi hukuki risk doğurur." },
  { number: 10, area: "AI2", areaLabel: "Veri Maruz Kalma Riski",        weight: 3, isRedAlarm: true,  text: "Müşterilere ait sağlık, inanç veya biyometrik gibi özel nitelikli veriler yapay zeka araçlarında işleniyor mu?",                                                            helpText: "Özel nitelikli kişisel veri en yüksek KVKK korumasına tabi. AI araçlarına girişi doğrudan ihlal." },
  { number: 11, area: "AI2", areaLabel: "Veri Maruz Kalma Riski",        weight: 2, isRedAlarm: true,  text: "Şirketin ticari sırları, stratejik planları veya rakip analizleri yapay zeka araçlarına yazılıyor mu?",                                                                    helpText: "Yapay zeka sağlayıcısı bu bilgilere erişebilir. Rekabet avantajı kaybolabilir." },
  { number: 12, area: "AI2", areaLabel: "Veri Maruz Kalma Riski",        weight: 2, isRedAlarm: false, text: "Müşteri veya iş ortağı e-postaları yapay zeka araçlarına doğrudan kopyalanıyor mu?",                                                                                        helpText: "E-posta içeriğinde yer alan kişisel veriler AI aracına iletilmiş olur. KVKK açısından riskli." },
  { number: 13, area: "AI2", areaLabel: "Veri Maruz Kalma Riski",        weight: 3, isRedAlarm: true,  text: "Ses kayıtları veya görüntüler (toplantı kaydı, müşteri fotoğrafı) yapay zeka araçlarına yükleniyor mu?",                                                                   helpText: "Ses verisi KVKK kapsamında biyometrik veri sayılabilir. Ses AI araçlarına yüklenmesi çok yüksek risk." },
  // Alan 3 — Araç Konfigürasyonu ve Kontrol
  { number: 14, area: "AI3", areaLabel: "Araç Konfigürasyonu ve Kontrol", weight: 2, isRedAlarm: true,  text: "Kullanılan AI araçlarında veri eğitiminden çıkış (opt-out) ayarı yapılandırıldı mı?",                                                                                      helpText: 'Çoğu AI aracında "Verilerimi eğitim için kullanma" seçeneği var. Bu ayar aktive edildi mi?' },
  { number: 15, area: "AI3", areaLabel: "Araç Konfigürasyonu ve Kontrol", weight: 2, isRedAlarm: true,  text: "Kurumsal AI araçları için hizmet sağlayıcıyla Veri İşleme Sözleşmesi (DPA) imzalandı mı?",                                                                                helpText: "KVKK'ya göre kişisel veri işleten üçüncü taraflarla DPA imzalanması zorunlu." },
  { number: 16, area: "AI3", areaLabel: "Araç Konfigürasyonu ve Kontrol", weight: 2, isRedAlarm: false, text: "AI araçlarına erişimde çalışanlara kişisel hesap yerine kurumsal hesap zorunluluğu getiriliyor mu?",                                                                       helpText: "Kurumsal hesap, hangi çalışanın ne zaman ne kullandığını izlemeyi mümkün kılar." },
  { number: 17, area: "AI3", areaLabel: "Araç Konfigürasyonu ve Kontrol", weight: 1, isRedAlarm: false, text: "Hangi yapay zeka araçlarının kullanıldığı ve bunların ne için kullanıldığı kayıt altında tutuluyor mu?",                                                                   helpText: "Audit trail olmadan KVKK denetiminde 'ne işlendi' sorusunu yanıtlamak çok zorlaşır." },
  { number: 18, area: "AI3", areaLabel: "Araç Konfigürasyonu ve Kontrol", weight: 1, isRedAlarm: false, text: "AI ile üretilen içeriklerin doğruluğu kontrol edilmeden dışarıya (müşteri, resmi kurum) gönderilmemesi için kural var mı?",                                                helpText: "AI 'hallüsinasyon' yapabilir: olmayan bilgi üretebilir. Bu içerik müşteriye giderse hukuki sorumluluk doğar." },
  { number: 19, area: "AI3", areaLabel: "Araç Konfigürasyonu ve Kontrol", weight: 1, isRedAlarm: false, text: "Deepfake veya yapay zeka ile oluşturulmuş sahte içerik (ses taklidi, görsel manipülasyon) konusunda çalışan farkındalığı oluşturuldu mu?",                                helpText: "'CEO\\'nuzun sesi gibi konuşan biri para istiyor' — bu saldırı Türkiye\\'de artıyor. Hazırlıklı mısınız?" },
  // Alan 4 — KVKK ve Hukuki Uyum
  { number: 20, area: "AI4", areaLabel: "KVKK ve Hukuki Uyum",           weight: 2, isRedAlarm: true,  text: "Yapay zeka araçlarına kişisel veri girişinin KVKK kapsamında yurt dışına veri aktarımı sayılabileceği bilinciyle hareket ediliyor mu?",                                    helpText: "ChatGPT, Gemini gibi ABD menşeli araçlara kişisel veri göndermek KVKK Madde 9 kapsamında yurt dışı aktarım." },
  { number: 21, area: "AI4", areaLabel: "KVKK ve Hukuki Uyum",           weight: 2, isRedAlarm: false, text: "Yapay zeka araçlarının kullanımı, şirketin KVKK Aydınlatma Metni ve Gizlilik Politikasına yansıtıldı mı?",                                                               helpText: '"Verileriniz AI araçlarıyla işlenebilir" ifadesi aydınlatma metninde yer alıyor mu?' },
  { number: 22, area: "AI4", areaLabel: "KVKK ve Hukuki Uyum",           weight: 1, isRedAlarm: false, text: "AI araçlarıyla işlenen kişisel veriler için VERBİS kaydında gerekli başlık oluşturuldu mu?",                                                                               helpText: "Yeni bir veri işleme faaliyeti başladığında VERBİS'in güncellenmesi KVKK gereği." },
  { number: 23, area: "AI4", areaLabel: "KVKK ve Hukuki Uyum",           weight: 1, isRedAlarm: false, text: "Çalışanlara yapay zeka kullanımında KVKK yükümlülükleri ve sorumlulukları anlatıldı mı?",                                                                                 helpText: "Çalışan farkındalığı hem hukuki yükümlülük hem etkin koruma için zorunlu." },
  { number: 24, area: "AI4", areaLabel: "KVKK ve Hukuki Uyum",           weight: 2, isRedAlarm: true,  text: "Yapay zeka aracından kaynaklanan veri ihlali senaryosu olay müdahale planına eklendi mi?",                                                                                 helpText: '"AI aracına yanlışlıkla müşteri verisi girdik" — bu durumda 72 saatlik KVKK bildirimi prosedürü hazır mı?' },
  { number: 25, area: "AI4", areaLabel: "KVKK ve Hukuki Uyum",           weight: 2, isRedAlarm: false, text: "Otomatik karar veren yapay zeka sistemi kullanılıyorsa (kredi skoru, işe alım filtresi) KVKK Madde 11 kapsamı değerlendirildi mi?",                                        helpText: "Tamamen otomatik kararlar KVKK kapsamında özel yükümlülükler gerektirir." },
];

// Red alarm sorularda evet=iyi, hayır/bilmiyorum=kötü
// Ancak bu assessmentta sorular olumsuz yönde sorulmuş (risk edimler)
// Soru 1-5, 6-13: "yapıyor mu?" → evet = risk = kötü
// Soru 14-25: "yapıldı mı?" → evet = güvenli = iyi
// Bu nedenle ters yönlü skor: hayır = 5 puan, evet = 0 puan değil
// Tasarım belgesindeki yaklaşım: evet = güvenli anlamında sorulacak
// Alan 1-3'te bazı sorular "kısıtlanıyor mu?", "yapılandırıldı mı?" gibi pozitif
// Allen 2'de sorular "giriyor mu?" gibi negatif
// GERÇEK YAKLAŞIM: belgede evet=daha yüksek puan mantığı var
// Tasarım belgesinde Area 2 sorularında "hayır" tercih edilen cevap
// Basitlik için belgede belirtilen yaklaşımı izleyeceğiz:
// evet=5, kismen=3, hayir=0, bilmiyorum=0
// Ancak Area 2 soruları ters (risk soruları) — bunlarda evet=0, hayir=5
// Ama bu çok karmaşık. Tasarım belgesini re-okuyorum...
// Belge: "evet=5, kismen=3, hayır=0, bilmiyorum=0" genel puanlama
// Ve soruların hepsi güvenlik pratiklerini soruyor (pozitif yönde)
// Yani "kısıtlanıyor mu?" → evet = iyi = 5 puan
// "giriyor mu?" soruları TERS: evet = risk = kötü = 0 puan, hayır = iyi = 5 puan
// Bu soruların işaretini belgede belirtmek gerekiyor
// Tasarım belgesi bu detayı tam açıklamamış
// Pratik çözüm: tüm sorular "güvenlik kontrolü" yönünde 
// Veri maruz kalma sorularını ters çevireceğiz
// Soru 6-13 "giriyor mu?" → evet = risk, hayır = iyi
// Bu sorularda ters puanlama yapacağız

const REVERSE_SCORE_QUESTIONS = new Set([6, 7, 8, 9, 10, 11, 12, 13]);

export function calculateAiScore(answers: Record<number, string>): {
  rawScore: number;
  maxScore: number;
  percentage: number;
  area1Score: number;
  area2Score: number;
  area3Score: number;
  area4Score: number;
  riskLevel: string;
} {
  const area1Qs = AI_QUESTIONS.filter(q => q.area === "AI1");
  const area2Qs = AI_QUESTIONS.filter(q => q.area === "AI2");
  const area3Qs = AI_QUESTIONS.filter(q => q.area === "AI3");
  const area4Qs = AI_QUESTIONS.filter(q => q.area === "AI4");

  function scoreAnswer(answer: string, qNum: number, weight: number): number {
    const isReverse = REVERSE_SCORE_QUESTIONS.has(qNum);
    let pts: number;
    if (isReverse) {
      // evet = risk = 0 puan
      if (answer === "hayir") pts = 5;
      else if (answer === "kismen") pts = 3;
      else pts = 0;
    } else {
      if (answer === "evet") pts = 5;
      else if (answer === "kismen") pts = 3;
      else pts = 0;
    }
    return pts * weight;
  }

  function areaScore(qs: typeof area1Qs): number {
    return qs.reduce((sum, q) => sum + scoreAnswer(answers[q.number] ?? "bilmiyorum", q.number, q.weight), 0);
  }

  function areaMax(qs: typeof area1Qs): number {
    return qs.reduce((sum, q) => sum + 5 * q.weight, 0);
  }

  const a1 = areaScore(area1Qs);
  const a2 = areaScore(area2Qs);
  const a3 = areaScore(area3Qs);
  const a4 = areaScore(area4Qs);

  const maxScore = areaMax(area1Qs) + areaMax(area2Qs) + areaMax(area3Qs) + areaMax(area4Qs);
  const rawScore = a1 + a2 + a3 + a4;
  const percentage = Math.round((rawScore / maxScore) * 100);

  let riskLevel: string;
  if (percentage >= 86) riskLevel = "IYI";
  else if (percentage >= 71) riskLevel = "DUSUK";
  else if (percentage >= 51) riskLevel = "ORTA";
  else if (percentage >= 31) riskLevel = "YUKSEK";
  else riskLevel = "KRITIK";

  return { rawScore, maxScore, percentage, area1Score: a1, area2Score: a2, area3Score: a3, area4Score: a4, riskLevel };
}

// ─── AI Araçları ──────────────────────────────────────────────────────────────
// GET /api/ai-tools
router.get("/ai-tools", async (req, res) => {
  try {
    const tools = await db
      .select()
      .from(aiToolsRegistryTable)
      .where(eq(aiToolsRegistryTable.isActive, true))
      .orderBy(aiToolsRegistryTable.toolName);
    res.json(tools);
  } catch (err) {
    req.log.error({ err }, "ai-tools list error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// GET /api/ai-tools/:id
router.get("/ai-tools/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  try {
    const [tool] = await db.select().from(aiToolsRegistryTable).where(eq(aiToolsRegistryTable.id, id));
    if (!tool) { res.status(404).json({ error: "Araç bulunamadı" }); return; }
    res.json(tool);
  } catch (err) {
    req.log.error({ err }, "ai-tool get error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── AI Değerlendirme ─────────────────────────────────────────────────────────
// POST /api/ai-assessment/start
router.post("/ai-assessment/start", async (req, res) => {
  const { companyName, contactName, email, sector, employeeCount } = req.body as Record<string, string>;
  if (!companyName || !contactName || !email || !sector || !employeeCount) {
    res.status(400).json({ error: "Tüm alanlar zorunludur" });
    return;
  }
  try {
    const [assessment] = await db.insert(aiAssessmentsTable).values({
      companyName,
      contactName,
      email,
      sector,
      employeeCount,
      status: "in_progress",
    }).returning();
    addAiAssessmentToSession(req, assessment.id);
    res.status(201).json({ id: assessment.id });
  } catch (err) {
    req.log.error({ err }, "ai-assessment start error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// GET /api/ai-assessment/:id
router.get("/ai-assessment/:id", requireAiAssessmentOwner, async (req, res) => {
  const id = Number(req.params["id"]);
  try {
    const [assessment] = await db.select().from(aiAssessmentsTable).where(eq(aiAssessmentsTable.id, id));
    if (!assessment) { res.status(404).json({ error: "Değerlendirme bulunamadı" }); return; }
    res.json(assessment);
  } catch (err) {
    req.log.error({ err }, "ai-assessment get error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// POST /api/ai-assessment/:id/tools
router.post("/ai-assessment/:id/tools", requireAiAssessmentOwner, async (req, res) => {
  const id = Number(req.params["id"]);
  const { toolIds } = req.body as { toolIds: number[] };
  if (!Array.isArray(toolIds)) { res.status(400).json({ error: "toolIds dizisi gerekli" }); return; }
  try {
    await db.update(aiAssessmentsTable)
      .set({ declaredToolIds: toolIds, status: "tools_selected" })
      .where(eq(aiAssessmentsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "ai-assessment tools error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// POST /api/ai-assessment/:id/answers
router.post("/ai-assessment/:id/answers", requireAiAssessmentOwner, async (req, res) => {
  const id = Number(req.params["id"]);
  const { answers } = req.body as { answers: Array<{ questionNumber: number; answer: string }> };
  if (!Array.isArray(answers) || answers.length === 0) {
    res.status(400).json({ error: "answers dizisi gerekli" }); return;
  }
  const validAnswers = ["evet", "kismen", "hayir", "bilmiyorum"];
  for (const a of answers) {
    if (!validAnswers.includes(a.answer)) {
      res.status(400).json({ error: `Geçersiz cevap: ${a.answer}` }); return;
    }
  }
  try {
    // Mevcut cevapları sil, yenileri ekle
    await db.delete(aiAssessmentAnswersTable).where(eq(aiAssessmentAnswersTable.aiAssessmentId, id));
    await db.insert(aiAssessmentAnswersTable).values(
      answers.map(a => ({ aiAssessmentId: id, questionNumber: a.questionNumber, answer: a.answer }))
    );
    await db.update(aiAssessmentsTable).set({ status: "in_quiz" }).where(eq(aiAssessmentsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "ai-assessment answers error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── Report generation claim (compare-and-set) ────────────────────────────────

const REPORT_STALE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Atomically transition an AI assessment into "generating_report" iff eligible:
 * "completed" or "report_failed" status, or a stale "generating_report" whose
 * startedAt is older than REPORT_STALE_MS (i.e. orphaned by a server restart).
 * Returns true only to the winner so the caller knows whether to launch the job.
 */
async function claimReportGeneration(assessmentId: number): Promise<boolean> {
  const staleCutoff = new Date(Date.now() - REPORT_STALE_MS);
  const claimed = await db.update(aiAssessmentsTable)
    .set({ status: "generating_report", reportGenerationStartedAt: new Date() })
    .where(and(
      eq(aiAssessmentsTable.id, assessmentId),
      or(
        inArray(aiAssessmentsTable.status, ["completed", "report_failed"]),
        and(
          eq(aiAssessmentsTable.status, "generating_report"),
          or(isNull(aiAssessmentsTable.reportGenerationStartedAt), lt(aiAssessmentsTable.reportGenerationStartedAt, staleCutoff)),
        ),
      ),
    ))
    .returning({ id: aiAssessmentsTable.id });
  return claimed.length > 0;
}

// POST /api/ai-assessment/:id/complete
router.post("/ai-assessment/:id/complete", requireAiAssessmentOwner, async (req, res) => {
  const id = Number(req.params["id"]);
  try {
    const [assessment] = await db.select().from(aiAssessmentsTable).where(eq(aiAssessmentsTable.id, id));
    if (!assessment) { res.status(404).json({ error: "Değerlendirme bulunamadı" }); return; }

    const answerRows = await db.select().from(aiAssessmentAnswersTable)
      .where(eq(aiAssessmentAnswersTable.aiAssessmentId, id));
    const answerMap: Record<number, string> = {};
    for (const row of answerRows) { answerMap[row.questionNumber] = row.answer; }

    const scores = calculateAiScore(answerMap);

    await db.update(aiAssessmentsTable).set({
      status: "completed",
      ...scores,
      completedAt: new Date(),
    }).where(eq(aiAssessmentsTable.id, id));

    res.json({ ok: true, ...scores });

    // Fire-and-forget: AI raporu ve politika belgesi oluştur
    // claimReportGeneration inside guards against duplicate/stale runs
    generateAiReport(id, assessment, answerMap, scores).catch((err: unknown) => {
      logger.error({ err, assessmentId: id }, "AI report generation failed");
    });
  } catch (err) {
    req.log.error({ err }, "ai-assessment complete error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// GET /api/ai-assessment/:id/report
router.get("/ai-assessment/:id/report", requireAiAssessmentOwner, async (req, res) => {
  const id = Number(req.params["id"]);
  try {
    const [assessment] = await db.select().from(aiAssessmentsTable).where(eq(aiAssessmentsTable.id, id));
    if (!assessment) { res.status(404).json({ error: "Değerlendirme bulunamadı" }); return; }

    // Auto-recover stale "generating_report" — server restart mid-AI-generation leaves them stuck
    if (assessment.status === "generating_report") {
      const startedAt = assessment.reportGenerationStartedAt;
      if (!startedAt || Date.now() - new Date(startedAt).getTime() > REPORT_STALE_MS) {
        await db.update(aiAssessmentsTable)
          .set({ status: "report_failed" })
          .where(and(eq(aiAssessmentsTable.id, id), eq(aiAssessmentsTable.status, "generating_report")));
        const updated = { ...assessment, status: "report_failed" };
        res.json({ ...updated, declaredTools: [] });
        return;
      }
    }

    // Beyan edilen araç detaylarını da getir
    let declaredTools: import("@workspace/db").AiToolsRegistry[] = [];
    if (assessment.declaredToolIds && Array.isArray(assessment.declaredToolIds)) {
      const toolIds = assessment.declaredToolIds as number[];
      if (toolIds.length > 0) {
        declaredTools = await db.select().from(aiToolsRegistryTable)
          .where(eq(aiToolsRegistryTable.isActive, true));
        declaredTools = declaredTools.filter(t => toolIds.includes(t.id));
      }
    }

    res.json({ ...assessment, declaredTools });
  } catch (err) {
    req.log.error({ err }, "ai-assessment report get error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// POST /api/ai-assessment/:id/regenerate-report — retry after failure or timeout
router.post("/ai-assessment/:id/regenerate-report", requireAiAssessmentOwner, async (req, res) => {
  const id = Number(req.params["id"]);
  try {
    const [assessment] = await db.select().from(aiAssessmentsTable).where(eq(aiAssessmentsTable.id, id));
    if (!assessment) { res.status(404).json({ error: "Değerlendirme bulunamadı" }); return; }
    if (assessment.status === "report_ready") { res.json({ status: "report_ready", message: "Rapor zaten hazır" }); return; }

    const answerRows = await db.select().from(aiAssessmentAnswersTable)
      .where(eq(aiAssessmentAnswersTable.aiAssessmentId, id));
    const answerMap: Record<number, string> = {};
    for (const row of answerRows) { answerMap[row.questionNumber] = row.answer; }
    const scores = calculateAiScore(answerMap);

    // Fire-and-forget; claimReportGeneration inside prevents duplicate runs
    void generateAiReport(id, assessment, answerMap, scores);
    res.json({ status: "generating_report", message: "Rapor oluşturma yeniden başlatıldı" });
  } catch (err) {
    req.log.error({ err }, "ai-assessment regenerate-report error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── Admin ─────────────────────────────────────────────────────────────────────
// GET /api/admin/ai-assessments
router.get("/admin/ai-assessments", requireAdmin, async (req, res) => {
  try {
    const assessments = await db.select().from(aiAssessmentsTable).orderBy(desc(aiAssessmentsTable.createdAt)).limit(100);
    res.json(assessments);
  } catch (err) {
    req.log.error({ err }, "admin ai-assessments list error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// GET /api/admin/ai-tools
router.get("/admin/ai-tools", requireAdmin, async (req, res) => {
  try {
    const tools = await db.select().from(aiToolsRegistryTable).orderBy(aiToolsRegistryTable.toolName);
    res.json(tools);
  } catch (err) {
    req.log.error({ err }, "admin ai-tools list error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// PUT /api/admin/ai-tools/:id
router.put("/admin/ai-tools/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  const { toolName, provider, category, tier, riskLevel, dataRetentionDays, trainsOnUserData,
    trainsOptoutAvailable, kvkkCompatible, dpaAvailable, riskSummary, recommendation, isActive, lastReviewed } = req.body as Record<string, unknown>;
  try {
    await db.update(aiToolsRegistryTable).set({
      ...(toolName !== undefined && { toolName: toolName as string }),
      ...(provider !== undefined && { provider: provider as string }),
      ...(category !== undefined && { category: category as string }),
      ...(tier !== undefined && { tier: tier as string }),
      ...(riskLevel !== undefined && { riskLevel: riskLevel as string }),
      ...(dataRetentionDays !== undefined && { dataRetentionDays: dataRetentionDays as number }),
      ...(trainsOnUserData !== undefined && { trainsOnUserData: trainsOnUserData as boolean }),
      ...(trainsOptoutAvailable !== undefined && { trainsOptoutAvailable: trainsOptoutAvailable as boolean }),
      ...(kvkkCompatible !== undefined && { kvkkCompatible: kvkkCompatible as boolean }),
      ...(dpaAvailable !== undefined && { dpaAvailable: dpaAvailable as boolean }),
      ...(riskSummary !== undefined && { riskSummary: riskSummary as string }),
      ...(recommendation !== undefined && { recommendation: recommendation as string }),
      ...(isActive !== undefined && { isActive: isActive as boolean }),
      ...(lastReviewed !== undefined && { lastReviewed: lastReviewed as string }),
    }).where(eq(aiToolsRegistryTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "admin ai-tool update error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── Rapor oluşturma ─────────────────────────────────────────────────────────
async function generateAiReport(
  assessmentId: number,
  assessment: import("@workspace/db").AiAssessment,
  answers: Record<number, string>,
  scores: ReturnType<typeof calculateAiScore>
) {
  // Atomically claim the generation slot — prevents duplicate jobs and recovers
  // orphaned "generating_report" runs left by server restarts mid-generation
  const claimed = await claimReportGeneration(assessmentId);
  if (!claimed) return; // another job is already running

  try {
    // Beyan edilen araçları getir
    let declaredTools: import("@workspace/db").AiToolsRegistry[] = [];
    if (assessment.declaredToolIds && Array.isArray(assessment.declaredToolIds)) {
      const toolIds = assessment.declaredToolIds as number[];
      if (toolIds.length > 0) {
        const allTools = await db.select().from(aiToolsRegistryTable).where(eq(aiToolsRegistryTable.isActive, true));
        declaredTools = allTools.filter(t => toolIds.includes(t.id));
      }
    }

    const redAlarmQuestions = AI_QUESTIONS.filter(q => q.isRedAlarm);
    const redAlarmAnswers = redAlarmQuestions.map(q => ({
      questionText: q.text,
      answer: answers[q.number] ?? "bilmiyorum",
    }));

    const toolsText = declaredTools.length > 0
      ? declaredTools.map(t => `- ${t.toolName} (${t.tier ?? "?"}) — Risk: ${t.riskLevel ?? "?"}`).join("\n")
      : "Beyan edilmedi";

    const prompt = `
Şirket: ${assessment.companyName}
Sektör: ${assessment.sector}
Çalışan Sayısı: ${assessment.employeeCount}
Toplam Skor: ${scores.percentage}% — Risk Seviyesi: ${scores.riskLevel}
Alan 1 (AI Araç Yönetimi): ${scores.area1Score} puan
Alan 2 (Veri Maruz Kalma): ${scores.area2Score} puan
Alan 3 (Araç Konfigürasyonu): ${scores.area3Score} puan
Alan 4 (KVKK Uyum): ${scores.area4Score} puan

Beyan Edilen AI Araçları:
${toolsText}

Dikkat Gerektiren Sorular:
${redAlarmAnswers.map(q => `- ${q.questionText}: ${q.answer}`).join("\n")}

Tüm Cevaplar:
${AI_QUESTIONS.map(q => `${q.number}. ${q.text}: ${answers[q.number] ?? "bilmiyorum"}`).join("\n")}

Lütfen aşağıdaki JSON formatında Türkçe rapor üret. Sadece JSON döndür, başka hiçbir şey yazma.
{
  "risk_headline": "En kritik tek cümle. KVKK veya iş etkisi odaklı.",
  "executive_summary": "3-4 cümle. Patron dili. Şirketin AI kullanım profili ve temel riskler.",
  "tool_risk_cards": [
    {
      "tool_name": "Araç adı",
      "main_risk": "Bu aracın şirkete özgü riski",
      "kvkk_implication": "KVKK açısından ne anlama geliyor",
      "immediate_action": "Bu hafta yapılacak tek şey"
    }
  ],
  "data_exposure_summary": {
    "level": "KRITIK veya YUKSEK veya ORTA veya DUSUK",
    "exposed_data_types": ["Maruz kalan veri türleri listesi"],
    "kvkk_articles": ["İlgili KVKK maddeleri"],
    "estimated_fine_tl": 0
  },
  "priority_actions": [
    {
      "action": "Yapılacak iş",
      "why": "Neden önemli",
      "how": "Nasıl yapılır",
      "effort": "kolay",
      "timeframe": "bu_hafta"
    }
  ],
  "kvkk_compliance_gap": {
    "compliant": false,
    "gaps": ["Eksik KVKK gereklilikleri"],
    "dpa_needed_for": ["DPA gereken araçlar"]
  }
}`;

    const systemPrompt = `Sen CyberStep.io'nun Yapay Zeka Güvenlik Danışmanısın. işletmeler için AI araçlarının getirdiği KVKK ve siber güvenlik risklerini analiz edersin. Teknik jargon kullanmadan, patron dilinde, somut ve uygulanabilir tavsiyeler verirsin. SADECE geçerli JSON döndür.`;

    const claudeFn = getClaudeAiFn();
    const fullPrompt = `${systemPrompt}\n\n${prompt}`;
    const reportText = await claudeFn(fullPrompt);

    // JSON parse
    let reportJson: unknown;
    try {
      const match = reportText.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("JSON bulunamadı");
      reportJson = JSON.parse(match[0]);
    } catch {
      logger.warn({ assessmentId }, "AI report JSON parse failed, storing raw text");
      reportJson = { raw: reportText, parse_error: true };
    }

    // Politika belgesi oluştur
    const policyPrompt = `${assessment.companyName} şirketi için "Yapay Zeka Araçları Kabul Edilebilir Kullanım Politikası" hazırla.

Şirkette kullanılan araçlar: ${declaredTools.map(t => t.toolName).join(", ") || "belirtilmedi"}
Sektör: ${assessment.sector}
Çalışan sayısı: ${assessment.employeeCount}

Politika şu bölümleri içermeli:
1. Amaç ve Kapsam
2. Tanımlar (yapay zeka aracı nedir, kişisel veri nedir)
3. İzin Verilen Kullanımlar
4. Yasak Kullanımlar (özellikle: kişisel veri, finansal veri, sözleşme, ses kaydı)
5. Onaylı Araçlar Listesi
6. KVKK Yükümlülükleri
7. Çalışan Sorumlulukları
8. İhlal Durumunda Prosedür
9. Politika Güncelleme Tarihi

Format: Türkçe, resmi belge formatı, imzalanmaya hazır. Anlaşılır dil, 600-800 kelime.`;

    const policyDoc = await claudeFn(
      `Sen bir KVKK uyum uzmanısın. Şirketler için açık, uygulanabilir politika belgeleri yazarsın.\n\n${policyPrompt}`
    );

    await db.update(aiAssessmentsTable).set({
      reportJson: reportJson as Record<string, unknown>,
      policyDocument: policyDoc,
      status: "report_ready",
      reportGeneratedAt: new Date(),
    }).where(eq(aiAssessmentsTable.id, assessmentId));

    logger.info({ assessmentId }, "AI assessment report generated");
  } catch (err) {
    logger.error({ err, assessmentId }, "AI assessment report generation error");
    await db.update(aiAssessmentsTable)
      .set({ status: "report_failed" })
      .where(eq(aiAssessmentsTable.id, assessmentId))
      .catch(() => null);
  }
}

export default router;
