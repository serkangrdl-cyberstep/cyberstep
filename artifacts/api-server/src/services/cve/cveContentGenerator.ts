import { callModel } from "@workspace/ai";
import { db, cveTrackerTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger";
import type { CVEEntry } from "./cveFeedReader";
import type { TurkeyImpactResult } from "./turkeyImpactAnalyzer";

const SYSTEM_PROMPT = `Sen CyberStep.io'nun baş güvenlik analistisin.
Teknik bilgiyi iş diline çeviriyorsun.
Abartmıyor, ama gerçeği net söylüyorsun.
Türkçe yazıyorsun.
Hiçbir şirketi ismiyle anmıyorsun.
Emoji kullanmıyorsun.`;

async function callClaude(userPrompt: string, maxTokens = 800): Promise<string> {
  try {
    return await callModel({
      task: "cve-content",
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      maxTokens,
    });
  } catch (err) {
    logger.warn({ err }, "Claude çağrısı başarısız");
    return "";
  }
}

export async function generateCVEContent(cve: CVEEntry, impact: TurkeyImpactResult): Promise<void> {
  const impactLevel =
    impact.totalAffected >= 500 ? "yaygın" :
    impact.totalAffected >= 100 ? "önemli" :
    impact.totalAffected >= 20  ? "sınırlı" : "az";

  const worstSector = Object.entries(impact.sectorBreakdown)
    .sort(([, a], [, b]) => b - a)[0]?.[0] ?? "bilinmiyor";

  const cveContext = `
CVE Bilgisi:
  ID: ${cve.cveId}
  CVSS: ${cve.cvssScore ?? "bilinmiyor"} — ${cve.severity?.toUpperCase()}
  Başlık: ${cve.title}
  Açıklama: ${cve.description?.slice(0, 500)}
  Etkilenen ürünler: ${cve.affectedProducts.map(p => `${p.vendor} ${p.product}`).join(", ")}
  Yama: ${cve.patchAvailable ? "Mevcut" : "Henüz yok"}
  Exploit kamuya açık: ${cve.exploitPublic ? "EVET" : "Hayır"}
  CISA KEV: ${cve.cisaKev ? "EVET — aktif istismar ediliyor" : "Hayır"}

Türkiye Etkisi:
  Etkilenen domain: ${impact.totalAffected}
  Kritik risk: ${impact.criticalAffected}
  En fazla etkilenen sektör: ${worstSector}
  Etki seviyesi: ${impactLevel}`;

  const analysisPrompt = `${cveContext}

Görev: Bu CVE için Türkiye odaklı güvenlik özeti yaz.

Bölümler (başlıklar olmadan, akıcı metin olarak):
1. Yönetici özeti — tek paragraf, patron anlasın
2. Teknik açıklama — IT ekibi anlasın  
3. Türkiye'deki durum — sayılarla, sektör bilgisiyle
4. Acil yapılacaklar — 4-5 maddeli liste (- ile başlayan)
5. NVD kaynağı — https://nvd.nist.gov/vuln/detail/${cve.cveId}

Maksimum 350 kelime.`;

  const linkedinPrompt = `${cveContext}

Görev: LinkedIn paylaşımı yaz. Maksimum 1200 karakter.
Zorunlular:
- CVSS skoru ve ürün adı ile başla
- Türkiye'deki etkilenen domain sayısı
- En kritik 1-2 öneri
- "Etkileniyor musunuz? cyberstep.io adresinden ücretsiz kontrol edin" CTA
- 4-5 hashtag (#siberguvenlik #CVE #cybersecurity vb.)
Ton: Acil ama panikletme. Somut veri.`;

  const xPrompt = `${cveContext}

Görev: 5 tweet'lik X/Twitter thread yaz. Her tweet max 280 karakter.
Tweet 1: Duyuru — CVSS + ürün + TR etki sayısı
Tweet 2: CVE teknik özet
Tweet 3: Türkiye'deki etki detayı
Tweet 4: Acil yapılacaklar (top 2-3)
Tweet 5: Link CTA — cyberstep.io/${cve.cveId.toLowerCase()}

Tweet'leri boş satırla ayır. Numara ekleme.`;

  const pressPrompt = `${cveContext}

Görev: Gazeteciye yönelik 80 kelimelik basın notu yaz.
Teknik jargon yok. Türkiye etkisini ön plana çıkar. CyberStep'in verilerini kaynak göster.`;

  logger.info({ cveId: cve.cveId }, "CVE içerik üretimi başlıyor");

  const [analysis, linkedin, xRaw, press] = await Promise.all([
    callClaude(analysisPrompt, 900),
    callClaude(linkedinPrompt, 400),
    callClaude(xPrompt, 600),
    callClaude(pressPrompt, 200),
  ]);

  const tweets = xRaw
    .split(/\n\n+/)
    .filter(t => t.trim().length > 0)
    .map((content, i) => ({ tweetNo: i + 1, content: content.trim().slice(0, 280) }));

  const emailSubject = `${cve.cveId} — Türkiye'de ${impact.totalAffected} domain etkileniyor (CVSS ${cve.cvssScore ?? "?"})`;

  await db.update(cveTrackerTable).set({
    trAnalysis: analysis,
    linkedinPost: linkedin,
    xThread: tweets,
    emailSubject,
    pressNote: press,
    status: "analyzed",
  }).where(eq(cveTrackerTable.cveId, cve.cveId));

  logger.info({ cveId: cve.cveId, tweets: tweets.length }, "CVE içerik üretimi tamamlandı");
}
