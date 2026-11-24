import { isInternalHostname, isPublicDomain } from "../../lib/hostGuard";
import { Router } from "express";
import type { Request, Response } from "express";
import { randomBytes } from "node:crypto";
import { db } from "@workspace/db";
import { tprmQuestionnaireLinkTable, tprmQuestionnaireResponseTable, tprmVendorTable } from "@workspace/db";
import { eq, and, lte, isNull, or, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { verificationOf } from "../../services/tprmVerificationStatus";
import { isEmailConfigured, appBaseUrl, recordEvent, parseEmails, customerContacts, notifyRescanDone, fetchVendorPdf } from "../../services/tprmRemediation";
import { tprmVendorEventTable } from "@workspace/db";
import { actionsFromFindings } from "../../services/findingActions";
import { getVendorById } from "../../services/tprmRemediation";
import { customersTable } from "@workspace/db";
import { requireCustomer, getCustomerId } from "../../middleware/auth";
import { domainScansTable } from "@workspace/db";
import { SCORE_V2_VERSION, scoreV2Risk, type ScoreV2Result } from "../../lib/scoring/scoreV2";
import { isScanCompleteAndFresh, normalizeDomain, scoreDomainV2, scoreDomainsV2, scoreScanV2, loadKevLookup, mergeExtraKev, vulncheckKevOf } from "../../lib/scoring/scoreV2Loader";
import { buildVendorCves, buildVendorPorts, labelUnchecked } from "../../services/vendorFindings";
import { checkRansomLookByName, type RansomLookHit } from "../../services/ransomLook";
import { isSourceLicensed } from "../../services/dataSourceLicenses";
import { loadVendorQuestionnaire } from "../../services/tprmQuestionnaire";
import { enqueueScan, scanQueueStats } from "../../services/tprmScanQueue";
import { needsFollowUp, FOLLOW_UP_DELAY_MS } from "../../services/followUpScan";
import { portfolioConcentration, type FourthParty } from "../../services/fourthParty";
import { parseRiskDomains, effectiveCriticality } from "../../services/vendorIntake";
import { describeReason, detectVendorAlert, shouldSendAlert, type AlertReason } from "../../lib/scoring/vendorAlerts";
import { canonicalSector } from "../../lib/scoring/sectors";
import { peekBenchmarkSnapshot, percentileInSector } from "../../services/sectorBenchmark";

const router = Router();

// ─── TPRM Anket Soruları ──────────────────────────────────────────────────────
// Evet=10/Kısmen=5/Hayır=0, soru sayısından bağımsız 0–100 ölçeğine normalize edilir

import { TPRM_QUESTIONS, selfScoreOf, questionsFor } from "../../services/tprmQuestions";
import { validateEvidence, MAX_EVIDENCE_FILES } from "../../services/tprmEvidence";
import { validateConsentInput, hasValidConsent, CONSENT_SCOPES, type ConsentScope } from "../../services/tprmConsent";
import { suggestActions, autoVerifiableIds, validateActionItems, ACTION_STATUSES, DECISIONS } from "../../services/tprmActions";
import { sanitizeSubprocessors } from "../../services/subprocessors";
import { diffFourthParties } from "../../services/fourthParty";
export { TPRM_QUESTIONS };

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
  /** Son tarama denemesi başarısız olduysa zamanı; arayüz "tarama başarısız" gösterir. */
  scanErrorAt?: string;
}

/** Tarama başarısız oldu: önceki skor korunur, ama başarısızlık sessiz kalmaz. */
async function markScanFailed(vendor: { id: number; lastScanData: unknown }): Promise<void> {
  const prev = (vendor.lastScanData && typeof vendor.lastScanData === "object" ? vendor.lastScanData : {}) as Record<string, unknown>;
  await db.update(tprmVendorTable)
    .set({ lastScanData: { ...prev, scanErrorAt: new Date().toISOString() } })
    .where(eq(tprmVendorTable.id, vendor.id));
  const [cur] = await db.select({ st: tprmVendorTable.remediationStatus }).from(tprmVendorTable).where(eq(tprmVendorTable.id, vendor.id));
  if (cur?.st === "requested") await recordEvent(vendor.id, "rescan_failed");
}

/** Domain için yeni bir tarama çalıştırır ve Skor v2 hesaplar. */
async function scanSupplierDomain(domain: string): Promise<SupplierScore | null> {
  try {
    const { performDomainScan } = await import("../domain-scan/index");
    const result = await performDomainScan(domain, { full: true });
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
    if (existing && isScanCompleteAndFresh(existing.scan)) {
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

  // Dördüncü taraf değişimi: önceki taramayla karşılaştır, değiştiyse olay kaydı düş.
  try {
    const prevScanId = storedScoreVersion(vendor.lastScanData) === SCORE_V2_VERSION ? (vendor.lastScanData as unknown as StoredScanData).scanId : null;
    if (prevScanId && prevScanId !== result.scanId) {
      const rows = await db.select({ id: domainScansTable.id, extra: domainScansTable.tprmExtra }).from(domainScansTable).where(inArray(domainScansTable.id, [prevScanId, result.scanId]));
      const fp = (id: number) => ((rows.find((r) => r.id === id)?.extra as { fourthParties?: FourthParty[] } | null)?.fourthParties) ?? null;
      const diff = diffFourthParties(fp(prevScanId), fp(result.scanId));
      if (diff) await recordEvent(vendor.id, "fourth_party_changed", diff);
    }
  } catch (err) {
    logger.warn({ err, vendorId: vendor.id }, "Dördüncü taraf değişim karşılaştırması başarısız");
  }

  // Aksiyon planı: yeni taramada sorunu görünmeyen maddeleri taramayla doğrula.
  try {
    if (!insufficient) {
      const acts = rowsOf(await db.execute(sql`SELECT id, source_key, status FROM tprm_actions WHERE vendor_id = ${vendor.id} AND status IN ('open','supplier_done')`));
      if (acts.length) {
        const [scan] = await db.select().from(domainScansTable).where(eq(domainScansTable.id, result.scanId));
        const hr = (scan?.tprmExtra as { hudsonRock?: { employees?: number } | null } | null)?.hudsonRock;
        const ids = scan ? autoVerifiableIds(
          acts.map((a) => ({ id: Number(a["id"]), sourceKey: String(a["source_key"]), status: String(a["status"]) })),
          {
            reliable: true, spfRecord: scan.spfRecord ?? null, dmarcRecord: scan.dmarcRecord ?? null,
            cveSummary: (scan.cveSummary as Array<{ cveId?: string; cvssScore?: number }> | null) ?? null,
            hudsonEmployees: hr ? (hr.employees ?? 0) : null,
          },
        ) : [];
        for (const id of ids) {
          await db.execute(sql`UPDATE tprm_actions SET status = 'verified', closed_at = NOW(), closed_note = 'Yeniden taramayla doğrulandı' WHERE id = ${id} AND vendor_id = ${vendor.id}`);
        }
        if (ids.length) await recordEvent(vendor.id, "actions_auto_verified", { count: ids.length });
      }
    }
  } catch (err) {
    logger.warn({ err, vendorId: vendor.id }, "Aksiyon otomatik doğrulama başarısız");
  }

  // Düzeltme sonrası yeniden değerlendirme: talepten SONRA tamamlanan tarama müşteriye bildirilir.
  const [cur] = await db.select().from(tprmVendorTable).where(eq(tprmVendorTable.id, vendor.id));
  if (cur && cur.remediationStatus === "requested" && cur.remediationRequestedAt && result.scannedAt >= cur.remediationRequestedAt && !insufficient) {
    const after = result.score.score;
    await db.update(tprmVendorTable).set({ remediationStatus: "rescanned", remediationDoneAt: new Date() }).where(eq(tprmVendorTable.id, cur.id));
    const emailed = await notifyRescanDone(cur, cur.scoreBeforeRemediation, after);
    await recordEvent(cur.id, "rescan_done", { before: cur.scoreBeforeRemediation, after, emailed });
  }
}

// ─── POST /api/tprm/questionnaire ─────────────────────────────────────────────
// Tedarikçi için anket linki oluştur

router.post("/tprm/questionnaire", (_req: Request, res: Response) => {
  // Anket linkini yalnızca giriş yapmış müşteri, kendi tedarikçisi için üretebilir
  // (POST /api/tprm/vendors/:id/send-questionnaire). Anonim üretim ve dışarıdan skor yazma kapatıldı.
  res.status(410).json({ error: "Anket linki müşteri panelindeki Tedarikçi Portföyü üzerinden oluşturulur." });
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
      expiresAt: link.expiresAt,
      questions: questionsFor(await riskDomainsForToken(token, link.vendorId)),
      alreadyCompleted: !!existing,
      // İlk ankette tedarikçiye skor/risk/tarama bilgisi gösterilmez; yalnızca tamamlandığı bilgisi.
      existingResult: existing ? { completedAt: existing.completedAt } : null,
      kind: link.kind,
      ...(link.kind === "reassess" ? await supplierReassessView(link) : {}),
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
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supplierContactEmail)) {
    res.status(400).json({ error: "Geçerli bir e-posta adresi girin" });
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

    // Soru seti tedarikçinin risk alanlarına göre belirlenir; gönderilen cevaplar bu kümeyle birebir eşleşmeli.
    const validIds = new Set(questionsFor(await riskDomainsForToken(token, link.vendorId)).map(q => q.id));
    const answeredIds = new Set(answers.map(a => a.questionId));
    if (answers.length !== validIds.size || answeredIds.size !== validIds.size || ![...answeredIds].every(id => validIds.has(id))
        || !answers.every(a => a.answer === "evet" || a.answer === "kismen" || a.answer === "hayir")) {
      res.status(400).json({ error: "Tüm soruları yanıtlayın" });
      return;
    }

    // Yeniden değerlendirme talebi: 24 saatte bir.
    let reassessVendor: Awaited<ReturnType<typeof getVendorById>> | null = null;
    if (link.kind === "reassess" && link.vendorId) {
      reassessVendor = await getVendorById(link.vendorId);
      if (!reassessVendor) { res.status(404).json({ error: "Tedarikçi kaydı bulunamadı" }); return; }
      if (reassessVendor.remediationStatus === "requested" && reassessVendor.remediationRequestedAt
          && Date.now() - reassessVendor.remediationRequestedAt.getTime() < 24 * 60 * 60 * 1000) {
        res.status(429).json({ error: "Yeniden değerlendirme talebiniz zaten alındı; yeni tarama sürüyor." });
        return;
      }
    }

    // Beyan puanı (Evet=10 / Kısmen=5 / Hayır=0). Taramayla BİRLEŞTİRİLMEZ; doğrulanmamış beyan olarak saklanır.
    const scoredAnswers = answers.map(a => ({
      questionId: a.questionId,
      answer: a.answer,
      score: a.answer === "evet" ? 10 : a.answer === "kismen" ? 5 : 0,
    }));
    const selfScore = selfScoreOf(answers, answers.length);

    const [response] = await db.insert(tprmQuestionnaireResponseTable).values({
      linkId: link.id,
      supplierContactName,
      supplierContactEmail,
      answers: scoredAnswers as unknown as Record<string, unknown>[],
      selfScore,
      combinedScore: null,
      subprocessors: sanitizeSubprocessors((req.body as { subprocessors?: unknown }).subprocessors) as unknown as Record<string, unknown>[],
    }).returning();

    if (reassessVendor) {
      // Güncel anket artık bu bağlantıdır; yeni tarama otomatik başlatılır.
      const prevLoaded = await loadVendorQuestionnaire(reassessVendor).catch(() => null);
      await db.update(tprmVendorTable).set({
        questionnaireToken: token,
        questionnaireStatus: "completed",
        supplierContactEmail: supplierContactEmail.trim().toLowerCase(),
        remediationStatus: "requested",
        remediationRequestedAt: new Date(),
        remediationDoneAt: null,
        scoreBeforeRemediation: reassessVendor.lastScanScore,
      }).where(eq(tprmVendorTable.id, reassessVendor.id));
      await recordEvent(reassessVendor.id, "reassess_requested", { selfBefore: prevLoaded?.selfScore ?? null, selfAfter: selfScore, contact: supplierContactName });
      queueVendorScan(reassessVendor.id, reassessVendor.supplierDomain);
    } else {
      // İlk anket: vendor yalnızca "tamamlandı" olarak işaretlenir; risk skoru/seviyesi taramadan gelir ve anketle değişmez.
      await db.update(tprmVendorTable)
        .set({ questionnaireStatus: "completed", supplierContactEmail: supplierContactEmail.trim().toLowerCase() })
        .where(eq(tprmVendorTable.questionnaireToken, token));
      const [v0] = await db.select({ id: tprmVendorTable.id }).from(tprmVendorTable).where(eq(tprmVendorTable.questionnaireToken, token));
      if (v0) await recordEvent(v0.id, "questionnaire_completed", { selfScore });
    }

    // Tedarikçiye skor, risk seviyesi veya yapay zeka yorumu dönmez.
    res.json({ ok: true, responseId: response!.id });
  } catch (err) {
    logger.error({ err }, "TPRM questionnaire submit error");
    res.status(500).json({ error: "Yanıtlar gönderilemedi" });
  }
});

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

/** Plan ve abonelik durumundan tedarikçi limiti (Infinity = sınırsız). */
export function resolveVendorLimit(plan: string | null | undefined, status: string | null | undefined): { limit: number; plan: string | null } {
  const active = status === "active" || status === "trial";
  const p = plan ?? null;
  if (active && p && TPRM_PLAN_LIMITS[p] !== undefined) return { limit: TPRM_PLAN_LIMITS[p]!, plan: p };
  if (active && p && p !== "free") return { limit: LEGACY_PAID_LIMIT, plan: p };
  return { limit: TPRM_FREE_LIMIT, plan: null };
}

async function getVendorLimit(req: Request): Promise<{ limit: number; plan: string | null }> {
  const customerId = getCustomerId(req);
  if (!customerId) return { limit: 0, plan: null };
  const [c] = await db.select({ plan: customersTable.subscriptionPlan, status: customersTable.subscriptionStatus })
    .from(customersTable).where(eq(customersTable.id, customerId)).limit(1);
  return resolveVendorLimit(c?.plan, c?.status);
}

async function countVendors(email: string): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(tprmVendorTable)
    .where(and(eq(tprmVendorTable.customerEmail, email), eq(tprmVendorTable.isOwn, false)));
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

/** Anket bağlantısına ait tedarikçinin risk alanları (soru setini belirler). Bulunamazsa null = tüm sorular. */
async function riskDomainsForToken(token: string, linkVendorId: number | null): Promise<ReturnType<typeof parseRiskDomains>> {
  const rows = linkVendorId
    ? await db.select().from(tprmVendorTable).where(eq(tprmVendorTable.id, linkVendorId)).limit(1)
    : await db.select().from(tprmVendorTable).where(eq(tprmVendorTable.questionnaireToken, token)).limit(1);
  return parseRiskDomains(rows[0]?.riskDomains ?? null);
}

// ─── GET /api/tprm/fourth-parties ─────────────────────────────────────────────
// Portföy genelinde dördüncü taraf yoğunlaşması (dışarıdan görünen e-posta/DNS/bulut/web hizmetleri).
router.get("/tprm/fourth-parties", requireCustomer, async (req: Request, res: Response) => {
  try {
    const email = await getSessionCustomerEmail(req);
    if (!email) { res.status(401).json({ error: "Giriş yapmanız gerekiyor" }); return; }
    const vendors = await db.select().from(tprmVendorTable)
      .where(and(eq(tprmVendorTable.customerEmail, email), eq(tprmVendorTable.isOwn, false)));
    const scanIds = vendors
      .map((v) => (storedScoreVersion(v.lastScanData) === SCORE_V2_VERSION ? (v.lastScanData as unknown as StoredScanData).scanId : null))
      .filter((x): x is number => typeof x === "number");
    const scans = scanIds.length ? await db.select({ id: domainScansTable.id, extra: domainScansTable.tprmExtra }).from(domainScansTable).where(inArray(domainScansTable.id, scanIds)) : [];
    const byScan = new Map(scans.map((s) => [s.id, ((s.extra as { fourthParties?: FourthParty[] } | null)?.fourthParties) ?? null]));
    const withData = vendors.flatMap((v) => {
      const sid = storedScoreVersion(v.lastScanData) === SCORE_V2_VERSION ? (v.lastScanData as unknown as StoredScanData).scanId : null;
      const parties = sid ? byScan.get(sid) : null;
      return parties ? [{ vendorId: v.id, vendorName: v.supplierName || v.supplierDomain, parties }] : [];
    });
    res.json({ totalVendors: vendors.length, analyzedVendors: withData.length, concentration: portfolioConcentration(withData) });
  } catch (err) {
    logger.error({ err }, "TPRM fourth-parties error");
    res.status(500).json({ error: "Dördüncü taraf özeti alınamadı" });
  }
});

router.get("/tprm/vendors", requireCustomer, async (req: Request, res: Response) => {
  try {
    const email = await getSessionCustomerEmail(req);
    if (!email) { res.status(401).json({ error: "Giriş yapmanız gerekiyor" }); return; }
    const rows = await db.select().from(tprmVendorTable)
      .where(eq(tprmVendorTable.customerEmail, email))
      .orderBy(tprmVendorTable.addedAt);
    res.json((await withSectorContext(rows)).map((v) => ({ ...v, verification: verificationOf(v.lastVerifiedAt) })));
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

    const own = req.query["scope"] === "own";
    const rows = await db.select().from(tprmVendorTable)
      .where(and(eq(tprmVendorTable.customerEmail, email), eq(tprmVendorTable.isOwn, own)))
      .orderBy(tprmVendorTable.addedAt);
    if (own && rows.length === 0) { res.status(404).json({ error: "Henüz kendi alan adı eklenmedi" }); return; }
    const withCtx = await withSectorContext(rows);
    // Fidye sızıntı sitesi duyuruları (taramada kaydedilen alan adı eşleşmeleri)
    const scanIdOf = (v: VendorRow) => storedScoreVersion(v.lastScanData) === SCORE_V2_VERSION ? (v.lastScanData as unknown as StoredScanData).scanId : null;
    const ransomScanIds = withCtx.map(scanIdOf).filter((x): x is number => typeof x === "number");
    const ransomRows = ransomScanIds.length ? await db.select({ id: domainScansTable.id, extra: domainScansTable.tprmExtra }).from(domainScansTable).where(inArray(domainScansTable.id, ransomScanIds)) : [];
    const ransomByScan = new Map(ransomRows.map((r) => [r.id, ((r.extra as { ransomLook?: RansomLookHit[] | null } | null)?.ransomLook) ?? []]));

    const { generatePortfolioReport } = await import("../../services/tprmReportPdf");
    const vendorIds = withCtx.map(v => v.id);
    const evRows = vendorIds.length ? await db.select().from(tprmVendorEventTable).where(inArray(tprmVendorEventTable.vendorId, vendorIds)).orderBy(sql`created_at DESC`) : [];
    const qMap = new Map<number, Awaited<ReturnType<typeof loadVendorQuestionnaire>>>();
    for (const v of withCtx) qMap.set(v.id, v.questionnaireStatus === "completed" ? await loadVendorQuestionnaire(v).catch(() => null) : null);
    const buf = await generatePortfolioReport({
      companyName: customer?.companyName || customer?.fullName || email,
      generatedAt: new Date(),
      own,
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
          selfScore: qMap.get(v.id)?.selfScore ?? null,
          contradictions: qMap.get(v.id)?.contradictions.length ?? 0,
          remediation: { status: v.remediationStatus, before: v.scoreBeforeRemediation, requestedAt: v.remediationRequestedAt, doneAt: v.remediationDoneAt },
          ransomHits: ransomByScan.get(scanIdOf(v) ?? -1) ?? [],
          events: evRows.filter(e => e.vendorId === v.id).map(e => ({ kind: e.kind, at: e.createdAt, detail: e.detail as Record<string, unknown> | null })),
        };
      }),
    });

    const date = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${own ? "CyberStep_Kendi_Alan_Adlarim" : "CyberStep_Tedarikci_Portfoy"}_${date}.pdf"`);
    res.setHeader("Content-Length", buf.length);
    res.send(buf);
  } catch (err) {
    logger.error({ err }, "TPRM portfolio report error");
    res.status(500).json({ error: "Rapor oluşturulamadı" });
  }
});

// ─── GET /api/tprm/vendors/:id/report.pdf ─────────────────────────────────────
// Tedarikçi bazlı rapor: müşteri yalnızca kendi tedarikçisinin raporunu indirip ilgili tedarikçiye iletir.
router.get("/tprm/vendors/:id/report.pdf", requireCustomer, async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  if (!id) { res.status(400).json({ error: "Geçersiz id" }); return; }
  try {
    const vendor = await getOwnedVendor(req, id);
    if (!vendor) { res.status(404).json({ error: "Bulunamadı" }); return; }
    const scanId = storedScoreVersion(vendor.lastScanData) === SCORE_V2_VERSION
      ? (vendor.lastScanData as unknown as StoredScanData).scanId
      : null;
    if (!scanId) { res.status(409).json({ error: "Bu tedarikçi için henüz tamamlanmış bir tarama yok" }); return; }
    // Oturum çerezi aynı kaynakta taşınır; PDF, portföy tedarikçisi için tam erişimle üretilir.
    res.redirect(302, `/api/domain-scan/${scanId}/pdf`);
  } catch (err) {
    logger.error({ err }, "TPRM vendor report error");
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

/** Müşteri başına eklenebilecek kendi alan adı sayısı (kötüye kullanımı sınırlar). */
const OWN_DOMAIN_MAX = 20;

router.post("/tprm/vendors", requireCustomer, async (req: Request, res: Response) => {
  const { supplierDomain, supplierName } = req.body as {
    supplierDomain?: string;
    supplierName?: string;
  };
  const isOwn = (req.body as { isOwn?: unknown }).isOwn === true;

  if (!supplierDomain || typeof supplierDomain !== "string") {
    res.status(400).json({ error: "supplierDomain zorunlu" });
    return;
  }

  const domain = normalizeDomain(supplierDomain);

  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    res.status(400).json({ error: "Geçerli bir alan adı girin (örn. firma.com.tr)" });
    return;
  }
  if (isInternalHostname(domain) || !(await isPublicDomain(domain))) {
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
      if (existing.isOwn !== isOwn) {
        res.status(409).json({
          error: existing.isOwn
            ? "Bu alan adı kendi alan adlarınız arasında kayıtlı."
            : "Bu alan adı tedarikçi olarak kayıtlı. Önce tedarikçilerden kaldırın.",
        });
        return;
      }
      res.json(existing);
      return;
    }

    if (isOwn) {
      const [own] = await db.select({ n: sql<number>`count(*)::int` }).from(tprmVendorTable)
        .where(and(eq(tprmVendorTable.customerEmail, email), eq(tprmVendorTable.isOwn, true)));
      if ((own?.n ?? 0) >= OWN_DOMAIN_MAX) {
        res.status(400).json({ error: `En fazla ${OWN_DOMAIN_MAX} kendi alan adı eklenebilir.`, code: "OWN_DOMAIN_LIMIT" });
        return;
      }
    }

    const { limit } = await getVendorLimit(req);
    const current = await countVendors(email);
    if (!isOwn && current >= limit) {
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
      isOwn,
      riskDomains: isOwn ? null : parseRiskDomains((req.body as { riskDomains?: unknown }).riskDomains),
      criticality: isOwn ? "standart" : effectiveCriticality(
        parseCriticality((req.body as { criticality?: unknown }).criticality),
        parseRiskDomains((req.body as { riskDomains?: unknown }).riskDomains),
      ),
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
    if (!prior || !isScanCompleteAndFresh(prior.scan)) queueVendorScan(vendor.id, domain);

    res.status(201).json({ ...vendor, instantScore: !!prior, scanPending: !prior || !isScanCompleteAndFresh(prior.scan) });
  } catch (err) {
    logger.error({ err }, "TPRM vendor add error");
    res.status(500).json({ error: "Tedarikçi eklenemedi" });
  }
});

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}


/** Taramada geçici olarak ölçülemeyen kaynak kaldıysa 5 dk sonra tek seferlik takip taraması planlar. */
const followUpPending = new Set<number>();
async function maybeScheduleFollowUp(vendorId: number, domain: string, scanId: number, isFollowUp: boolean): Promise<void> {
  try {
    if (followUpPending.has(vendorId)) return;
    const [scan] = await db.select({ u: domainScansTable.uncheckedSources }).from(domainScansTable).where(eq(domainScansTable.id, scanId));
    if (!needsFollowUp((scan?.u as string[] | null) ?? [], isFollowUp)) return;
    followUpPending.add(vendorId);
    const t = setTimeout(() => {
      followUpPending.delete(vendorId);
      enqueueScan(`vendor:${vendorId}:followup`, async () => {
        const result = await getSupplierScore(domain, { force: true });
        const [cur] = await db.select().from(tprmVendorTable).where(eq(tprmVendorTable.id, vendorId));
        if (result && cur) await applySupplierScore(cur, result);
      });
    }, FOLLOW_UP_DELAY_MS);
    t.unref?.();
  } catch (err) {
    logger.warn({ err, vendorId }, "TPRM takip taraması planlanamadı");
  }
}

// ─── Arka plan taraması (kuyruklu) ───────────────────────────────────────────

function queueVendorScan(vendorId: number, domain: string): void {
  enqueueScan(`vendor:${vendorId}`, async () => {
    const result = await scanSupplierDomain(domain);
    const [current] = await db.select().from(tprmVendorTable).where(eq(tprmVendorTable.id, vendorId));
    if (!current) return;
    if (!result) { await markScanFailed(current); return; }
    await applySupplierScore(current, result);
    await maybeScheduleFollowUp(vendorId, domain, result.scanId, false);
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
      if (!prior || !isScanCompleteAndFresh(prior.scan)) {
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

// PATCH /api/tprm/vendors/:id/risk-domains — ön sınıflandırmayı güncelle (kritiklik gerekirse yükseltilir)
router.patch("/tprm/vendors/:id/risk-domains", requireCustomer, async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  const domains = parseRiskDomains((req.body as { riskDomains?: unknown })?.riskDomains);
  if (!id || !domains) { res.status(400).json({ error: "Geçersiz istek" }); return; }
  try {
    const vendor = await getOwnedVendor(req, id);
    if (!vendor) { res.status(404).json({ error: "Bulunamadı" }); return; }
    const criticality = effectiveCriticality(parseCriticality(vendor.criticality), domains);
    await db.update(tprmVendorTable).set({ riskDomains: domains, criticality }).where(eq(tprmVendorTable.id, id));
    res.json({ ok: true, riskDomains: domains, criticality });
  } catch (err) {
    logger.error({ err }, "TPRM vendor risk-domains error");
    res.status(500).json({ error: "Güncellenemedi" });
  }
});

// POST /api/tprm/vendors/:id/verify — yıllık doğrulamayı işaretle (müşteri kendi kanıtına dayanarak; CyberStep doğrulamayı yapmaz, kaydı tutar)
router.post("/tprm/vendors/:id/verify", requireCustomer, async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  try {
    const vendor = await getOwnedVendor(req, id);
    if (!vendor) { res.status(404).json({ error: "Tedarikçi bulunamadı" }); return; }
    if (vendor.isOwn) { res.status(400).json({ error: "Kendi alan adları için doğrulama işaretlenmez" }); return; }
    const raw = (req.body as { note?: unknown })?.note;
    const note = typeof raw === "string" && raw.trim() ? raw.trim().slice(0, 500) : null;
    const now = new Date();
    await db.update(tprmVendorTable).set({ lastVerifiedAt: now, verificationNote: note, verifyRemindedAt: null }).where(eq(tprmVendorTable.id, id));
    await recordEvent(id, "annual_verified", { note, score: vendor.lastScanScore ?? null, questionnaire: vendor.questionnaireStatus });
    res.json({ ok: true, verification: verificationOf(now), note });
  } catch (err) {
    logger.error({ err }, "TPRM vendor verify error");
    res.status(500).json({ error: "Doğrulama kaydedilemedi" });
  }
});

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
      if (result) { await applySupplierScore(vendor, result); await maybeScheduleFollowUp(vendor.id, vendor.supplierDomain, result.scanId, false); }
      else await markScanFailed(vendor);
    });
  } catch (err) {
    logger.error({ err }, "TPRM vendor rescan route error");
    res.status(500).json({ error: "Yeniden tarama başlatılamadı" });
  }
});

// ─── GET /api/tprm/vendors/:id/questionnaire ──────────────────────────────────
// Müşteri için: tedarikçinin anket durumu, beyanları ve taramayla çelişen beyanlar.
router.get("/tprm/vendors/:id/questionnaire", requireCustomer, async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  if (!id) { res.status(400).json({ error: "Geçersiz id" }); return; }
  try {
    const vendor = await getOwnedVendor(req, id);
    if (!vendor) { res.status(404).json({ error: "Bulunamadı" }); return; }
    res.json({ questionnaire: await loadVendorQuestionnaire(vendor) });
  } catch (err) {
    logger.error({ err }, "TPRM vendor questionnaire error");
    res.status(500).json({ error: "Anket sonucu yüklenemedi" });
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

    // Aynı tedarikçi için önceki bekleyen link geçersiz kılınır (tek aktif link).
    if (vendor.questionnaireToken && vendor.questionnaireStatus !== "completed") {
      await db.update(tprmQuestionnaireLinkTable)
        .set({ expiresAt: new Date() })
        .where(eq(tprmQuestionnaireLinkTable.token, vendor.questionnaireToken));
    }

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

// ─── Düzeltme / yeniden değerlendirme döngüsü ───────────────────────────────

/** Tedarikçiye gösterilen düzeltme görünümü (yeniden değerlendirme bağlantısı). */
async function supplierReassessView(link: { vendorId: number | null }) {
  const vendor = link.vendorId ? await getVendorById(link.vendorId) : null;
  if (!vendor) return { report: null, previousAnswers: [] };
  const stored = storedScoreVersion(vendor.lastScanData) === SCORE_V2_VERSION
    ? (vendor.lastScanData as unknown as StoredScanData).score : null;
  const prev = await loadVendorQuestionnaire(vendor).catch(() => null);
  return {
    report: stored && !stored.insufficientData ? {
      score: stored.score, grade: stored.grade, risk: stored.risk, scannedAt: vendor.lastScanAt,
      actions: actionsFromFindings(stored.findings, 8),
    } : null,
    previousAnswers: (prev?.answers ?? []).map(a => ({ questionId: a.questionId, answer: a.answer })),
    contradictions: prev?.contradictions ?? [],
    remediationStatus: vendor.remediationStatus,
  };
}

async function createReassessLink(vendor: { id: number; supplierDomain: string; supplierName: string | null }, customer: { companyName: string | null; fullName: string }) {
  // Aynı tedarikçi için önceki bekleyen yeniden değerlendirme bağlantıları geçersiz kılınır.
  await db.update(tprmQuestionnaireLinkTable).set({ expiresAt: new Date() })
    .where(and(eq(tprmQuestionnaireLinkTable.vendorId, vendor.id), eq(tprmQuestionnaireLinkTable.kind, "reassess")));
  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(tprmQuestionnaireLinkTable).values({
    companyName: customer.companyName || customer.fullName, companySector: "—",
    supplierDomain: vendor.supplierDomain, supplierName: vendor.supplierName ?? null,
    token, expiresAt, kind: "reassess", vendorId: vendor.id,
  });
  const base = appBaseUrl();
  return { token, link: base ? `${base}/tprm/anket/${token}` : `/tprm/anket/${token}`, expiresAt };
}

async function loadCustomer(req: Request) {
  const id = getCustomerId(req);
  if (!id) return null;
  const [c] = await db.select().from(customersTable).where(eq(customersTable.id, id)).limit(1);
  return c ?? null;
}

// GET/PUT /api/tprm/settings — bildirim kişileri
router.get("/tprm/settings", requireCustomer, async (req: Request, res: Response) => {
  const c = await loadCustomer(req);
  if (!c) { res.status(401).json({ error: "Giriş yapmanız gerekiyor" }); return; }
  res.json({ notifyEmails: parseEmails(c.tprmNotifyEmails), accountEmail: c.email, emailConfigured: isEmailConfigured() });
});

router.put("/tprm/settings", requireCustomer, async (req: Request, res: Response) => {
  const c = await loadCustomer(req);
  if (!c) { res.status(401).json({ error: "Giriş yapmanız gerekiyor" }); return; }
  const raw = (req.body as { notifyEmails?: unknown })?.notifyEmails;
  const list = parseEmails(Array.isArray(raw) ? raw.join(",") : typeof raw === "string" ? raw : "");
  if (list.length > 10) { res.status(400).json({ error: "En fazla 10 kişi tanımlanabilir" }); return; }
  await db.update(customersTable).set({ tprmNotifyEmails: list.join(",") || null }).where(eq(customersTable.id, c.id));
  res.json({ notifyEmails: list });
});

// POST /api/tprm/vendors/:id/supplier-link — tedarikçiye iletilecek yeniden değerlendirme bağlantısı
router.post("/tprm/vendors/:id/supplier-link", requireCustomer, async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  const vendor = id ? await getOwnedVendor(req, id) : null;
  const c = await loadCustomer(req);
  if (!vendor || !c) { res.status(404).json({ error: "Bulunamadı" }); return; }
  const l = await createReassessLink(vendor, c);
  res.json({ token: l.token, link: l.link, expiresAt: l.expiresAt.toISOString() });
});

// POST /api/tprm/vendors/:id/send-to-supplier — rapor + anket sonucu + yeniden değerlendirme bağlantısı e-postayla (SMTP aktifse)
router.post("/tprm/vendors/:id/send-to-supplier", requireCustomer, async (req: Request, res: Response) => {
  if (!isEmailConfigured()) {
    res.status(503).json({ error: "E-posta servisi henüz aktif değil", code: "EMAIL_NOT_CONFIGURED" });
    return;
  }
  const id = parseInt(req.params["id"] as string);
  const vendor = id ? await getOwnedVendor(req, id) : null;
  const c = await loadCustomer(req);
  if (!vendor || !c) { res.status(404).json({ error: "Bulunamadı" }); return; }
  const to = parseEmails((req.body as { email?: string })?.email ?? vendor.supplierContactEmail ?? "")[0];
  if (!to) { res.status(400).json({ error: "Geçerli bir tedarikçi e-posta adresi girin", code: "NO_RECIPIENT" }); return; }
  try {
    const l = await createReassessLink(vendor, c);
    const pdf = await fetchVendorPdf(vendor.id, c.id);
    const q = await loadVendorQuestionnaire(vendor).catch(() => null);
    const company = escapeHtml(c.companyName || c.fullName);
    const { sendMail } = await import("../../services/email");
    await sendMail({
      to,
      subject: `${c.companyName || c.fullName}: tedarikçi siber güvenlik değerlendirme raporunuz`,
      html: `<p>Merhaba,</p>
<p><strong>${company}</strong>, tedarikçi siber risk değerlendirmesi kapsamında <strong>${escapeHtml(vendor.supplierDomain)}</strong> için hazırlanan raporu ekte iletti.${q?.selfScore != null ? ` Anket beyan puanınız: ${q.selfScore}/100.` : ""}</p>
<p>Rapordaki öncelikli aksiyonları kendi sisteminizde tamamladıktan sonra anketinizi güncelleyip yeniden değerlendirme talep edebilirsiniz; yeni bir tarama otomatik başlatılır:</p>
<p><a href="${l.link}">Düzeltmeleri tamamladım — yeniden değerlendirme talep et</a></p>
<p style="color:#666;font-size:12px">Bağlantı ${l.expiresAt.toLocaleDateString("tr-TR")} tarihine kadar geçerlidir.</p>`,
      attachments: pdf ? [{ filename: `CyberStep_Rapor_${vendor.supplierDomain}.pdf`, content: pdf, contentType: "application/pdf" }] : [],
    });
    await db.update(tprmVendorTable).set({ supplierContactEmail: to }).where(eq(tprmVendorTable.id, vendor.id));
    await recordEvent(vendor.id, "report_sent", { to, pdfAttached: !!pdf });
    res.json({ ok: true, to, pdfAttached: !!pdf });
  } catch (err) {
    logger.error({ err }, "TPRM send-to-supplier error");
    res.status(500).json({ error: "E-posta gönderilemedi" });
  }
});

// GET /api/tprm/questionnaire/:token/report.pdf — yalnızca yeniden değerlendirme bağlantısı sahibi tedarikçi kendi raporunu indirir
router.get("/tprm/questionnaire/:token/report.pdf", async (req: Request, res: Response) => {
  try {
    const [link] = await db.select().from(tprmQuestionnaireLinkTable).where(eq(tprmQuestionnaireLinkTable.token, req.params["token"] as string));
    if (!link || link.kind !== "reassess" || !link.vendorId || new Date() > link.expiresAt) { res.status(404).json({ error: "Bulunamadı" }); return; }
    const vendor = await getVendorById(link.vendorId);
    if (!vendor) { res.status(404).json({ error: "Bulunamadı" }); return; }
    const [owner] = await db.select({ id: customersTable.id }).from(customersTable).where(eq(customersTable.email, vendor.customerEmail)).limit(1);
    const pdf = owner ? await fetchVendorPdf(vendor.id, owner.id) : null;
    if (!pdf) { res.status(409).json({ error: "Rapor şu an üretilemedi" }); return; }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="CyberStep_Rapor_${vendor.supplierDomain}.pdf"`);
    res.send(pdf);
  } catch (err) {
    logger.error({ err }, "TPRM supplier report error");
    res.status(500).json({ error: "Rapor oluşturulamadı" });
  }
});

// GET /api/tprm/vendors/:id/events — zaman çizelgesi
router.get("/tprm/vendors/:id/events", requireCustomer, async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  const vendor = id ? await getOwnedVendor(req, id) : null;
  if (!vendor) { res.status(404).json({ error: "Bulunamadı" }); return; }
  const rows = await db.select().from(tprmVendorEventTable).where(eq(tprmVendorEventTable.vendorId, id)).orderBy(sql`created_at DESC`).limit(50);
  res.json({ events: rows });
});

// GET /api/tprm/vendors/:id/findings — tedarikçinin son taramasındaki bulgular (CVE, açık portlar, ölçülemeyenler).
// Yalnızca oturumdaki müşterinin kendi tedarikçisi için döner (getOwnedVendor kiracı kapsamı).
router.get("/tprm/vendors/:id/findings", requireCustomer, async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  const vendor = id ? await getOwnedVendor(req, id) : null;
  if (!vendor) { res.status(404).json({ error: "Bulunamadı" }); return; }
  try {
    const scanId = storedScoreVersion(vendor.lastScanData) === SCORE_V2_VERSION
      ? (vendor.lastScanData as unknown as StoredScanData).scanId
      : null;
    if (!scanId) { res.status(409).json({ error: "Bu tedarikçi için henüz tamamlanmış bir tarama yok" }); return; }
    const [scan] = await db.select().from(domainScansTable).where(eq(domainScansTable.id, scanId)).limit(1);
    // Taramanın alan adı tedarikçiyle eşleşmeli (başka alan adının verisi sızmasın)
    if (!scan || normalizeDomain(scan.domain) !== normalizeDomain(vendor.supplierDomain)) { res.status(404).json({ error: "Tarama bulunamadı" }); return; }
    const extra = (scan.tprmExtra ?? null) as { epss?: Record<string, { score: number | null; percentile: number | null }>; hudsonRock?: unknown; ransomLook?: RansomLookHit[] | null; mozillaObservatory?: unknown; sslLabsGrade?: string | null; danglingCnames?: string[]; sslLabsError?: string | null; sslLabsPending?: boolean; clientLibs?: { detected: { library: string; version: string }[]; findings: unknown[] } | null; fourthParties?: FourthParty[] } | null;
    const cveIds = (scan.cveSummary ?? []).map((c) => c.cveId);
    const kev = mergeExtraKev(await loadKevLookup(cveIds), vulncheckKevOf(scan));
    const scoreV2 = await scoreScanV2(scan);
    // Fidye sızıntı sitesi duyuruları: alan adı eşleşmesi (taramadan) + şirket adı ile olası eşleşme (canlı, önbellekli).
    // Bilgi amaçlıdır, skora girmez; duyurular saldırgan iddiasıdır ve doğrulanmamıştır.
    const domainHits = extra?.ransomLook ?? null;
    let nameHits: RansomLookHit[] | null = null;
    if (vendor.supplierName && isSourceLicensed("ransomlook")) {
      const found = await checkRansomLookByName(vendor.supplierName, fetch as never).catch(() => null);
      nameHits = found ? found.filter((h) => !(domainHits ?? []).some((d) => d.group === h.group && d.title === h.title)) : null;
    }
    res.json({
      domain: vendor.supplierDomain,
      scannedAt: scan.createdAt,
      score: { value: scoreV2.score, grade: scoreV2.grade, risk: scoreV2.risk, coverage: scoreV2.coverage, caps: scoreV2.caps, insufficientData: scoreV2.insufficientData },
      findings: scoreV2.findings,
      cves: buildVendorCves(scan.cveSummary, kev, extra?.epss),
      ports: buildVendorPorts(scan.shodanOpenPorts),
      clientLibCves: extra?.clientLibs?.findings ?? [],
      clientLibsDetected: extra?.clientLibs?.detected ?? [],
      clientLibsChecked: extra?.clientLibs != null,
      other: {
        sslLabsGrade: extra?.sslLabsGrade ?? null,
        sslLabsError: extra?.sslLabsError ?? null,
        sslLabsPending: extra?.sslLabsPending ?? false,
        fourthParties: extra?.fourthParties ?? null,
        danglingCnames: extra?.danglingCnames ?? [],
        hudsonRock: extra?.hudsonRock ?? null,
        ransomLook: { domainHits, nameHits },
        mozillaObservatory: extra?.mozillaObservatory ?? null,
      },
      unchecked: labelUnchecked(scan.uncheckedSources),
    });
  } catch (err) {
    logger.error({ err }, "TPRM vendor findings error");
    res.status(500).json({ error: "Bulgular yüklenemedi" });
  }
});

// POST /api/tprm/vendors/:id/remediation-ack — müşteri yeni tarama sonucunu gördü
router.post("/tprm/vendors/:id/remediation-ack", requireCustomer, async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  const vendor = id ? await getOwnedVendor(req, id) : null;
  if (!vendor) { res.status(404).json({ error: "Bulunamadı" }); return; }
  if (vendor.remediationStatus === "rescanned") await db.update(tprmVendorTable).set({ remediationStatus: "none" }).where(eq(tprmVendorTable.id, id));
  res.json({ ok: true });
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
  const alertsByCustomer = new Map<string, Array<{ vendorId: number; domain: string; score: number; risk: string; reasons: AlertReason[]; own: boolean }>>();

  for (const vendor of vendors) {
    try {
      // Keşif hattı bu domaini son 7 günde taradıysa yeniden taramaya gerek yok.
      const result = await getSupplierScore(vendor.supplierDomain);
      if (!result) { await markScanFailed(vendor); continue; }

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
        list.push({ vendorId: vendor.id, domain: vendor.supplierDomain, score, risk: riskLevel, reasons: decision.reasons, own: vendor.isOwn });
        alertsByCustomer.set(vendor.customerEmail, list);
      }

      // Not: Tedarikçiye CyberStep'ten doğrudan e-posta GÖNDERİLMEZ. Tedarikçi bilgilendirmesi
      // yalnızca ana müşteri üzerinden yapılır (müşteri, tedarikçi bazlı PDF raporu kendisi iletir).
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
    <td style="padding:6px 10px;border-bottom:1px solid #eee"><strong>${escapeHtml(it.domain)}</strong>${it.own ? " (kendi alan adınız)" : ""}</td>
    <td style="padding:6px 10px;border-bottom:1px solid #eee">${it.score}/100 · ${escapeHtml(it.risk)}</td>
    <td style="padding:6px 10px;border-bottom:1px solid #eee">${it.reasons.map(r => escapeHtml(describeReason(r))).join("<br>")}</td>
  </tr>`).join("");
      await sendMail({
        to: customerEmail,
        subject: items.length === 1
          ? `${items[0]!.own ? "Alan adı uyarısı" : "Tedarikçi uyarısı"}: ${items[0]!.domain}`
          : `Uyarı: ${items.length} alan adında önemli değişiklik`,
        html: `<p>Merhaba,</p>
<p>Son taramada tedarikçi portföyünüzde ve alan adlarınızda dikkat gerektiren değişiklikler tespit edildi.</p>
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

// ─── Kanıt belgeleri (tedarikçi yükler, müşteri görür) ───────────────────────
type Rows = { rows?: Record<string, unknown>[] };
const rowsOf = (r: unknown) => (r as Rows).rows ?? [];

router.post("/tprm/questionnaire/:token/evidence", async (req: Request, res: Response) => {
  try {
    const token = req.params["token"] as string;
    const [link] = await db.select().from(tprmQuestionnaireLinkTable).where(eq(tprmQuestionnaireLinkTable.token, token));
    if (!link || new Date() > link.expiresAt) { res.status(404).json({ error: "Geçersiz veya süresi dolmuş bağlantı" }); return; }
    const v = validateEvidence(req.body);
    if (!v.ok) { res.status(400).json({ error: v.error }); return; }
    const cnt = rowsOf(await db.execute(sql`SELECT COUNT(*)::int AS n FROM tprm_evidence WHERE link_id = ${link.id}`))[0]?.["n"] as number;
    if (cnt >= MAX_EVIDENCE_FILES) { res.status(400).json({ error: `En fazla ${MAX_EVIDENCE_FILES} belge yüklenebilir` }); return; }
    const ins = rowsOf(await db.execute(sql`INSERT INTO tprm_evidence (link_id, kind, file_name, mime, size, data)
      VALUES (${link.id}, ${v.kind}, ${v.fileName}, ${v.mime}, ${v.data.length}, ${v.data}) RETURNING id`));
    res.json({ id: ins[0]?.["id"], fileName: v.fileName, kind: v.kind, size: v.data.length });
  } catch (err) {
    logger.error({ err }, "TPRM evidence upload error");
    res.status(500).json({ error: "Belge yüklenemedi" });
  }
});

router.get("/tprm/vendors/:id/evidence", requireCustomer, async (req: Request, res: Response) => {
  try {
    const vendor = await getOwnedVendor(req, parseInt(req.params["id"] as string));
    if (!vendor) { res.status(404).json({ error: "Bulunamadı" }); return; }
    if (!vendor.questionnaireToken) { res.json({ evidence: [] }); return; }
    const rows = rowsOf(await db.execute(sql`SELECT e.id, e.kind, e.file_name, e.mime, e.size, e.created_at
      FROM tprm_evidence e JOIN tprm_questionnaire_links l ON l.id = e.link_id WHERE l.token = ${vendor.questionnaireToken} ORDER BY e.id`));
    res.json({ evidence: rows });
  } catch (err) {
    logger.error({ err }, "TPRM evidence list error");
    res.status(500).json({ error: "Belgeler yüklenemedi" });
  }
});

router.get("/tprm/vendors/:id/evidence/:eid/download", requireCustomer, async (req: Request, res: Response) => {
  try {
    const vendor = await getOwnedVendor(req, parseInt(req.params["id"] as string));
    if (!vendor?.questionnaireToken) { res.status(404).json({ error: "Bulunamadı" }); return; }
    const row = rowsOf(await db.execute(sql`SELECT e.file_name, e.mime, e.data FROM tprm_evidence e
      JOIN tprm_questionnaire_links l ON l.id = e.link_id WHERE e.id = ${parseInt(req.params["eid"] as string)} AND l.token = ${vendor.questionnaireToken}`))[0];
    if (!row) { res.status(404).json({ error: "Bulunamadı" }); return; }
    res.setHeader("Content-Type", String(row["mime"]));
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(String(row["file_name"]))}`);
    res.send(row["data"] as Buffer);
  } catch (err) {
    logger.error({ err }, "TPRM evidence download error");
    res.status(500).json({ error: "İndirilemedi" });
  }
});

// ─── Yazılı onay kaydı (derin değerlendirme kapısı) ──────────────────────────
// Müşteri, KENDİ tedarikçisinden aldığı yazılı onayı (belge) kapsam ve süreyle kaydeder.
// Aktif/derin testler yalnızca geçerli onay varken çalıştırılmalıdır: bkz. vendorHasConsent().
export async function vendorHasConsent(vendorId: number, scope: ConsentScope): Promise<boolean> {
  const rows = rowsOf(await db.execute(sql`SELECT scopes, valid_from, valid_until, revoked_at FROM tprm_consents WHERE vendor_id = ${vendorId}`));
  return hasValidConsent(rows.map((r) => ({
    scopes: (r["scopes"] as string[]) ?? [], validFrom: new Date(r["valid_from"] as string),
    validUntil: new Date(r["valid_until"] as string), revokedAt: r["revoked_at"] ? new Date(r["revoked_at"] as string) : null,
  })), scope);
}

router.get("/tprm/vendors/:id/consents", requireCustomer, async (req: Request, res: Response) => {
  try {
    const vendor = await getOwnedVendor(req, parseInt(req.params["id"] as string));
    if (!vendor) { res.status(404).json({ error: "Bulunamadı" }); return; }
    const rows = rowsOf(await db.execute(sql`SELECT id, scopes, signer_name, signer_title, note, valid_from, valid_until, doc_name, revoked_at, created_at
      FROM tprm_consents WHERE vendor_id = ${vendor.id} ORDER BY id DESC`));
    res.json({ consents: rows, scopeLabels: CONSENT_SCOPES });
  } catch (err) {
    logger.error({ err }, "TPRM consent list error");
    res.status(500).json({ error: "Onaylar yüklenemedi" });
  }
});

router.post("/tprm/vendors/:id/consents", requireCustomer, async (req: Request, res: Response) => {
  try {
    const vendor = await getOwnedVendor(req, parseInt(req.params["id"] as string));
    if (!vendor) { res.status(404).json({ error: "Bulunamadı" }); return; }
    const c = validateConsentInput(req.body);
    if (!c.ok) { res.status(400).json({ error: c.error }); return; }
    const doc = validateEvidence({ ...(req.body as object), kind: "diger" });
    if (!doc.ok) { res.status(400).json({ error: `Onay belgesi: ${doc.error}` }); return; }
    const email = await getSessionCustomerEmail(req);
    const ins = rowsOf(await db.execute(sql`INSERT INTO tprm_consents
      (vendor_id, customer_email, scopes, signer_name, signer_title, note, valid_from, valid_until, doc_name, doc_mime, doc_data)
      VALUES (${vendor.id}, ${email}, ${JSON.stringify(c.value.scopes)}::jsonb, ${c.value.signerName}, ${c.value.signerTitle}, ${c.value.note},
      ${c.value.validFrom}, ${c.value.validUntil}, ${doc.fileName}, ${doc.mime}, ${doc.data}) RETURNING id`));
    await recordEvent(vendor.id, "consent_recorded", { scopes: c.value.scopes, validUntil: c.value.validUntil.toISOString(), signer: c.value.signerName });
    res.json({ id: ins[0]?.["id"] });
  } catch (err) {
    logger.error({ err }, "TPRM consent create error");
    res.status(500).json({ error: "Onay kaydedilemedi" });
  }
});

router.post("/tprm/vendors/:id/consents/:cid/revoke", requireCustomer, async (req: Request, res: Response) => {
  try {
    const vendor = await getOwnedVendor(req, parseInt(req.params["id"] as string));
    if (!vendor) { res.status(404).json({ error: "Bulunamadı" }); return; }
    const upd = rowsOf(await db.execute(sql`UPDATE tprm_consents SET revoked_at = NOW()
      WHERE id = ${parseInt(req.params["cid"] as string)} AND vendor_id = ${vendor.id} AND revoked_at IS NULL RETURNING id`));
    if (!upd.length) { res.status(404).json({ error: "Bulunamadı" }); return; }
    await recordEvent(vendor.id, "consent_revoked", { consentId: upd[0]?.["id"] });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "TPRM consent revoke error");
    res.status(500).json({ error: "İptal edilemedi" });
  }
});

router.get("/tprm/vendors/:id/consents/:cid/download", requireCustomer, async (req: Request, res: Response) => {
  try {
    const vendor = await getOwnedVendor(req, parseInt(req.params["id"] as string));
    if (!vendor) { res.status(404).json({ error: "Bulunamadı" }); return; }
    const row = rowsOf(await db.execute(sql`SELECT doc_name, doc_mime, doc_data FROM tprm_consents WHERE id = ${parseInt(req.params["cid"] as string)} AND vendor_id = ${vendor.id}`))[0];
    if (!row) { res.status(404).json({ error: "Bulunamadı" }); return; }
    res.setHeader("Content-Type", String(row["doc_mime"]));
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(String(row["doc_name"]))}`);
    res.send(row["doc_data"] as Buffer);
  } catch (err) {
    logger.error({ err }, "TPRM consent download error");
    res.status(500).json({ error: "İndirilemedi" });
  }
});

// ─── Tedarikçi aksiyon planı ─────────────────────────────────────────────────
// Müşteri: öneriyi düzenleyip onaylar, tedarikçiye paylaşım bağlantısı verir, kapanışı doğrular, karar kaydeder.
// Tedarikçi: bağlantıdan maddeleri görür, "tamamladım" der. E-posta bildirimi yok (servis hazır olunca eklenecek).

router.get("/tprm/vendors/:id/actions", requireCustomer, async (req: Request, res: Response) => {
  try {
    const vendor = await getOwnedVendor(req, parseInt(req.params["id"] as string));
    if (!vendor) { res.status(404).json({ error: "Bulunamadı" }); return; }
    const actions = rowsOf(await db.execute(sql`SELECT id, source_key, title, detail, due_date, status, supplier_note, supplier_done_at, closed_at, closed_note, created_at
      FROM tprm_actions WHERE vendor_id = ${vendor.id} ORDER BY id`));
    const meta = rowsOf(await db.execute(sql`SELECT action_token, decision, decision_note, decision_at FROM tprm_vendors WHERE id = ${vendor.id}`))[0] ?? {};

    const scanId = vendor.lastScanData && typeof vendor.lastScanData === "object" && "scanId" in vendor.lastScanData
      ? Number((vendor.lastScanData as { scanId: unknown }).scanId) : null;
    const [scan] = scanId ? await db.select().from(domainScansTable).where(eq(domainScansTable.id, scanId)) : [];
    const q = await loadVendorQuestionnaire(vendor).catch(() => null);
    const openKeys = new Set(actions.filter((a) => a["status"] === "open" || a["status"] === "supplier_done").map((a) => String(a["source_key"])));
    const suggestions = suggestActions({
      spfRecord: scan?.spfRecord ?? null, dmarcRecord: scan?.dmarcRecord ?? null,
      cveSummary: (scan?.cveSummary as Array<{ cveId?: string; cvssScore?: number }> | null) ?? null,
      hudsonEmployees: (scan?.tprmExtra as { hudsonRock?: { employees?: number } | null } | null)?.hudsonRock?.employees ?? null,
      answers: q?.status === "completed" ? q.answers.map((a) => ({ questionId: a.questionId, answer: a.answer })) : null,
      interpretation: q?.interpretation ?? null,
      contradictions: q?.contradictions ?? null,
    }).filter((s) => !openKeys.has(s.sourceKey) && (scan || s.sourceKey.startsWith("rf-") || s.sourceKey.startsWith("cx-") || s.sourceKey === "iso"));
    res.json({
      actions, suggestions,
      supplierUrl: meta["action_token"] ? `${appBaseUrl() ? `https://${appBaseUrl()}` : ""}/tprm/aksiyon/${meta["action_token"]}` : null,
      decision: meta["decision"] ?? null, decisionNote: meta["decision_note"] ?? null, decisionAt: meta["decision_at"] ?? null,
    });
  } catch (err) {
    logger.error({ err }, "TPRM actions list error");
    res.status(500).json({ error: "Aksiyonlar yüklenemedi" });
  }
});

router.post("/tprm/vendors/:id/actions", requireCustomer, async (req: Request, res: Response) => {
  try {
    const vendor = await getOwnedVendor(req, parseInt(req.params["id"] as string));
    if (!vendor) { res.status(404).json({ error: "Bulunamadı" }); return; }
    const items = validateActionItems((req.body as { items?: unknown }).items);
    if (!items.length) { res.status(400).json({ error: "Geçerli aksiyon yok" }); return; }
    let created = 0;
    for (const it of items) {
      const dup = it.sourceKey !== "manual" && rowsOf(await db.execute(sql`SELECT 1 FROM tprm_actions WHERE vendor_id = ${vendor.id} AND source_key = ${it.sourceKey} AND status IN ('open','supplier_done')`)).length > 0;
      if (dup) continue;
      await db.execute(sql`INSERT INTO tprm_actions (vendor_id, source_key, title, detail, due_date) VALUES (${vendor.id}, ${it.sourceKey}, ${it.title}, ${it.detail}, ${it.dueDate})`);
      created++;
    }
    await recordEvent(vendor.id, "actions_created", { count: created });
    res.json({ created });
  } catch (err) {
    logger.error({ err }, "TPRM actions create error");
    res.status(500).json({ error: "Aksiyonlar kaydedilemedi" });
  }
});

router.patch("/tprm/vendors/:id/actions/:aid", requireCustomer, async (req: Request, res: Response) => {
  try {
    const vendor = await getOwnedVendor(req, parseInt(req.params["id"] as string));
    if (!vendor) { res.status(404).json({ error: "Bulunamadı" }); return; }
    const status = (req.body as { status?: string }).status;
    if (!status || !(ACTION_STATUSES as readonly string[]).includes(status)) { res.status(400).json({ error: "Geçersiz durum" }); return; }
    const closed = status === "verified" || status === "waived";
    const upd = rowsOf(await db.execute(sql`UPDATE tprm_actions SET status = ${status}, closed_at = ${closed ? new Date() : null}
      WHERE id = ${parseInt(req.params["aid"] as string)} AND vendor_id = ${vendor.id} RETURNING id`));
    if (!upd.length) { res.status(404).json({ error: "Bulunamadı" }); return; }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "TPRM action update error");
    res.status(500).json({ error: "Güncellenemedi" });
  }
});

router.post("/tprm/vendors/:id/actions-share", requireCustomer, async (req: Request, res: Response) => {
  try {
    const vendor = await getOwnedVendor(req, parseInt(req.params["id"] as string));
    if (!vendor) { res.status(404).json({ error: "Bulunamadı" }); return; }
    const cur = rowsOf(await db.execute(sql`SELECT action_token FROM tprm_vendors WHERE id = ${vendor.id}`))[0]?.["action_token"] as string | null;
    const token = cur ?? randomBytes(24).toString("hex");
    if (!cur) await db.execute(sql`UPDATE tprm_vendors SET action_token = ${token} WHERE id = ${vendor.id}`);
    res.json({ url: `${appBaseUrl() ? `https://${appBaseUrl()}` : ""}/tprm/aksiyon/${token}` });
  } catch (err) {
    logger.error({ err }, "TPRM actions share error");
    res.status(500).json({ error: "Bağlantı oluşturulamadı" });
  }
});

router.put("/tprm/vendors/:id/decision", requireCustomer, async (req: Request, res: Response) => {
  try {
    const vendor = await getOwnedVendor(req, parseInt(req.params["id"] as string));
    if (!vendor) { res.status(404).json({ error: "Bulunamadı" }); return; }
    const { decision, note } = req.body as { decision?: string; note?: string };
    if (!decision || !(DECISIONS as readonly string[]).includes(decision)) { res.status(400).json({ error: "Geçersiz karar" }); return; }
    const n = typeof note === "string" && note.trim() ? note.trim().slice(0, 500) : null;
    await db.execute(sql`UPDATE tprm_vendors SET decision = ${decision}, decision_note = ${n}, decision_at = NOW() WHERE id = ${vendor.id}`);
    await recordEvent(vendor.id, "decision_recorded", { decision });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "TPRM decision error");
    res.status(500).json({ error: "Karar kaydedilemedi" });
  }
});

// Tedarikçi tarafı (herkese açık, belirteçle)
async function vendorByActionToken(token: string) {
  const row = rowsOf(await db.execute(sql`SELECT id, supplier_domain, supplier_name, customer_email FROM tprm_vendors WHERE action_token = ${token}`))[0];
  return row ?? null;
}

router.get("/tprm/actions/:token", async (req: Request, res: Response) => {
  try {
    const v = await vendorByActionToken(req.params["token"] as string);
    if (!v) { res.status(404).json({ error: "Geçersiz bağlantı" }); return; }
    const actions = rowsOf(await db.execute(sql`SELECT id, title, detail, due_date, status, supplier_note FROM tprm_actions WHERE vendor_id = ${v["id"] as number} AND status <> 'waived' ORDER BY id`));
    res.json({ supplierDomain: v["supplier_domain"], supplierName: v["supplier_name"], actions });
  } catch (err) {
    logger.error({ err }, "TPRM supplier actions get error");
    res.status(500).json({ error: "Yüklenemedi" });
  }
});

router.post("/tprm/actions/:token/:aid/done", async (req: Request, res: Response) => {
  try {
    const v = await vendorByActionToken(req.params["token"] as string);
    if (!v) { res.status(404).json({ error: "Geçersiz bağlantı" }); return; }
    const note = typeof (req.body as { note?: unknown }).note === "string" ? (req.body as { note: string }).note.trim().slice(0, 500) : null;
    const upd = rowsOf(await db.execute(sql`UPDATE tprm_actions SET status = 'supplier_done', supplier_note = ${note}, supplier_done_at = NOW()
      WHERE id = ${parseInt(req.params["aid"] as string)} AND vendor_id = ${v["id"] as number} AND status = 'open' RETURNING id`));
    if (!upd.length) { res.status(404).json({ error: "Madde bulunamadı veya zaten bildirildi" }); return; }
    await recordEvent(v["id"] as number, "action_supplier_done", { actionId: upd[0]?.["id"] });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "TPRM supplier action done error");
    res.status(500).json({ error: "Kaydedilemedi" });
  }
});

export default router;
