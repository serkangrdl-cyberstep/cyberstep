import { Router } from "express";
import type { Request, Response } from "express";
import { randomBytes } from "node:crypto";
import { db } from "@workspace/db";
import { tprmQuestionnaireLinkTable, tprmQuestionnaireResponseTable, tprmVendorTable } from "@workspace/db";
import { eq, and, lte, isNull, or } from "drizzle-orm";
import { sql } from "drizzle-orm";
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

// ─── Yardımcı: tedarikçi domain taraması ─────────────────────────────────────

async function scanSupplierDomain(domain: string): Promise<number | null> {
  try {
    const { performDomainScan } = await import("../domain-scan/index");
    const result = await performDomainScan(domain);
    if (!result) return null;
    return result.overallScore;
  } catch {
    return null;
  }
}

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

    // Vendor kaydı varsa güncelle
    setImmediate(async () => {
      try {
        const score = combinedScore ?? selfScore;
        const riskLevel = score >= 70 ? "Düşük" : score >= 40 ? "Orta" : "Yüksek";
        await db.update(tprmVendorTable)
          .set({
            questionnaireStatus: "completed",
            combinedScore: score,
            riskLevel,
          })
          .where(eq(tprmVendorTable.questionnaireToken, token));
      } catch { /* ignore */ }
    });

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

// ═══════════════════════════════════════════════════════════════════════════════
// VENDOR PORTFOLIO — kalıcı tedarikçi takibi
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET /api/tprm/vendors ────────────────────────────────────────────────────
// Müşterinin tedarikçi listesi

router.get("/tprm/vendors", async (req: Request, res: Response) => {
  const email = (req.query["email"] as string ?? "").trim().toLowerCase();
  if (!email) {
    res.status(400).json({ error: "email parametresi zorunlu" });
    return;
  }
  try {
    const rows = await db.select().from(tprmVendorTable)
      .where(eq(tprmVendorTable.customerEmail, email))
      .orderBy(tprmVendorTable.addedAt);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "TPRM vendors list error");
    res.status(500).json({ error: "Liste yüklenemedi" });
  }
});

// ─── POST /api/tprm/vendors ───────────────────────────────────────────────────
// Tedarikçi ekle + ilk taramayı background'da başlat

router.post("/tprm/vendors", async (req: Request, res: Response) => {
  const { customerEmail, supplierDomain, supplierName } = req.body as {
    customerEmail?: string;
    supplierDomain?: string;
    supplierName?: string;
  };

  if (!customerEmail || !supplierDomain) {
    res.status(400).json({ error: "customerEmail ve supplierDomain zorunlu" });
    return;
  }

  const email = customerEmail.trim().toLowerCase();
  const domain = supplierDomain.trim().toLowerCase().replace(/^https?:\/\//, "");

  try {
    const [vendor] = await db.insert(tprmVendorTable).values({
      customerEmail: email,
      supplierDomain: domain,
      supplierName: supplierName?.trim() ?? null,
    })
    .onConflictDoNothing()
    .returning();

    if (!vendor) {
      const [existing] = await db.select().from(tprmVendorTable)
        .where(and(eq(tprmVendorTable.customerEmail, email), eq(tprmVendorTable.supplierDomain, domain)));
      res.json(existing);
      return;
    }

    // Arka planda ilk taramayı başlat
    setImmediate(async () => {
      try {
        const score = await scanSupplierDomain(domain);
        if (score !== null) {
          const riskLevel = score >= 70 ? "Düşük" : score >= 40 ? "Orta" : "Yüksek";
          await db.update(tprmVendorTable)
            .set({ lastScanScore: score, lastScanAt: new Date(), riskLevel })
            .where(eq(tprmVendorTable.id, vendor.id));
        }
      } catch (err) {
        logger.error({ err, domain }, "Initial vendor scan error");
      }
    });

    res.status(201).json(vendor);
  } catch (err) {
    logger.error({ err }, "TPRM vendor add error");
    res.status(500).json({ error: "Tedarikçi eklenemedi" });
  }
});

// ─── DELETE /api/tprm/vendors/:id ─────────────────────────────────────────────

router.delete("/tprm/vendors/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  if (!id) { res.status(400).json({ error: "Geçersiz id" }); return; }
  try {
    await db.delete(tprmVendorTable).where(eq(tprmVendorTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "TPRM vendor delete error");
    res.status(500).json({ error: "Silinemedi" });
  }
});

// ─── POST /api/tprm/vendors/:id/rescan ────────────────────────────────────────
// Manuel yeniden tarama

router.post("/tprm/vendors/:id/rescan", async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  if (!id) { res.status(400).json({ error: "Geçersiz id" }); return; }

  try {
    const [vendor] = await db.select().from(tprmVendorTable).where(eq(tprmVendorTable.id, id));
    if (!vendor) { res.status(404).json({ error: "Bulunamadı" }); return; }

    res.json({ ok: true, message: "Tarama başlatıldı" });

    setImmediate(async () => {
      try {
        const score = await scanSupplierDomain(vendor.supplierDomain);
        if (score !== null) {
          const riskLevel = score >= 70 ? "Düşük" : score >= 40 ? "Orta" : "Yüksek";
          await db.update(tprmVendorTable).set({
            prevScanScore: vendor.lastScanScore,
            lastScanScore: score,
            lastScanAt: new Date(),
            riskLevel,
          }).where(eq(tprmVendorTable.id, id));
        }
      } catch (err) {
        logger.error({ err }, "TPRM vendor rescan error");
      }
    });
  } catch (err) {
    logger.error({ err }, "TPRM vendor rescan route error");
    res.status(500).json({ error: "Yeniden tarama başlatılamadı" });
  }
});

// ─── POST /api/tprm/vendors/:id/send-questionnaire ────────────────────────────
// Tedarikçiye anket linki oluştur ve kaydet

router.post("/tprm/vendors/:id/send-questionnaire", async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  const { companyName, companySector } = req.body as { companyName?: string; companySector?: string };

  if (!id || !companyName || !companySector) {
    res.status(400).json({ error: "id, companyName ve companySector zorunlu" });
    return;
  }

  try {
    const [vendor] = await db.select().from(tprmVendorTable).where(eq(tprmVendorTable.id, id));
    if (!vendor) { res.status(404).json({ error: "Bulunamadı" }); return; }

    const token = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await db.insert(tprmQuestionnaireLinkTable).values({
      companyName,
      companySector,
      supplierDomain: vendor.supplierDomain,
      supplierName: vendor.supplierName ?? null,
      token,
      scanScore: vendor.lastScanScore ?? null,
      expiresAt,
    });

    await db.update(tprmVendorTable).set({
      questionnaireStatus: "pending",
      questionnaireToken: token,
    }).where(eq(tprmVendorTable.id, id));

    const baseUrl = (process.env["REPLIT_DOMAINS"] ?? "").split(",")[0]?.trim();
    const link = baseUrl ? `https://${baseUrl}/tprm/anket/${token}` : `/tprm/anket/${token}`;

    res.json({ token, link, expiresAt: expiresAt.toISOString() });
  } catch (err) {
    logger.error({ err }, "TPRM send questionnaire error");
    res.status(500).json({ error: "Anket linki oluşturulamadı" });
  }
});

// ─── Cron yardımcısı: gece tedarikçi yeniden tarama + uyarı ──────────────────

export async function runVendorRescanCron(): Promise<void> {
  logger.info("TPRM vendor nightly rescan started");

  // Son 7 günde taranmamış veya hiç taranmamış aktif tedarikçiler
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const vendors = await db.select().from(tprmVendorTable)
    .where(
      and(
        eq(tprmVendorTable.monitoringActive, true),
        or(
          isNull(tprmVendorTable.lastScanAt),
          lte(tprmVendorTable.lastScanAt, sevenDaysAgo),
        )
      )
    );

  logger.info({ count: vendors.length }, "TPRM vendors to rescan");

  const { sendMail } = await import("../../services/email");

  for (const vendor of vendors) {
    try {
      const score = await scanSupplierDomain(vendor.supplierDomain);
      if (score === null) continue;

      const riskLevel = score >= 70 ? "Düşük" : score >= 40 ? "Orta" : "Yüksek";
      const prevScore = vendor.lastScanScore;
      const scoreDrop = prevScore !== null ? prevScore - score : null;

      await db.update(tprmVendorTable).set({
        prevScanScore: vendor.lastScanScore,
        lastScanScore: score,
        lastScanAt: new Date(),
        riskLevel,
      }).where(eq(tprmVendorTable.id, vendor.id));

      // Skor 15+ puan düştüyse müşteriye uyarı e-postası gönder
      if (scoreDrop !== null && scoreDrop >= 15) {
        const alreadyAlerted = vendor.alertSentAt
          && (Date.now() - vendor.alertSentAt.getTime()) < 7 * 24 * 60 * 60 * 1000;
        if (!alreadyAlerted) {
          await sendMail({
            to: vendor.customerEmail,
            subject: `Tedarikçi Uyarisi: ${vendor.supplierDomain} skoru dûstü`,
            html: `<p>Merhaba,</p>
<p><strong>${vendor.supplierDomain}</strong> adlı tedarikçinizin siber güvenlik skoru son taramada önemli ölçüde düştü.</p>
<ul>
  <li>Önceki skor: <strong>${prevScore}/100</strong></li>
  <li>Güncel skor: <strong>${score}/100</strong></li>
  <li>Risk seviyesi: <strong>${riskLevel}</strong></li>
</ul>
<p>Tedarikçi portföyünüzü incelemek için <a href="https://${(process.env["REPLIT_DOMAINS"] ?? "").split(",")[0]?.trim()}/hesabim/tedarikci-portfoyu">CyberStep paneline giriş yapın</a>.</p>`,
          });
          await db.update(tprmVendorTable)
            .set({ alertSentAt: new Date() })
            .where(eq(tprmVendorTable.id, vendor.id));
          logger.info({ domain: vendor.supplierDomain, scoreDrop }, "TPRM alert email sent");
        }
      }

      // Yüksek riskli ve henüz cross-sell e-postası gönderilmemişse tedarikçiye gönder
      if (riskLevel === "Yüksek" && !vendor.crosssellSentAt && vendor.questionnaireStatus === "completed") {
        // Anket yanıtından tedarikçi e-posta adresini bul
        const link = vendor.questionnaireToken
          ? (await db.select().from(tprmQuestionnaireLinkTable)
              .where(eq(tprmQuestionnaireLinkTable.token, vendor.questionnaireToken)))[0]
          : null;
        if (link) {
          const response = (await db.select().from(tprmQuestionnaireResponseTable)
            .where(eq(tprmQuestionnaireResponseTable.linkId, link.id)))[0];
          if (response?.supplierContactEmail) {
            await sendMail({
              to: response.supplierContactEmail,
              subject: "Siber Güvenlik Skorunuzu Güçlendirin",
              html: `<p>Merhaba ${response.supplierContactName},</p>
<p>Son güvenlik değerlendirmenizde <strong>${vendor.supplierDomain}</strong> için <strong>Yüksek Risk</strong> skoru tespit edildi (${score}/100).</p>
<p>CyberStep platformu ile güvenlik açıklarınızı kapatabilir, tedarikçi değerlendirmelerinde daha yüksek skor elde edebilirsiniz.</p>
<p><a href="https://${(process.env["REPLIT_DOMAINS"] ?? "").split(",")[0]?.trim()}">CyberStep'i ücretsiz deneyin</a></p>`,
            });
            await db.update(tprmVendorTable)
              .set({ crosssellSentAt: new Date() })
              .where(eq(tprmVendorTable.id, vendor.id));
            logger.info({ domain: vendor.supplierDomain }, "TPRM crosssell email sent");
          }
        }
      }
    } catch (err) {
      logger.error({ err, domain: vendor.supplierDomain }, "TPRM nightly vendor scan error");
    }
  }

  logger.info("TPRM vendor nightly rescan complete");
}

export default router;
