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

  const prompt = `Sen CyberStep.io adına yazıyorsun. Türk KOBİ'lere siber güvenlik hizmeti sunuyoruz.
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
