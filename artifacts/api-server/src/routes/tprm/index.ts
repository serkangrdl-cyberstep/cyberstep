import { isInternalHostname } from "../../lib/hostGuard";
import { Router } from "express";
import type { Request, Response } from "express";
import { randomBytes } from "node:crypto";
import { db } from "@workspace/db";
import { tprmQuestionnaireLinkTable, tprmQuestionnaireResponseTable, tprmVendorTable } from "@workspace/db";
import { eq, and, lte, isNull, or, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";
import { logger } from "../../lib/logger";
import { customersTable } from "@workspace/db";
import { requireCustomer, getCustomerId } from "../../middleware/auth";
import { domainScansTable } from "@workspace/db";
import { SCORE_V2_VERSION, scoreV2Risk, type ScoreV2Result } from "../../lib/scoring/scoreV2";
import { isScanFresh, normalizeDomain, scoreDomainV2, scoreDomainsV2, scoreScanV2 } from "../../lib/scoring/scoreV2Loader";
import { enqueueScan, scanQueueStats } from "../../services/tprmScanQueue";
import { describeReason, detectVendorAlert, shouldSendAlert, type AlertReason } from "../../lib/scoring/vendorAlerts";
import { canonicalSector } from "../../lib/scoring/sectors";
import { peekBenchmarkSnapshot, percentileInSector } from "../../services/sectorBenchmark";

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
  // Domain çözümlenemediyse skor gösterilmez; panel "veri yetersiz" der.
  const insufficient = result.score.insufficientData;
  await db.update(tprmVendorTable).set({
    prevScanScore: prevComparable && !insufficient ? vendor.lastScanScore : null,
    lastScanScore: insufficient ? null : result.score.score,
    lastScanAt: result.scannedAt,
    lastScanData: data as unknown as Record<string, unknown>,
    riskLevel: insufficient ? null : result.score.risk,
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

// ─── Paket limitleri ─────────────────────────────────────────────────────────
// Fiyat sayfasıyla (cyberstep/src/pages/pricing.tsx) aynı tutulmalı.
// Paket, admin panelinden müşteriye subscription_plan + status=active olarak atanır.
export const TPRM_PLAN_LIMITS: Record<string, number> = {
  tprm_baslangic: 25,
  tprm_profesyonel: 100,
  tprm_kurumsal: Number.POSITIVE_INFINITY,
};
const TPRM_FREE_LIMIT = Number(process.env["TPRM_FREE_VENDOR_LIMIT"] ?? 5);
// Eski ücretli paketlerdeki (starter/pro/enterprise) aktif müşteriler kesintiye uğramasın
const LEGACY_PAID_LIMIT = TPRM_PLAN_LIMITS["tprm_baslangic"]!;

async function getVendorLimit(req: Request): Promise<{ limit: number; plan: string | null }> {
  const customerId = getCustomerId(req);
  if (!customerId) return { limit: 0, plan: null };
  const [c] = await db.select({ plan: customersTable.subscriptionPlan, status: customersTable.subscriptionStatus })
    .from(customersTable).where(eq(customersTable.id, customerId)).limit(1);
  const active = c?.status === "active" || c?.status === "trial";
  const plan = c?.plan ?? null;
  if (active && plan && TPRM_PLAN_LIMITS[plan] !== undefined) return { limit: TPRM_PLAN_LIMITS[plan]!, plan };
  if (active && plan && plan !== "free") return { limit: LEGACY_PAID_LIMIT, plan };
  return { limit: TPRM_FREE_LIMIT, plan: null };
}

async function countVendors(email: string): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(tprmVendorTable)
    .where(eq(tprmVendorTable.customerEmail, email));
  return row?.n ?? 0;
}

/** Oturumdaki müşteriye ait tedarikçiyi getirir; yoksa veya başkasınınsa null. */
async function getOwnedVendor(req: Request, id: number) {
  const email = await getSessionCustomerEmail(req);
  if (!email) return null;
  const [vendor] = await db.select().from(tprmVendorTable)
    .where(and(eq(tprmVendorTable.id, id), eq(tprmVendorTable.customerEmail, email)));
  return vendor ?? null;
}

// ─── Sektör bağlamı ──────────────────────────────────────────────────────────
// Her tedarikçiye sektörünü, sektör medyanını ve sektör içindeki yüzdelik dilimini ekler.
// Benchmark henüz önbellekte yoksa alanlar null döner (istek bekletilmez).

type VendorRow = typeof tprmVendorTable.$inferSelect;

const CRITICALITY_LEVELS = ["kritik", "onemli", "standart"] as const;
function parseCriticality(v: unknown): (typeof CRITICALITY_LEVELS)[number] {
  return typeof v === "string" && (CRITICALITY_LEVELS as readonly string[]).includes(v)
    ? (v as (typeof CRITICALITY_LEVELS)[number])
    : "standart";
}

async function loadVendorSectors(domains: string[]): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (domains.length === 0) return map;
  const result = await db.execute(sql`
    SELECT d.domain,
      COALESCE(
        NULLIF(lc.sector, ''),
        (SELECT NULLIF(ds.sector, '') FROM domain_scans ds WHERE ds.domain = d.domain ORDER BY ds.created_at DESC LIMIT 1)
      ) AS sector
    FROM unnest(ARRAY[${sql.join(domains.map(d => sql`${d}`), sql`, `)}]::text[]) AS d(domain)
    LEFT JOIN lead_candidates lc ON lc.domain = d.domain
  `);
  for (const r of result.rows as Array<{ domain: string; sector: string | null }>) map.set(r.domain, r.sector);
  return map;
}

async function withSectorContext(rows: VendorRow[]) {
  const sectors = await loadVendorSectors([...new Set(rows.map(r => r.supplierDomain))]).catch(() => new Map<string, string | null>());
  const snap = peekBenchmarkSnapshot();
  return rows.map(r => {
    const c = canonicalSector(sectors.get(r.supplierDomain) ?? null);
    const stats = c && snap ? snap.sectors[c.slug] : undefined;
    return {
      ...r,
      sector: c?.label ?? null,
      sectorMedian: stats?.median ?? null,
      sectorSampleSize: stats?.sampleSize ?? null,
      // Yüzdelik yalnızca Skor v2 ile hesaplanmış skorlar için anlamlıdır.
      sectorPercentile: stats && c && r.lastScanScore !== null && storedScoreVersion(r.lastScanData) === SCORE_V2_VERSION
        ? percentileInSector(snap!, c.slug, r.lastScanScore)
        : null,
      overallMedian: snap?.all.median ?? null,
    };
  });
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
    res.json(await withSectorContext(rows));
  } catch (err) {
    logger.error({ err }, "TPRM vendors list error");
    res.status(500).json({ error: "Liste yüklenemedi" });
  }
});

// ─── GET /api/tprm/vendors/report.pdf ─────────────────────────────────────────
// Portföy raporu (KVKK md. 12 / 7545 / BDDK bağlamıyla) — services/tprmReportPdf.ts
router.get("/tprm/vendors/report.pdf", requireCustomer, async (req: Request, res: Response) => {
  try {
    const email = await getSessionCustomerEmail(req);
    if (!email) { res.status(401).json({ error: "Giriş yapmanız gerekiyor" }); return; }
    const customerId = getCustomerId(req)!;
    const [customer] = await db.select({ companyName: customersTable.companyName, fullName: customersTable.fullName })
      .from(customersTable).where(eq(customersTable.id, customerId)).limit(1);

    const rows = await db.select().from(tprmVendorTable)
      .where(eq(tprmVendorTable.customerEmail, email))
      .orderBy(tprmVendorTable.addedAt);
    const withCtx = await withSectorContext(rows);

    const { generatePortfolioReport } = await import("../../services/tprmReportPdf");
    const buf = await generatePortfolioReport({
      companyName: customer?.companyName || customer?.fullName || email,
      generatedAt: new Date(),
      vendors: withCtx.map(v => {
        const stored = storedScoreVersion(v.lastScanData) === SCORE_V2_VERSION
          ? (v.lastScanData as unknown as StoredScanData).score
          : null;
        return {
          domain: v.supplierDomain,
          name: v.supplierName,
          score: v.lastScanScore,
          grade: stored && !stored.insufficientData ? stored.grade : null,
          risk: v.riskLevel,
          sector: v.sector,
          sectorPercentile: v.sectorPercentile,
          lastScanAt: v.lastScanAt,
          questionnaireStatus: v.questionnaireStatus,
          combinedScore: v.combinedScore,
          insufficientData: !!stored?.insufficientData,
          coverage: stored?.coverage ?? null,
          findings: (stored?.findings ?? []).map(f => ({ severity: f.severity, title: f.title })),
        };
      }),
    });

    const date = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="CyberStep_Tedarikci_Portfoy_${date}.pdf"`);
    res.setHeader("Content-Length", buf.length);
    res.send(buf);
  } catch (err) {
    logger.error({ err }, "TPRM portfolio report error");
    res.status(500).json({ error: "Rapor oluşturulamadı" });
  }
});

// ─── GET /api/tprm/plan ───────────────────────────────────────────────────────
router.get("/tprm/plan", requireCustomer, async (req: Request, res: Response) => {
  const email = await getSessionCustomerEmail(req);
  if (!email) { res.status(401).json({ error: "Giriş yapmanız gerekiyor" }); return; }
  const { limit, plan } = await getVendorLimit(req);
  res.json({ plan, limit: Number.isFinite(limit) ? limit : null, used: await countVendors(email) });
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
  if (isInternalHostname(domain)) {
    res.status(400).json({ error: "Genel internette erişilebilir bir alan adı girin" });
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

    const { limit } = await getVendorLimit(req);
    const current = await countVendors(email);
    if (current >= limit) {
      res.status(402).json({
        error: `Paketinizin tedarikçi limiti doldu (${limit}). Daha fazla tedarikçi için paketinizi yükseltin.`,
        code: "VENDOR_LIMIT",
        limit,
        upgradeUrl: "/fiyatlar",
      });
      return;
    }

    const [inserted] = await db.insert(tprmVendorTable).values({
      customerEmail: email,
      supplierDomain: domain,
      supplierName: typeof supplierName === "string" && supplierName.trim() ? supplierName.trim() : null,
      criticality: parseCriticality((req.body as { criticality?: unknown }).criticality),
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
    if (!prior || !isScanFresh(prior.scan)) queueVendorScan(vendor.id, domain);

    res.status(201).json({ ...vendor, instantScore: !!prior, scanPending: !prior || !isScanFresh(prior.scan) });
  } catch (err) {
    logger.error({ err }, "TPRM vendor add error");
    res.status(500).json({ error: "Tedarikçi eklenemedi" });
  }
});

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ─── Arka plan taraması (kuyruklu) ───────────────────────────────────────────

function queueVendorScan(vendorId: number, domain: string): void {
  enqueueScan(`vendor:${vendorId}`, async () => {
    const result = await scanSupplierDomain(domain);
    if (!result) return;
    const [current] = await db.select().from(tprmVendorTable).where(eq(tprmVendorTable.id, vendorId));
    if (current) await applySupplierScore(current, result);
  });
}

// ─── POST /api/tprm/vendors/bulk ──────────────────────────────────────────────
// CSV'den toplu tedarikçi ekleme. İstemci CSV'yi ayrıştırıp satırları gönderir.
// Mevcut taraması olanlar anında skorlanır; diğerleri kuyrukta taranır.

export const BULK_MAX_ROWS = 500;

router.post("/tprm/vendors/bulk", requireCustomer, async (req: Request, res: Response) => {
  const rows = (req.body as { rows?: unknown })?.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: "rows dizisi zorunlu" });
    return;
  }
  if (rows.length > BULK_MAX_ROWS) {
    res.status(400).json({ error: `Tek seferde en fazla ${BULK_MAX_ROWS} tedarikçi yüklenebilir` });
    return;
  }

  try {
    const email = await getSessionCustomerEmail(req);
    if (!email) { res.status(401).json({ error: "Giriş yapmanız gerekiyor" }); return; }

    const invalid: Array<{ row: number; value: string; reason: string }> = [];
    const wanted = new Map<string, { name: string | null; criticality: (typeof CRITICALITY_LEVELS)[number] }>(); // domain → ad + kritiklik
    rows.forEach((raw, i) => {
      const r = (raw ?? {}) as { domain?: unknown; name?: unknown; criticality?: unknown };
      const value = typeof r.domain === "string" ? r.domain : "";
      const domain = normalizeDomain(value);
      if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain) || isInternalHostname(domain)) {
        invalid.push({ row: i + 1, value: value.slice(0, 100), reason: "Geçersiz alan adı" });
        return;
      }
      if (!wanted.has(domain)) {
        const name = typeof r.name === "string" && r.name.trim() ? r.name.trim().slice(0, 200) : null;
        wanted.set(domain, { name, criticality: parseCriticality(r.criticality) });
      }
    });

    const existingRows = wanted.size === 0 ? [] : await db.select({ domain: tprmVendorTable.supplierDomain })
      .from(tprmVendorTable)
      .where(and(eq(tprmVendorTable.customerEmail, email), inArray(tprmVendorTable.supplierDomain, [...wanted.keys()])));
    const already = new Set(existingRows.map(r => r.domain));
    const candidates = [...wanted.entries()].filter(([d]) => !already.has(d));
    const { limit } = await getVendorLimit(req);
    const remaining = Math.max(0, limit - await countVendors(email));
    const toInsert = candidates.slice(0, remaining);
    const overLimit = candidates.length - toInsert.length;

    const inserted = toInsert.length === 0 ? [] : await db.insert(tprmVendorTable)
      .values(toInsert.map(([supplierDomain, meta]) => ({ customerEmail: email, supplierDomain, supplierName: meta.name, criticality: meta.criticality })))
      .returning();

    // Anlık skorlar (tek sorgu)
    const scored = await scoreDomainsV2(inserted.map(v => v.supplierDomain)).catch(() => new Map());
    let instant = 0;
    let queuedCount = 0;
    for (const v of inserted) {
      const prior = scored.get(v.supplierDomain);
      if (prior) {
        await applySupplierScore(v, { scanId: prior.scan.id, scannedAt: prior.scan.createdAt, score: prior.score });
        instant++;
      }
      if (!prior || !isScanFresh(prior.scan)) {
        queueVendorScan(v.id, v.supplierDomain);
        queuedCount++;
      }
    }

    logger.info({ email, added: inserted.length, instant, queued: queuedCount }, "TPRM toplu yükleme");
    res.status(201).json({
      added: inserted.length,
      instantScored: instant,
      queuedForScan: queuedCount,
      skippedExisting: already.size,
      duplicatesInFile: rows.length - invalid.length - wanted.size,
      overLimit,
      limit: Number.isFinite(limit) ? limit : null,
      invalid,
      queue: scanQueueStats(),
    });
  } catch (err) {
    logger.error({ err }, "TPRM bulk add error");
    res.status(500).json({ error: "Toplu yükleme başarısız" });
  }
});

// ─── DELETE /api/tprm/vendors/:id ─────────────────────────────────────────────

// PATCH /api/tprm/vendors/:id/criticality — tedarikçi kritikliğini değiştir
router.patch("/tprm/vendors/:id/criticality", requireCustomer, async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  if (!id) { res.status(400).json({ error: "Geçersiz id" }); return; }
  const raw = (req.body as { criticality?: unknown })?.criticality;
  if (typeof raw !== "string" || !(CRITICALITY_LEVELS as readonly string[]).includes(raw)) {
    res.status(400).json({ error: "Kritiklik: kritik, onemli veya standart olmalı" });
    return;
  }
  try {
    const vendor = await getOwnedVendor(req, id);
    if (!vendor) { res.status(404).json({ error: "Bulunamadı" }); return; }
    await db.update(tprmVendorTable).set({ criticality: raw }).where(eq(tprmVendorTable.id, id));
    res.json({ ok: true, criticality: raw });
  } catch (err) {
    logger.error({ err }, "TPRM vendor criticality error");
    res.status(500).json({ error: "Güncellenemedi" });
  }
});

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

    enqueueScan(`vendor:${vendor.id}`, async () => {
      const result = await getSupplierScore(vendor.supplierDomain, { force: true });
      if (result) await applySupplierScore(vendor, result);
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

  // Müşteri başına tek özet e-posta için uyarılar burada toplanır.
  const alertsByCustomer = new Map<string, Array<{ vendorId: number; domain: string; score: number; risk: string; reasons: AlertReason[] }>>();

  for (const vendor of vendors) {
    try {
      // Keşif hattı bu domaini son 7 günde taradıysa yeniden taramaya gerek yok.
      const result = await getSupplierScore(vendor.supplierDomain);
      if (!result) continue;

      const score = result.score.score;
      const riskLevel = result.score.risk;
      // Karşılaştırma yalnızca iki Skor v2 sonucu arasında yapılır
      // (v1 → v2 geçişindeki metodoloji farkı sahte uyarı üretmesin).
      const prevResult = storedScoreVersion(vendor.lastScanData) === SCORE_V2_VERSION
        ? (vendor.lastScanData as unknown as StoredScanData).score
        : null;

      await applySupplierScore(vendor, result);

      const decision = result.score.insufficientData
        ? { reasons: [], urgent: false }
        : detectVendorAlert(prevResult?.insufficientData ? null : prevResult ?? null, result.score);
      if (shouldSendAlert(decision, vendor.alertSentAt)) {
        const list = alertsByCustomer.get(vendor.customerEmail) ?? [];
        list.push({ vendorId: vendor.id, domain: vendor.supplierDomain, score, risk: riskLevel, reasons: decision.reasons });
        alertsByCustomer.set(vendor.customerEmail, list);
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

  // ── Müşteri başına özet uyarı e-postası ──────────────────────────────────
  const baseUrl = (process.env["REPLIT_DOMAINS"] ?? "").split(",")[0]?.trim();
  for (const [customerEmail, items] of alertsByCustomer) {
    try {
      const rowsHtml = items.map(it => `
  <tr>
    <td style="padding:6px 10px;border-bottom:1px solid #eee"><strong>${escapeHtml(it.domain)}</strong></td>
    <td style="padding:6px 10px;border-bottom:1px solid #eee">${it.score}/100 · ${escapeHtml(it.risk)}</td>
    <td style="padding:6px 10px;border-bottom:1px solid #eee">${it.reasons.map(r => escapeHtml(describeReason(r))).join("<br>")}</td>
  </tr>`).join("");
      await sendMail({
        to: customerEmail,
        subject: items.length === 1
          ? `Tedarikçi uyarısı: ${items[0]!.domain}`
          : `Tedarikçi uyarısı: ${items.length} tedarikçide önemli değişiklik`,
        html: `<p>Merhaba,</p>
<p>Son taramada tedarikçi portföyünüzde dikkat gerektiren değişiklikler tespit edildi.</p>
<table style="border-collapse:collapse;font-size:14px">
  <tr><th align="left" style="padding:6px 10px">Tedarikçi</th><th align="left" style="padding:6px 10px">Skor</th><th align="left" style="padding:6px 10px">Değişiklik</th></tr>
  ${rowsHtml}
</table>
<p>Ayrıntılar için <a href="https://${baseUrl}/hesabim/tedarikci-portfoyu">tedarikçi portföyünüzü</a> inceleyin.</p>`,
      });
      await db.update(tprmVendorTable)
        .set({ alertSentAt: new Date() })
        .where(inArray(tprmVendorTable.id, items.map(i => i.vendorId)));
      logger.info({ customerEmail, vendors: items.length }, "TPRM özet uyarı e-postası gönderildi");
    } catch (err) {
      logger.error({ err, customerEmail }, "TPRM uyarı e-postası gönderilemedi");
    }
  }

  logger.info("TPRM vendor nightly rescan complete");
}

export default router;
