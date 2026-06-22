import { db } from "@workspace/db";
import {
  aiPolicyDocumentsTable,
  aiPolicySubscriptionsTable,
  aiToolsRegistryTable,
  aiMonitoringSubscriptionsTable,
  customersTable,
  assessmentsTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { getClaudeAiFn } from "./ai-client";
import { logger } from "../lib/logger";
import { sendMail } from "./email";
import path from "node:path";
import fs from "node:fs/promises";
import { Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType } from "docx";

const claudeFn = getClaudeAiFn("policy-generator");

function getQuarterLabel(): string {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `Q${q} ${now.getFullYear()} Güncellemesi`;
}

function getNextQuarterDate(): string {
  const now = new Date();
  const month = now.getMonth();
  const nextQStart = [1, 4, 7, 10].find(m => m > month) ?? 1;
  const year = nextQStart === 1 ? now.getFullYear() + 1 : now.getFullYear();
  return new Date(year, nextQStart - 1, 1).toISOString().split("T")[0]!;
}

export async function generatePolicyDocument(
  customerId: number,
  reason: "initial" | "quarterly_update" | "tool_change" | "manual_request",
  triggeredByToolIds: number[] = []
): Promise<typeof aiPolicyDocumentsTable.$inferSelect> {
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, customerId));
  if (!customer) throw new Error("Customer not found");

  // Get sector/employeeCount from latest assessment by customer email
  const [latestAssessment] = await db.select({ sector: assessmentsTable.sector, employeeCount: assessmentsTable.employeeCount })
    .from(assessmentsTable)
    .where(eq(assessmentsTable.email, customer.email))
    .orderBy(desc(assessmentsTable.createdAt))
    .limit(1);
  const sector = latestAssessment?.sector ?? null;
  const employeeCount = latestAssessment?.employeeCount ?? null;

  // Get monitored tools from monitoring subscription or all tools
  const [monSub] = await db.select().from(aiMonitoringSubscriptionsTable).where(eq(aiMonitoringSubscriptionsTable.customerId, customerId));
  let toolIds: number[] = monSub?.monitoredToolIds ?? [];
  let tools = toolIds.length > 0
    ? await db.select().from(aiToolsRegistryTable).where(eq(aiToolsRegistryTable.id, toolIds[0]!))
    : await db.select().from(aiToolsRegistryTable).limit(20);

  if (toolIds.length > 1) {
    tools = await db.select().from(aiToolsRegistryTable);
    tools = tools.filter(t => toolIds.includes(t.id));
  }
  if (tools.length === 0) {
    tools = await db.select().from(aiToolsRegistryTable).limit(20);
  }

  const criticalTools = tools.filter(t => t.riskLevel === "KRITIK");
  const highRiskTools = tools.filter(t => t.riskLevel === "YUKSEK");
  const approvedTools = tools.filter(t => ["DUSUK", "ORTA"].includes(t.riskLevel ?? ""));

  const [prevPolicy] = await db.select()
    .from(aiPolicyDocumentsTable)
    .where(eq(aiPolicyDocumentsTable.customerId, customerId))
    .orderBy(desc(aiPolicyDocumentsTable.createdAt))
    .limit(1);

  const today = new Date().toLocaleDateString("tr-TR");
  const prompt = `Sen deneyimli bir KVKK hukuk danışmanısın ve siber güvenlik uzmanısın.
Aşağıdaki şirket için "Yapay Zeka Araçları Kabul Edilebilir Kullanım Politikası" hazırla.

ŞİRKET BİLGİLERİ:
Şirket adı: ${customer.companyName ?? "Şirket"}
Sektör: ${sector ?? "Belirtilmemiş"}
Çalışan sayısı: ${employeeCount ?? "Belirtilmemiş"}
Politika tarihi: ${today}

ONAYLANAN AI ARAÇLARI (kullanılabilir):
${approvedTools.map(t => `- ${t.toolName} (${t.provider}): ${t.recommendation ?? ""}`).join("\n") || "- Henüz onaylı araç belirlenmemiş"}

KISITLI ARAÇLAR (sadece kurumsal plan ile):
${highRiskTools.map(t => `- ${t.toolName}: ${t.riskSummary ?? ""}`).join("\n") || "- Yok"}

YASAKLI ARAÇLAR:
${criticalTools.map(t => `- ${t.toolName}: ${t.riskSummary ?? ""}`).join("\n") || "- Yok"}

KVKK BAĞLAMI:
- Bu şirket KVKK kapsamında veri işleyen bir firmadır
- AI araçlarına kişisel veri girişi yurt dışı aktarım sayılır (KVKK Md.9)
- Özel nitelikli veri girişi kesinlikle yasaktır

Politika şu bölümleri içermeli:

1. AMAÇ VE KAPSAM
2. TANIMLAR (yapay zeka aracı, kişisel veri, özel nitelikli kişisel veri)
3. ONAYLANAN ARAÇLAR VE KULLANIM KOŞULLARI
4. YASAK UYGULAMALAR (kişisel veri, finansal veri, gizli belge, ses/görüntü, sözleşme girişi yasak)
5. KVKK YÜKÜMLÜLÜKLERİ (yurt dışı aktarım, açık rıza, VERBİS)
6. ÇALIŞAN SORUMLULUKLARI VE YETKİLENDİRME
7. İHLAL DURUMUNDA PROSEDÜR (72 saatlik KVKK bildirimi)
8. POLİTİKA GÜNCELLEME ("Bu politika CyberStep.io AI İzleme Servisi tarafından otomatik olarak güncellenmektedir.")

FORMAT GEREKLİLİKLERİ:
- Türkçe, anlaşılır dil (lise mezunu anlayabilmeli)
- Hukuki ama erişilebilir
- İmzalanmaya hazır format
- Her bölüm numaralı
- Yürürlük tarihi: ${today}
- Toplam 700-900 kelime

SADECE POLİTİKA METNİNİ DÖNDÜR, başka açıklama ekleme.`;

  const policyText = await claudeFn(prompt);

  let changesSummary = "İlk versiyon — şirketinize özel AI kullanım politikası oluşturuldu.";
  let changedSections: string[] = [];

  if (prevPolicy) {
    const diffPrompt = `Önceki politika:
${prevPolicy.policyText.substring(0, 2000)}

Yeni politika:
${policyText.substring(0, 2000)}

Bu iki politika arasındaki farkları özetle:
1. Hangi bölümler değişti?
2. En önemli değişiklik nedir?
3. Çalışanlar için ne değişti?

Türkçe, 2-3 cümle, yönetici özeti formatında. Sadece özet metni döndür.`;
    try {
      changesSummary = await claudeFn(diffPrompt);
    } catch { /* keep default */ }
    changedSections = detectChangedSections(prevPolicy.policyText, policyText);
  }

  const newVersion = (prevPolicy?.version ?? 0) + 1;
  const versionLabel = `v${newVersion}.0 — ${getQuarterLabel()}`;

  const [doc] = await db.insert(aiPolicyDocumentsTable).values({
    customerId,
    version: newVersion,
    versionLabel,
    policyText,
    policyHtml: policyTextToHtml(policyText),
    coveredToolIds: tools.map(t => t.id),
    generationReason: reason,
    triggeredByToolIds,
    changesSummary,
    changedSections,
    status: "draft",
    nextUpdateDate: getNextQuarterDate(),
    subscriptionActive: true,
  }).returning();

  if (!doc) throw new Error("Failed to save policy document");

  // Generate DOCX
  try {
    const docxBuffer = await generateDOCXBuffer(policyText, customer.companyName ?? "Şirket", versionLabel);
    const docxDir = path.join(process.cwd(), "uploads", "policies");
    await fs.mkdir(docxDir, { recursive: true });
    const docxFilename = `policy_${doc.id}_v${newVersion}.docx`;
    await fs.writeFile(path.join(docxDir, docxFilename), docxBuffer);
    await db.update(aiPolicyDocumentsTable)
      .set({ docxPath: `/uploads/policies/${docxFilename}` })
      .where(eq(aiPolicyDocumentsTable.id, doc.id));
    doc.docxPath = `/uploads/policies/${docxFilename}`;
  } catch (err) {
    logger.error({ err }, "DOCX generation failed");
  }

  return doc;
}

function detectChangedSections(prev: string, next: string): string[] {
  const sections = ["AMAÇ", "TANIMLAR", "ONAYLANAN", "YASAK", "KVKK", "ÇALIŞAN", "İHLAL", "GÜNCELLEME"];
  return sections.filter(s => {
    const prevIdx = prev.indexOf(s);
    const nextIdx = next.indexOf(s);
    if (prevIdx < 0 || nextIdx < 0) return false;
    const prevChunk = prev.substring(prevIdx, prevIdx + 400);
    const nextChunk = next.substring(nextIdx, nextIdx + 400);
    return prevChunk !== nextChunk;
  });
}

function policyTextToHtml(text: string): string {
  return text
    .split("\n")
    .map(line => {
      if (/^\d+\.\s+[A-ZÇĞİÖŞÜ]/.test(line)) return `<h3>${line}</h3>`;
      if (line.startsWith("- ")) return `<li>${line.slice(2)}</li>`;
      if (line.trim() === "") return "<br>";
      return `<p>${line}</p>`;
    })
    .join("\n");
}

async function generateDOCXBuffer(policyText: string, companyName: string, version: string): Promise<Buffer> {
  const lines = policyText.split("\n");
  const children: Paragraph[] = [
    new Paragraph({ text: companyName, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
    new Paragraph({ text: "YAPAY ZEKA ARAÇLARI KABUL EDİLEBİLİR KULLANIM POLİTİKASI", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
    new Paragraph({ text: version, alignment: AlignmentType.CENTER }),
    new Paragraph({ text: "" }),
  ];

  for (const line of lines) {
    if (line.trim() === "") {
      children.push(new Paragraph({ text: "" }));
    } else if (/^\d+\.\s+[A-ZÇĞİÖŞÜ]/.test(line)) {
      children.push(new Paragraph({ text: line, heading: HeadingLevel.HEADING_2 }));
    } else if (line.startsWith("- ")) {
      children.push(new Paragraph({ text: line.slice(2), bullet: { level: 0 } }));
    } else {
      children.push(new Paragraph({ children: [new TextRun({ text: line })] }));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  return await Packer.toBuffer(doc);
}

export async function runQuarterlyPolicyUpdate(): Promise<void> {
  const subs = await db.select().from(aiPolicySubscriptionsTable).where(eq(aiPolicySubscriptionsTable.status, "active"));
  for (const sub of subs) {
    if (!sub.autoGenerate) continue;
    try {
      const doc = await generatePolicyDocument(sub.customerId, "quarterly_update");
      await notifyPolicyUpdate(sub.customerId, doc, "quarterly_update");
    } catch (err) {
      logger.error({ err, customerId: sub.customerId }, "Quarterly policy update failed");
    }
  }
}

export async function notifyPolicyUpdate(
  customerId: number,
  doc: typeof aiPolicyDocumentsTable.$inferSelect,
  reason: string
): Promise<void> {
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, customerId));
  if (!customer) return;
  const reasonLabel = reason === "quarterly_update" ? "Çeyreklik otomatik güncelleme" : reason === "tool_change" ? "Kullandığınız bir AI aracının politikası değişti" : "Manuel güncelleme";
  await sendMail({
    to: customer.email,
    subject: `AI Kullanım Politikanız Güncellendi — ${doc.versionLabel ?? `v${doc.version}`} Hazır`,
    html: `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #1e293b;">Yapay Zeka Kullanım Politikanız Güncellendi</h2>
  <p>Sayın ${customer.companyName ?? "Müşteri"},</p>
  <p>Şirketinizin Yapay Zeka Kullanım Politikası otomatik olarak güncellendi.</p>
  <p><strong>Güncelleme nedeni:</strong> ${reasonLabel}</p>
  <div style="border-left: 4px solid #2563eb; padding: 12px 16px; margin: 16px 0; background: #f8fafc;">
    <strong>Bu versiyonda ne değişti:</strong><br>${doc.changesSummary ?? ""}
  </div>
  <p><strong>Yapmanız gereken:</strong></p>
  <ol>
    <li>Politikayı inceleyin</li>
    <li>Onaylayın</li>
    <li>Çalışanlarınıza dağıtın ve imzalatın</li>
  </ol>
  <p><a href="https://cyberstep.io/ai-politika">Politikayı İncele ve Onayla →</a></p>
  <hr style="margin: 24px 0;">
  <p style="color: #64748b; font-size: 12px;">CyberStep AI Politika Servisi — Bir sonraki otomatik güncelleme: ${doc.nextUpdateDate ?? getNextQuarterDate()}</p>
</div>`,
  }).catch(() => {});
}
