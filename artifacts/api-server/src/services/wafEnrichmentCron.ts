import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../lib/logger";

// ─── Sabitler ────────────────────────────────────────────────────────────────
const BATCH_LIMIT = 50;      // Tek cron run'ında atomik olarak claim edilen satır
const CONCURRENCY = 3;       // Aynı anda çalışan detectWAF çağrısı
const WAF_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;      // Bu kadar timeout sonrası 'unknown_timeout' olarak işaretlenir

// ─── Tipler ──────────────────────────────────────────────────────────────────
interface ClaimedRow { id: number; domain: string }

interface WafCallResult {
  timedOut: boolean;
  detected: boolean | null;
  provider: string | null;
  confidence: number | null;
}

// ─── detectWAF Wrapper: timeout ile gerçek sonucu ayırt eder ─────────────────
// Kritik tasarım kararı: detectWAF() 15s'de kendi kendine tamamlanabilir (iç
// timeout'ları: 8s + 5s + 5s = 18s). Outer Promise.race, 15s'yi geçen
// durumları yakalar. Gerçek sonuç (detected=true/false) ile "bilinmiyor çünkü
// timeout" arasındaki fark: timedOut bayrağı. Sadece timedOut===false olduğunda
// waf_enriched_at set edilir — tam olarak lead_score'daki score=30 ambiguity
// hatasının WAF karşılığı olan hatanın önlenmesi.
async function detectWafWithStatus(domain: string): Promise<WafCallResult> {
  let timedOut = false;

  const { detectWAF } = await import("./wafDetector");

  const timeoutP = new Promise<null>((resolve) =>
    setTimeout(() => { timedOut = true; resolve(null); }, WAF_TIMEOUT_MS)
  );

  const wafP = detectWAF(domain)
    .then((r) => r)
    .catch(() => null); // detectWAF'ın uncaught hatası da timeout gibi işlenir

  const result = await Promise.race([wafP, timeoutP]);

  if (timedOut || result === null) {
    return { timedOut: true, detected: null, provider: null, confidence: null };
  }

  return {
    timedOut: false,
    detected: result.detected,
    provider: result.provider,
    confidence: result.confidence,
  };
}

// ─── Tek satırı işle ─────────────────────────────────────────────────────────
async function processRow(row: ClaimedRow): Promise<void> {
  const { timedOut, detected, provider, confidence } = await detectWafWithStatus(row.domain);

  if (timedOut) {
    // waf_enriched_at YAZILMAZ — bu "WAF yok" anlamına gelmez, geçici bilinmez.
    // waf_enriching_started_at temizlenir ki 30 dakika stale guard içinde
    // başka bir run bu satırı tekrar alabilsin.
    await db.execute(sql`
      UPDATE lead_candidates
      SET
        waf_enriching_started_at = NULL,
        waf_enrichment_attempts  = waf_enrichment_attempts + 1,
        waf_enrichment_status    = CASE
          WHEN waf_enrichment_attempts + 1 >= ${MAX_ATTEMPTS}
            THEN 'unknown_timeout'
          ELSE waf_enrichment_status
        END
      WHERE id = ${row.id}
    `);
    logger.warn(
      { domain: row.domain },
      "WAF enrichment: timeout — satır serbest bırakıldı, bir sonraki run yeniden dener"
    );
    return;
  }

  // Gerçek sonuç (detected=true veya false, ama timeout değil) — şimdi kaydet.
  await db.execute(sql`
    UPDATE lead_candidates
    SET
      waf_detected             = ${detected},
      waf_provider             = ${provider},
      waf_confidence           = ${confidence},
      waf_enriched_at          = NOW(),
      waf_enrichment_status    = 'enriched',
      waf_enriching_started_at = NULL
    WHERE id = ${row.id}
  `);

  logger.info(
    { domain: row.domain, detected, provider, confidence },
    "WAF enrichment: tamamlandı"
  );
}

// ─── Ana cron fonksiyonu ──────────────────────────────────────────────────────
export async function runWafEnrichmentCron(): Promise<number> {
  // Atomik claim: SELECT ... FOR UPDATE SKIP LOCKED + UPDATE tek sorguda.
  // İki cron run'ı aynı anda başlarsa, SKIP LOCKED sayesinde her biri
  // farklı satır kümesini alır — check-then-act race condition yok.
  const claimResult = await db.execute(sql`
    UPDATE lead_candidates
    SET waf_enriching_started_at = NOW()
    WHERE id IN (
      SELECT id FROM lead_candidates
      WHERE waf_enriched_at IS NULL
        AND waf_enrichment_status IS DISTINCT FROM 'unknown_timeout'
        AND (
          waf_enriching_started_at IS NULL
          OR waf_enriching_started_at < NOW() - INTERVAL '30 minutes'
        )
      ORDER BY id
      LIMIT ${BATCH_LIMIT}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, domain
  `);

  const rows = (claimResult.rows ?? []) as unknown as ClaimedRow[];

  if (rows.length === 0) {
    logger.info("WAF enrichment: bekleyen satır yok");
    return 0;
  }

  logger.info({ count: rows.length }, "WAF enrichment: satırlar claim edildi");

  // CONCURRENCY kadar aynı anda işle — her batch tamamlanmadan sıradaki başlamaz.
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map((row) => processRow(row)));
  }

  logger.info({ count: rows.length }, "WAF enrichment: batch tamamlandı");
  return rows.length;
}
