import { Router } from "express";
import type { Request, Response } from "express";
import { randomBytes } from "node:crypto";
import { db } from "@workspace/db";
import { tprmQuestionnaireLinkTable, tprmQuestionnaireResponseTable, tprmVendorTable } from "@workspace/db";
import { eq, and, lte, isNull, or } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";
import { logger } from "../../lib/logger";
import { customersTable } from "@workspace/db";
import { requireCustomer, getCustomerId } from "../../middleware/auth";
import { domainScansTable } from "@workspace/db";
import { SCORE_V2_VERSION, scoreV2Risk, type ScoreV2Result } from "../../lib/scoring/scoreV2";
import { isScanFresh, normalizeDomain, scoreDomainV2, scoreScanV2 } from "../../lib/scoring/scoreV2Loader";

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

// ─── Yardımcı: tedarikçi skoru (Skor v2) ─────────────────────────────────────

interface SupplierScore {
  scanId: number;
  scannedAt: Date;
  score: ScoreV2Result;
}

/** lastScanData içinde saklanan biçim. */
interface StoredScanData {
  scoreVersion: string;
  scanId: number;
  score: ScoreV2Result;
}

/** Domain için yeni bir tarama çalıştırır ve Skor v2 hesaplar. */
async function scanSupplierDomain(domain: string): Promise<SupplierScore | null> {
  try {
    const { performDomainScan } = await import("../domain-scan/index");
    const result = await performDomainScan(domain);
    if (!result) return null;
    const [scan] = await db.select().from(domainScansTable).where(eq(domainScansTable.id, result.id));
    if (!scan) return null;
    return { scanId: scan.id, scannedAt: scan.createdAt, score: await scoreScanV2(scan) };
  } catch (err) {
    logger.error({ err, domain }, "TPRM supplier scan failed");
    return null;
  }
}

/**
 * Mevcut taramayı kullanır; yoksa veya bayatsa (ya da force=true ise) yeni tarama yapar.
 * CyberStep veritabanındaki taramalar sayesinde çoğu tedarikçi için anında sonuç verir.
 */
async function getSupplierScore(domain: string, opts: { force?: boolean } = {}): Promise<SupplierScore | null> {
  if (!opts.force) {
    const existing = await scoreDomainV2(domain).catch(() => null);
    if (existing && isScanFresh(existing.scan)) {
      return { scanId: existing.scan.id, scannedAt: existing.scan.createdAt, score: existing.score };
    }
  }
  return scanSupplierDomain(domain);
}

function storedScoreVersion(data: unknown): string | null {
  if (data && typeof data === "object" && "scoreVersion" in data) {
    return String((data as { scoreVersion: unknown }).scoreVersion);
  }
  return null;
}

/** Vendor satırına Skor v2 sonucunu yazar. */
async function applySupplierScore(
  vendor: { id: number; lastScanScore: number | null; lastScanData: unknown },
  result: SupplierScore,
): Promise<void> {
  const data: StoredScanData = { scoreVersion: SCORE_V2_VERSION, scanId: result.scanId, score: result.score };
  // Önceki skor v1 metodolojisiyle hesaplandıysa trend karşılaştırması anlamsızdır.
  const prevComparable = storedScoreVersion(vendor.lastScanData) === SCORE_V2_VERSION;
  await db.update(tprmVendorTable).set({
    prevScanScore: prevComparable ? vendor.lastScanScore : null,
    lastScanScore: result.score.score,
    lastScanAt: result.scannedAt,
    lastScanData: data as unknown as Record<string, unknown>,
    riskLevel: result.score.risk,
  }).where(eq(tprmVendorTable.id, vendor.id));
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
        const riskLevel = scoreV2Risk(score);
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
      riskLevel: scoreV2Risk(combinedScore ?? selfScore),
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

// ─── Oturum yardımcıları ─────────────────────────────────────────────────────
// Tedarikçi portföyü yalnızca oturum açmış müşterinin kendi kayıtlarını görür.
// customer_email kolonu korunuyor; değer artık istemciden değil oturumdan alınır.

async function getSessionCustomerEmail(req: Request): Promise<string | null> {
  const customerId = getCustomerId(req);
  if (!customerId) return null;
  const [customer] = await db.select({ email: customersTable.email })
    .from(customersTable)
    .where(eq(customersTable.id, customerId))
    .limit(1);
  return customer?.email?.trim().toLowerCase() ?? null;
}

/** Oturumdaki müşteriye ait tedarikçiyi getirir; yoksa veya başkasınınsa null. */
async function getOwnedVendor(req: Request, id: number) {
  const email = await getSessionCustomerEmail(req);
  if (!email) return null;
  const [vendor] = await db.select().from(tprmVendorTable)
    .where(and(eq(tprmVendorTable.id, id), eq(tprmVendorTable.customerEmail, email)));
  return vendor ?? null;
}

// ─── GET /api/tprm/vendors ────────────────────────────────────────────────────
// Müşterinin tedarikçi listesi

router.get("/tprm/vendors", requireCustomer, async (req: Request, res: Response) => {
  try {
    const email = await getSessionCustomerEmail(req);
    if (!email) { res.status(401).json({ error: "Giriş yapmanız gerekiyor" }); return; }
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

router.post("/tprm/vendors", requireCustomer, async (req: Request, res: Response) => {
  const { supplierDomain, supplierName } = req.body as {
    supplierDomain?: string;
    supplierName?: string;
  };

  if (!supplierDomain || typeof supplierDomain !== "string") {
    res.status(400).json({ error: "supplierDomain zorunlu" });
    return;
  }

  const domain = normalizeDomain(supplierDomain);

  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    res.status(400).json({ error: "Geçerli bir alan adı girin (örn. firma.com.tr)" });
    return;
  }

  try {
    const email = await getSessionCustomerEmail(req);
    if (!email) { res.status(401).json({ error: "Giriş yapmanız gerekiyor" }); return; }

    // Tabloda (customer_email, supplier_domain) için unique index yok;
    // mükerrer kaydı uygulama tarafında engelle.
    const [existing] = await db.select().from(tprmVendorTable)
      .where(and(eq(tprmVendorTable.customerEmail, email), eq(tprmVendorTable.supplierDomain, domain)));
    if (existing) {
      res.json(existing);
      return;
    }

    const [inserted] = await db.insert(tprmVendorTable).values({
      customerEmail: email,
      supplierDomain: domain,
      supplierName: typeof supplierName === "string" && supplierName.trim() ? supplierName.trim() : null,
    }).returning();
    let vendor = inserted!;

    // Anlık skor: CyberStep veritabanında bu domain için tarama varsa hemen kullan.
    const prior = await scoreDomainV2(domain).catch(() => null);
    if (prior) {
      await applySupplierScore(vendor, { scanId: prior.scan.id, scannedAt: prior.scan.createdAt, score: prior.score });
      const [refreshed] = await db.select().from(tprmVendorTable).where(eq(tprmVendorTable.id, vendor.id));
      if (refreshed) vendor = refreshed;
    }

    // Tarama yoksa veya bayatsa arka planda yeni tarama başlat.
    if (!prior || !isScanFresh(prior.scan)) {
      const vendorId = vendor.id;
      setImmediate(async () => {
        try {
          const result = await scanSupplierDomain(domain);
          if (!result) return;
          const [current] = await db.select().from(tprmVendorTable).where(eq(tprmVendorTable.id, vendorId));
          if (current) await applySupplierScore(current, result);
        } catch (err) {
          logger.error({ err, domain }, "Initial vendor scan error");
        }
      });
    }

    res.status(201).json({ ...vendor, instantScore: !!prior, scanPending: !prior || !isScanFresh(prior.scan) });
  } catch (err) {
    logger.error({ err }, "TPRM vendor add error");
    res.status(500).json({ error: "Tedarikçi eklenemedi" });
  }
});

// ─── DELETE /api/tprm/vendors/:id ─────────────────────────────────────────────

router.delete("/tprm/vendors/:id", requireCustomer, async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  if (!id) { res.status(400).json({ error: "Geçersiz id" }); return; }
  try {
    const vendor = await getOwnedVendor(req, id);
    if (!vendor) { res.status(404).json({ error: "Bulunamadı" }); return; }
    await db.delete(tprmVendorTable).where(eq(tprmVendorTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "TPRM vendor delete error");
    res.status(500).json({ error: "Silinemedi" });
  }
});

// ─── POST /api/tprm/vendors/:id/rescan ────────────────────────────────────────
// Manuel yeniden tarama

router.post("/tprm/vendors/:id/rescan", requireCustomer, async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  if (!id) { res.status(400).json({ error: "Geçersiz id" }); return; }

  try {
    const vendor = await getOwnedVendor(req, id);
    if (!vendor) { res.status(404).json({ error: "Bulunamadı" }); return; }

    res.json({ ok: true, message: "Tarama başlatıldı" });

    setImmediate(async () => {
      try {
        const result = await getSupplierScore(vendor.supplierDomain, { force: true });
        if (result) await applySupplierScore(vendor, result);
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

router.post("/tprm/vendors/:id/send-questionnaire", requireCustomer, async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  const { companyName, companySector } = req.body as { companyName?: string; companySector?: string };

  if (!id || !companyName || !companySector) {
    res.status(400).json({ error: "id, companyName ve companySector zorunlu" });
    return;
  }

  try {
    const vendor = await getOwnedVendor(req, id);
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
      // Keşif hattı bu domaini son 7 günde taradıysa yeniden taramaya gerek yok.
      const result = await getSupplierScore(vendor.supplierDomain);
      if (!result) continue;

      const score = result.score.score;
      const riskLevel = result.score.risk;
      // Uyarı yalnızca iki Skor v2 sonucu karşılaştırılabiliyorsa gönderilir
      // (v1 → v2 geçişindeki metodoloji farkı sahte "skor düştü" uyarısı üretmesin).
      const prevComparable = storedScoreVersion(vendor.lastScanData) === SCORE_V2_VERSION;
      const prevScore = prevComparable ? vendor.lastScanScore : null;
      const scoreDrop = prevScore !== null ? prevScore - score : null;

      await applySupplierScore(vendor, result);

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
      if ((riskLevel === "Yüksek" || riskLevel === "Kritik") && !vendor.crosssellSentAt && vendor.questionnaireStatus === "completed") {
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
