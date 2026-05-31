import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { euAiactAssessmentsTable, questionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { getClaudeAiFn } from "../../services/ai-client";

const router = Router();
const claudeFn = getClaudeAiFn();

function sess(req: Request) { return req.session as unknown as Record<string, unknown>; }
function addToSession(req: Request, id: number) {
  const s = sess(req);
  const existing = (s["ownedEuAiactIds"] as number[] | undefined) ?? [];
  s["ownedEuAiactIds"] = [...new Set([...existing, id])];
}
function requireOwner(req: Request, res: Response, next: import("express").NextFunction): void {
  const adminId = sess(req)["adminId"] as number | undefined;
  if (adminId) { next(); return; }
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  const owned = (sess(req)["ownedEuAiactIds"] as number[] | undefined) ?? [];
  if (!owned.includes(id)) { res.status(403).json({ error: "Erişim izni yok" }); return; }
  next();
}

// ─── Seed questions once ───────────────────────────────────────────────────────

async function seedEuAiActQuestions() {
  const existing = await db.select({ id: questionsTable.id }).from(questionsTable)
    .where(eq(questionsTable.type, "eu_aiact")).limit(1);
  if (existing.length > 0) return;

  const questions = [
    { number: 1, domain: "EUA0", areaLabel: "Kapsam Belirleme", text: "Şirketiniz AB ülkelerindeki müşterilere ürün veya hizmet satıyor mu?", helpText: "AB Yapay Zeka Yasası, AB pazarına sunum yapan TÜM şirketleri kapsıyor — AB'de kayıtlı olmanız gerekmiyor.", weight: 3, isRedAlarm: true, sortOrder: 1 },
    { number: 2, domain: "EUA0", areaLabel: "Kapsam Belirleme", text: "Şirketinizin sunduğu ürün veya hizmetlerde yapay zeka teknolojisi kullanılıyor mu?", helpText: "Öneri sistemi, chatbot, görüntü analizi, doğal dil işleme gibi herhangi bir AI bileşeni var mı?", weight: 3, isRedAlarm: true, sortOrder: 2 },
    { number: 3, domain: "EUA0", areaLabel: "Kapsam Belirleme", text: "Şirketiniz başka firmalara yapay zeka sistemi veya AI bileşeni satıyor ya da kiralıyor mu?", helpText: "AI sağlayıcısı (provider) veya konuşlandırıcısı (deployer) rolünde misiniz?", weight: 3, isRedAlarm: true, sortOrder: 3 },
    { number: 4, domain: "EUA1", areaLabel: "Yasaklı AI Uygulamaları", text: "Şirketiniz insanların davranışını manipüle etmek için bilinçaltı teknikler kullanan AI sistemi kullanıyor mu?", helpText: "Kullanıcının farkında olmadan kararlarını etkileyen gizli AI manipülasyonu AB AI Yasası'nda kesinlikle yasak.", weight: 3, isRedAlarm: true, sortOrder: 4 },
    { number: 5, domain: "EUA1", areaLabel: "Yasaklı AI Uygulamaları", text: "Gerçek zamanlı biyometrik tanıma sistemi (yüz, parmak izi, ses) kamuya açık alanlarda kullanılıyor mu?", helpText: "Kamuya açık alanda gerçek zamanlı biyometrik kitlesel gözetim AB AI Yasası'nda yasaklanmıştır.", weight: 3, isRedAlarm: true, sortOrder: 5 },
    { number: 6, domain: "EUA1", areaLabel: "Yasaklı AI Uygulamaları", text: "Sosyal kredi puanlama veya kişileri genel davranışlarına göre sıralayan AI sistemi kullanılıyor mu?", helpText: "Sosyal skorlama sistemleri AB AI Yasası'nda kesinlikle yasaklı kategoride.", weight: 3, isRedAlarm: true, sortOrder: 6 },
    { number: 7, domain: "EUA1", areaLabel: "Yasaklı AI Uygulamaları", text: "İşe alım sürecinde adayları otomatik olarak reddeden veya sıralayan AI sistemi aktif mi?", helpText: "İşe alım kararlarını etkileyen AI sistemleri yüksek riskli kategoride. Özel gereklilikler uygulanır.", weight: 2, isRedAlarm: true, sortOrder: 7 },
    { number: 8, domain: "EUA2", areaLabel: "Yüksek Riskli AI Sistemleri", text: "Kredi skoru, sigorta fiyatlandırması veya finansal ürün erişimini belirleyen AI kullanılıyor mu?", helpText: "Finansal kararları etkileyen AI sistemleri yüksek riskli. Özel teknik dokümantasyon, test ve insan denetimi zorunlu.", weight: 2, isRedAlarm: true, sortOrder: 8 },
    { number: 9, domain: "EUA2", areaLabel: "Yüksek Riskli AI Sistemleri", text: "Sağlık teşhisi, tedavi önerisi veya tıbbi cihaz kontrolü için AI kullanılıyor mu?", helpText: "Sağlık AI sistemleri en katı yüksek riskli kategoride. AB onayı ve sürekli izleme zorunlu.", weight: 2, isRedAlarm: true, sortOrder: 9 },
    { number: 10, domain: "EUA2", areaLabel: "Yüksek Riskli AI Sistemleri", text: "Eğitim alanında öğrenci değerlendirmesi veya erişim kararları için AI kullanılıyor mu?", helpText: "Eğitim fırsatlarını etkileyen AI yüksek riskli. Şeffaflık ve insan denetimi gereklidir.", weight: 2, isRedAlarm: false, sortOrder: 10 },
    { number: 11, domain: "EUA2", areaLabel: "Yüksek Riskli AI Sistemleri", text: "Müşteri şikayetlerini veya hizmet taleplerini tamamen otomatik olarak sonuçlandıran AI var mı?", helpText: "Kişilerin haklarını etkileyen tamamen otomatik kararlar için itiraz hakkı sağlanmalı.", weight: 1, isRedAlarm: false, sortOrder: 11 },
    { number: 12, domain: "EUA2", areaLabel: "Yüksek Riskli AI Sistemleri", text: "Kritik altyapı (enerji, su, ulaşım) yönetimi veya güvenlik için AI sistemi kullanılıyor mu?", helpText: "Kritik altyapı AI sistemleri en yüksek risk kategorisinde ve özel onay gerektiriyor.", weight: 2, isRedAlarm: true, sortOrder: 12 },
    { number: 13, domain: "EUA3", areaLabel: "Şeffaflık ve Dokümantasyon", text: "Müşterilerinize veya kullanıcılarınıza yapay zeka ile etkileşimde olduklarını bildiriyor musunuz?", helpText: "Chatbot, öneri sistemi gibi AI sistemlerde kullanıcı bilgilendirmesi AB AI Yasası gereği.", weight: 2, isRedAlarm: false, sortOrder: 13 },
    { number: 14, domain: "EUA3", areaLabel: "Şeffaflık ve Dokümantasyon", text: "Kullandığınız AI sistemleri için teknik dokümantasyon hazırlandı mı?", helpText: "Yüksek riskli sistemler için: teknik özellikler, eğitim verisi, test sonuçları belgelenmeli.", weight: 1, isRedAlarm: false, sortOrder: 14 },
    { number: 15, domain: "EUA3", areaLabel: "Şeffaflık ve Dokümantasyon", text: "AI destekli kararlardan etkilenen kişiler bu kararları sorgulama veya itiraz hakkına sahip mi?", helpText: "AB AI Yasası insanlara AI kararlarına karşı anlamlı bir itiraz hakkı tanıma zorunluluğu getiriyor.", weight: 2, isRedAlarm: false, sortOrder: 15 },
    { number: 16, domain: "EUA3", areaLabel: "Şeffaflık ve Dokümantasyon", text: "Deepfake veya AI ile oluşturulmuş içerik üretiyorsanız bunlar açıkça işaretleniyor mu?", helpText: "AI ile oluşturulmuş görsel, ses veya metin içeriği AB AI Yasası'na göre açıkça etiketlenmeli.", weight: 1, isRedAlarm: false, sortOrder: 16 },
    { number: 17, domain: "EUA4", areaLabel: "Uyum Hazırlığı", text: "Şirketinizde AB AI Yasası uyumundan sorumlu atanmış bir kişi veya ekip var mı?", helpText: "Yüksek riskli AI sistemleri için uyum sorumlusu atanması öneriliyor.", weight: 1, isRedAlarm: false, sortOrder: 17 },
    { number: 18, domain: "EUA4", areaLabel: "Uyum Hazırlığı", text: "Kullandığınız AI sistemlerinin AB AI Yasası kapsamında hangi kategoride olduğu değerlendirildi mi?", helpText: "Kendi AI risk kategorizasyonunuzu yapmak uyum sürecinin ilk adımı.", weight: 2, isRedAlarm: false, sortOrder: 18 },
    { number: 19, domain: "EUA4", areaLabel: "Uyum Hazırlığı", text: "AB AI Yasası yükümlülükleri için bir uyum takvimi veya yol haritası hazırlandı mı?", helpText: "Yüksek riskli sistemler için 2026 yılı sonuna kadar uyum zorunlu.", weight: 1, isRedAlarm: false, sortOrder: 19 },
    { number: 20, domain: "EUA4", areaLabel: "Uyum Hazırlığı", text: "Üçüncü taraflardan satın alınan AI sistemlerin AB AI Yasası uyumluluğu tedarikçiden teyit edildi mi?", helpText: "AI sağlayıcınızın CE işareti veya uyum belgesi sunması gerekebilir.", weight: 1, isRedAlarm: false, sortOrder: 20 },
  ];

  await db.insert(questionsTable).values(
    questions.map(q => ({ ...q, type: "eu_aiact", isActive: true }))
  );
  logger.info("EU AI Act questions seeded");
}

seedEuAiActQuestions().catch(e => logger.error({ err: e }, "EU AI Act seed error"));

// ─── GET /api/eu-aiact/questions ──────────────────────────────────────────────

router.get("/api/eu-aiact/questions", async (req: Request, res: Response): Promise<void> => {
  const questions = await db.select().from(questionsTable)
    .where(and(eq(questionsTable.type, "eu_aiact"), eq(questionsTable.isActive, true)))
    .orderBy(questionsTable.sortOrder);
  res.json({ questions });
});

// ─── POST /api/eu-aiact/start ─────────────────────────────────────────────────

router.post("/api/eu-aiact/start", async (req: Request, res: Response): Promise<void> => {
  const { companyName, contactEmail, sector, employeeCount } = req.body as {
    companyName: string; contactEmail?: string; sector?: string; employeeCount?: string;
  };
  if (!companyName) { res.status(400).json({ error: "Şirket adı zorunlu" }); return; }

  const [row] = await db.insert(euAiactAssessmentsTable).values({
    companyName, contactEmail, sector, employeeCount,
    status: "in_progress",
  }).returning({ id: euAiactAssessmentsTable.id });

  addToSession(req, row.id);
  res.json({ id: row.id });
});

// ─── POST /api/eu-aiact/:id/complete ─────────────────────────────────────────

interface AnswerItem { questionId: number; domain: string; questionText: string; answer: string; }

function scoreAnswers(answers: AnswerItem[], questions: typeof questionsTable.$inferSelect[]) {
  const qMap = new Map(questions.map(q => [q.id, q]));
  let rawScore = 0;
  let maxScore = 0;

  for (const a of answers) {
    const q = qMap.get(a.questionId);
    if (!q) continue;
    const w = q.weight ?? 1;
    maxScore += 5 * w;

    const pts = a.answer === "evet" ? 5 : a.answer === "kısmen" ? 3 : a.answer === "hayır" ? 0 : 1;
    rawScore += pts * w;
  }

  return { rawScore, maxScore, percentage: maxScore > 0 ? Math.round((rawScore / maxScore) * 100) : 0 };
}

function categorize(answers: AnswerItem[], percentage: number) {
  const prohibited = answers.filter(a => a.domain === "EUA1" && a.answer === "evet");
  if (prohibited.length > 0) return { category: "unacceptable", label: "Yasak Uygulama Tespit Edildi", color: "#FF1744" };

  const inScope = answers.filter(a => a.domain === "EUA0").some(a => a.answer === "evet");
  if (!inScope) return { category: "not_applicable", label: "Kapsam Dışı", color: "#00E096" };

  const highRisk = answers.filter(a => a.domain === "EUA2" && a.answer === "evet");
  if (highRisk.length >= 2) return { category: "high_risk", label: "Yüksek Riskli Sistem", color: "#FF4560" };
  if (percentage >= 60) return { category: "limited_risk", label: "Sınırlı Risk", color: "#FFB020" };
  return { category: "minimal_risk", label: "Minimum Risk", color: "#00E096" };
}

router.post("/api/eu-aiact/:id/complete", requireOwner, async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params["id"]);
  const { answers } = req.body as { answers: AnswerItem[] };
  if (!answers?.length) { res.status(400).json({ error: "Cevaplar zorunlu" }); return; }

  const questions = await db.select().from(questionsTable)
    .where(eq(questionsTable.type, "eu_aiact"));

  const { rawScore, maxScore, percentage } = scoreAnswers(answers, questions);
  const { category } = categorize(answers, percentage);

  await db.update(euAiactAssessmentsTable)
    .set({ answersJson: answers, rawScore, maxScore, percentage, riskCategory: category, status: "generating" })
    .where(eq(euAiactAssessmentsTable.id, id));

  res.json({ id, status: "generating" });

  // Fire-and-forget report generation
  generateReport(id, answers, category, percentage).catch(e => logger.error({ id, err: e }, "EU AI Act report error"));
});

async function generateReport(id: number, answers: AnswerItem[], category: string, percentage: number) {
  const row = await db.select().from(euAiactAssessmentsTable)
    .where(eq(euAiactAssessmentsTable.id, id)).limit(1);
  if (!row[0]) return;
  const { companyName, sector } = row[0];

  const prompt = `
Sen AB Yapay Zeka Yasası (EU AI Act) konusunda uzman bir uyum danışmanısın.
Türkçe, teknik olmayan dil kullanarak rapor hazırla.

ŞİRKET: ${companyName}
SEKTÖR: ${sector ?? "Belirtilmedi"}
RİSK KATEGORİSİ: ${category}
SKOR: ${percentage}%

CEVAPLANAN SORULAR:
${answers.map(a => `[${a.domain}] ${a.questionText}: ${a.answer}`).join("\n")}

JSON FORMATINDA ÜRETİN:
{
  "risk_category": "${category}",
  "executive_summary": "3-4 cümle. AB AI Yasası kapsamında şirketin durumu. Patron dili.",
  "applicable_articles": [
    {
      "article": "Madde 5",
      "title": "Yasaklı AI Uygulamaları",
      "applies": true,
      "explanation": "Bu maddenin şirkete etkisi (1 cümle)"
    }
  ],
  "obligations": [
    {
      "obligation": "Yükümlülük başlığı",
      "deadline": "2026 | 2027 | Mevcut",
      "effort": "kolay | orta | zor",
      "description": "Ne yapılması gerekiyor (patron dili)",
      "penalty": "Uyumsuzluk cezası"
    }
  ],
  "prohibited_alert": null,
  "kvkk_overlap": "KVKK ile örtüşen gereklilikler",
  "priority_actions": [
    { "action": "...", "timeframe": "...", "why": "..." }
  ],
  "penalty_exposure": {
    "max_fine_eur": 0,
    "max_fine_tl_approx": 0,
    "basis": "Hangi madde kapsamında hesaplandı"
  }
}

Sadece JSON döndür.`;

  try {
    const raw = await claudeFn(prompt);
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const reportJson = JSON.parse(cleaned);
    await db.update(euAiactAssessmentsTable)
      .set({ reportJson, status: "completed", completedAt: new Date() })
      .where(eq(euAiactAssessmentsTable.id, id));
  } catch (e) {
    logger.error({ id, err: e }, "EU AI Act report generation failed");
    await db.update(euAiactAssessmentsTable)
      .set({ status: "error" }).where(eq(euAiactAssessmentsTable.id, id));
  }
}

// ─── GET /api/eu-aiact/:id/report ────────────────────────────────────────────

router.get("/api/eu-aiact/:id/report", requireOwner, async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params["id"]);
  const rows = await db.select().from(euAiactAssessmentsTable)
    .where(eq(euAiactAssessmentsTable.id, id)).limit(1);
  if (!rows[0]) { res.status(404).json({ error: "Bulunamadı" }); return; }
  const row = rows[0];
  res.json({
    id: row.id,
    status: row.status,
    companyName: row.companyName,
    percentage: row.percentage,
    riskCategory: row.riskCategory,
    report: row.reportJson,
  });
});

export default router;
