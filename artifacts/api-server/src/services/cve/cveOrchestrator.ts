import { db, cveTrackerTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { checkNewCVEs, enrichWithNVD } from "./cveFeedReader";
import { analyzeTurkeyImpact, classifyCveProduct } from "./turkeyImpactAnalyzer";
import { generateCVEContent } from "./cveContentGenerator";
import { notifyAffectedDomains } from "./cveNotifier";
import { sendMail } from "../email";
import type { CVEEntry } from "./cveFeedReader";

const ADMIN_EMAIL = process.env["SOC_ADMIN_EMAIL"] ?? "serkangrdl@gmail.com";
const MIN_CVSS = 8.0;
const MIN_TR_DOMAINS_DEFAULT = 5;

export async function processCVE(cveEntry: CVEEntry): Promise<void> {
  logger.info({ cveId: cveEntry.cveId, cvss: cveEntry.cvssScore }, "CVE işleniyor");

  // 1. Kaydet
  await db.insert(cveTrackerTable).values({
    cveId: cveEntry.cveId,
    cvssScore: cveEntry.cvssScore !== null ? String(cveEntry.cvssScore) : undefined,
    cvssVector: cveEntry.cvssVector,
    severity: cveEntry.severity,
    title: cveEntry.title,
    description: cveEntry.description,
    affectedProducts: cveEntry.affectedProducts as Record<string, unknown>[],
    nvdPublishedAt: cveEntry.nvdPublishedAt,
    patchAvailable: cveEntry.patchAvailable,
    patchUrl: cveEntry.patchUrl,
    exploitPublic: cveEntry.exploitPublic,
    cisaKev: cveEntry.cisaKev,
    status: "detected",
  }).onConflictDoNothing();

  // KEV'den geldiyse CVSS'i NVD'den zenginleştir
  if (cveEntry.cisaKev && !cveEntry.cvssScore) {
    const enriched = await enrichWithNVD(cveEntry.cveId);
    if (enriched.cvssScore) {
      await db.update(cveTrackerTable).set({
        cvssScore: String(enriched.cvssScore),
        cvssVector: enriched.cvssVector,
        patchAvailable: enriched.patchAvailable,
        patchUrl: enriched.patchUrl,
      }).where(eq(cveTrackerTable.cveId, cveEntry.cveId));
      cveEntry = { ...cveEntry, ...enriched };
    }
  }

  // 2. Türkiye etkisi
  const impact = await analyzeTurkeyImpact(cveEntry);

  // 3. Etki eşiği kontrolü
  const minThreshold = cveEntry.cisaKev ? MIN_TR_DOMAINS_DEFAULT : 20;
  if (impact.totalAffected < minThreshold) {
    await db.update(cveTrackerTable).set({
      status: "skipped",
      skipReason: `Türkiye etkisi düşük: ${impact.totalAffected} domain`,
    }).where(eq(cveTrackerTable.cveId, cveEntry.cveId));
    logger.info({ cveId: cveEntry.cveId, affected: impact.totalAffected }, "CVE atlandı — düşük TR etkisi");
    return;
  }

  // 4. İçerik üret (Claude)
  await generateCVEContent(cveEntry, impact);

  // 5. Etkilenen şirketlere bildirim
  await notifyAffectedDomains(cveEntry.cveId);

  // 6. Admin bildirimi
  try {
    await sendMail({
      to: ADMIN_EMAIL,
      subject: `Yeni CVE: ${cveEntry.cveId} — Türkiye'de ${impact.totalAffected} domain`,
      html: `
<div style="font-family:monospace;background:#0a0a0a;color:#e0e0e0;padding:24px;border-radius:8px">
<h3 style="color:#ff4560;margin:0 0 16px">Yeni CVE Tespit</h3>
<pre style="color:#00c8ff">CVE: ${cveEntry.cveId}
CVSS: ${cveEntry.cvssScore ?? "?"} — ${(cveEntry.severity ?? "").toUpperCase()}
TR Etki: ${impact.totalAffected} domain (${impact.criticalAffected} kritik)
CISA KEV: ${cveEntry.cisaKev ? "EVET" : "Hayır"}
Exploit: ${cveEntry.exploitPublic ? "EVET" : "Hayır"}
Yama: ${cveEntry.patchAvailable ? "Mevcut" : "Yok"}</pre>
<p style="color:#a0a0a0">İçerik hazır. Onay için admin paneline bakın.</p>
</div>`,
    });
  } catch (e) {
    logger.warn({ err: e }, "Admin CVE bildirimi gönderilemedi");
  }

  logger.info({ cveId: cveEntry.cveId, affected: impact.totalAffected }, "CVE işleme tamamlandı");
}

export async function runCVEFeedCheck(): Promise<void> {
  logger.info("CVE feed kontrol ediliyor");
  let newCVEs = await checkNewCVEs();

  // CVSS < MIN_CVSS olanları filtrele (CISA KEV bypass)
  newCVEs = newCVEs.filter(c => !c.cvssScore || c.cvssScore >= MIN_CVSS || c.cisaKev);

  // Ürün kategorisi filtresi: browser/hardware/mobile CVE'leri hiçbir zaman işleme
  // Not: CISA KEV mobile filtrelemesi cveFeedReader'da yapılır; bu katman ek güvence sağlar.
  newCVEs = newCVEs.filter(c => {
    if (c.affectedProducts.length === 0) return true; // ürün bilgisi yoksa geç
    return c.affectedProducts.some(p => {
      const cat = classifyCveProduct(p.vendor ?? "", p.product ?? "");
      return !["browser", "hardware", "mobile"].includes(cat);
    });
  });

  if (newCVEs.length === 0) {
    logger.info("Yeni CVE bulunamadı");
    return;
  }

  logger.info({ count: newCVEs.length }, "Yeni CVE bulundu");

  // CISA KEV önce, sonra CVSS'e göre sırala
  newCVEs.sort((a, b) => {
    if (a.cisaKev && !b.cisaKev) return -1;
    if (!a.cisaKev && b.cisaKev) return 1;
    return (b.cvssScore ?? 0) - (a.cvssScore ?? 0);
  });

  for (const cve of newCVEs) {
    await processCVE(cve);
    await new Promise(r => setTimeout(r, 5000));
  }
}
