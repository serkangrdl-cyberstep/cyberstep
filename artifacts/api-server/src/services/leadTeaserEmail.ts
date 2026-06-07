/**
 * Claude-powered teaser email generation for discovered leads.
 */
import { db } from "@workspace/db";
import { leadCandidatesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { logger } from "../lib/logger";

export async function generateLeadTeaserEmail(
  candidateId: number,
  scanResult: { overallScore: number; findings: Array<{ severity: string; title: string }> },
): Promise<void> {
  const [candidate] = await db.select().from(leadCandidatesTable)
    .where(eq(leadCandidatesTable.id, candidateId));
  if (!candidate) return;

  const criticals = scanResult.findings.filter((f) => f.severity === "critical").slice(0, 3);
  const highs = scanResult.findings.filter((f) => f.severity === "high").slice(0, 2);
  const topFindings = [...criticals, ...highs].map((f) => `- ${f.title}`).join("\n");

  const prompt = `## Türkiye Siber Güvenlik Pazar Verileri (Fortinet/DORinsight 2025)
- Türkiye'deki kurumların %65,2'si son 12 ayda en az bir siber saldırıya uğradı
- Saldırıya maruz kalanlar ortalama 14,6 farklı saldırıyla karşılaştı
- Kurumların %40,9'u mevcut güvenlik altyapısının yetersiz olduğunu düşünüyor
- %53,3'ü nitelikli uzman eksikliği nedeniyle güvenlik seviyesini artıramıyor
- %44,3'ü OT güvenlik seviyesini "yetersiz" veya "gelişmekte" olarak değerlendiriyor
- %88'i AI tabanlı güvenlik çözümlerini kullanıyor veya kullanmayı planlıyor
- %68,7'si önümüzdeki dönemde düzenlemelerin artacağını öngörüyor
Kaynak: Fortinet Türkiye / DORinsight 2025 Türkiye Siber Güvenlik Araştırması.
Bu istatistiklere (özellikle "%65 saldırı oranı", "uzman eksikliği", "AI güvenlik ilgisi") teaser e-postada atıf yapabilirsin.

Sen CyberStep.io adına yazıyorsun. Türk işletmelere siber güvenlik hizmeti sunuyoruz.
Aşağıdaki şirket için kısa, profesyonel bir teaser e-posta yaz.

Şirket: ${candidate.domain}
${candidate.companyName ? `Şirket Adı: ${candidate.companyName}` : ""}
${candidate.contactName ? `İletişim: ${candidate.contactName}${candidate.contactTitle ? ` (${candidate.contactTitle})` : ""}` : ""}
${candidate.city ? `Şehir: ${candidate.city}` : ""}
Siber Risk Skoru: ${scanResult.overallScore}/100
${candidate.hasFortigate ? "Not: Fortinet/FortiGate cihazı tespit edildi." : ""}

Tespit edilen güvenlik açıkları:
${topFindings || "- Çeşitli güvenlik zafiyetleri tespit edildi"}

Kurallar:
1. E-posta 3 paragraf olsun (max 150 kelime)
2. İlk paragraf: Kısa tanıtım ve neden yazdığımız (spesifik bulgu)
3. İkinci paragraf: CyberStep'in ücretsiz değerlendirmesi
4. Üçüncü paragraf: Tek CTA — "cyberstep.io'dan ücretsiz değerlendirmenizi başlatın"
5. Kesinlikle emoji kullanma
6. Abartılı satış dili kullanma
7. JSON formatında döndür: { "subject": "...", "body": "..." }`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content[0]?.type === "text" ? message.content[0].text : "";
    const jsonMatch = raw.match(/\{[\s\S]*"subject"[\s\S]*"body"[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON parse edilemedi");

    const parsed = JSON.parse(jsonMatch[0]) as { subject?: string; body?: string };

    await db.update(leadCandidatesTable).set({
      teaserSubject: parsed.subject ?? `${candidate.domain} — Siber Güvenlik Değerlendirmesi`,
      teaserBody: parsed.body ?? raw,
      teaserGeneratedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(leadCandidatesTable.id, candidateId));

    logger.info({ candidateId, domain: candidate.domain }, "Teaser üretildi");
  } catch (e) {
    logger.warn({ candidateId, err: String(e) }, "Teaser üretim hatası");
    throw e;
  }
}
