import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  boardReportsTable,
  boardReportRecipientsTable,
  customersTable,
  domainScansTable,
} from "@workspace/db";
import { eq, desc, and, or, isNull, lt } from "drizzle-orm";
import { requireCustomer, getCustomerId, requireAdmin } from "../../middleware/auth";
import { logger } from "../../lib/logger";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { sendMail } from "../../services/email";

const router = Router();

function getBaseUrl(): string {
  const domains = process.env["REPLIT_DOMAINS"];
  return domains ? `https://${domains.split(",")[0]?.trim()}` : "http://localhost:80";
}

// ─── Generation claim (compare-and-set) ──────────────────────────────────────

const STALE_MS = 4 * 60 * 1000; // 4 minutes

/**
 * Atomically transition a board report into "generating" iff eligible:
 * "failed_generation" status, or a stale "generating" whose startedAt is older
 * than STALE_MS (i.e. orphaned by a server restart). Returns true only to the
 * winner so the caller knows whether to launch the background job.
 */
async function claimBoardReportGeneration(reportId: number): Promise<boolean> {
  const staleCutoff = new Date(Date.now() - STALE_MS);
  const claimed = await db.update(boardReportsTable)
    .set({ status: "generating", generationStartedAt: new Date() })
    .where(and(
      eq(boardReportsTable.id, reportId),
      or(
        eq(boardReportsTable.status, "failed_generation"),
        and(
          eq(boardReportsTable.status, "generating"),
          or(isNull(boardReportsTable.generationStartedAt), lt(boardReportsTable.generationStartedAt, staleCutoff)),
        ),
      ),
    ))
    .returning({ id: boardReportsTable.id });
  return claimed.length > 0;
}

// ─── AI Report Generation ─────────────────────────────────────────────────────

interface BoardReportAI {
  executiveSummary: string;
  riskHeadline: string;
  scoreNarrative: string;
  keyAchievements: string[];
  keyRisks: Array<{ risk: string; businessImpact: string; urgency: string }>;
  requiredDecisions: string[];
  kvkkStatus: string;
  competitorContext: string;
  nextMonthFocus: string;
}

async function generateBoardReportAI(reportData: Record<string, unknown>): Promise<BoardReportAI> {
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3000,
    system: `Sen kurumsal bir siber guvenlik danismanisin. Sirkette Yonetim Kurulu icin aylik siber guvenlik brifingini hazirliyor.
KURAL: Teknik jargon yasak. Port, CVE, DMARC gibi terimler kullanma. Her teknik terimi is etkisiyle acikla. Yalnizca JSON don.`,
    messages: [{
      role: "user",
      content: `SIRKET VERİLERİ: ${JSON.stringify(reportData, null, 2)}

JSON formatinda rapor uret:
{
  "executiveSummary": "3-4 cumle. CEO'ya hitap. Bu ay siber guvenlik acisından ne oldu.",
  "riskHeadline": "Tek cümle, carpici, yonetici duzeyinde.",
  "scoreNarrative": "Skor degisimini is diliyle anlat.",
  "keyAchievements": ["Bu ay kapatilan onemli riskler (maks 3)"],
  "keyRisks": [{"risk": "Teknik olmayan aciklama","businessImpact": "Is etkisi","urgency": "Bu ay|Gelecek ay|3 ay icinde"}],
  "requiredDecisions": ["Yonetim karari gerektiren konular"],
  "kvkkStatus": "KVKK uyum durumu 1-2 cumle.",
  "competitorContext": "Sektor karsilastirmasi 1 cumle.",
  "nextMonthFocus": "Gelecek ay odak noktasi."
}`
    }],
  });

  const block = msg.content[0];
  const text = block?.type === "text" ? block.text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI parse failed");
  return JSON.parse(jsonMatch[0]) as BoardReportAI;
}

async function collectReportData(customerId: number, month: number, year: number): Promise<Record<string, unknown>> {
  const [customer] = await db.select({
    fullName: customersTable.fullName,
    companyName: customersTable.companyName,
    email: customersTable.email,
    subscriptionPlan: customersTable.subscriptionPlan,
    createdAt: customersTable.createdAt,
  }).from(customersTable).where(eq(customersTable.id, customerId));

  if (!customer) return {};

  const scans = await db.select({
    overallScore: domainScansTable.overallScore,
    spfPass: domainScansTable.spfPass,
    dmarcPass: domainScansTable.dmarcPass,
    sslPass: domainScansTable.sslPass,
    hibpBreachCount: domainScansTable.hibpBreachCount,
    blacklisted: domainScansTable.blacklisted,
    createdAt: domainScansTable.createdAt,
  }).from(domainScansTable)
    .where(eq(domainScansTable.email, customer.email))
    .orderBy(desc(domainScansTable.createdAt)).limit(6);

  const currentScore = scans[0]?.overallScore ?? 50;
  const previousScore = scans[1]?.overallScore ?? currentScore;
  const scoreChange = currentScore - previousScore;

  const openFindings = [];
  if (scans[0] && !scans[0].spfPass) openFindings.push({ severity: "high", title: "E-posta Sahteciligi Riski (SPF Eksik)" });
  if (scans[0] && !scans[0].dmarcPass) openFindings.push({ severity: "high", title: "Domain Spoofing Riski (DMARC Eksik)" });
  if (scans[0] && !scans[0].sslPass) openFindings.push({ severity: "critical", title: "SSL Sertifikasi Gecersiz" });
  if (scans[0]?.hibpBreachCount && scans[0].hibpBreachCount > 0) openFindings.push({ severity: "high", title: `${scans[0].hibpBreachCount} Veri Ihlali Gecmisi` });
  if (scans[0]?.blacklisted) openFindings.push({ severity: "critical", title: "Kara Listede Kayitli" });

  const riskLevel = currentScore >= 70 ? "DUSUK" : currentScore >= 40 ? "ORTA" : "YUKSEK";
  const estimatedRiskTl = openFindings.filter(f => f.severity === "critical").length * 500000 + openFindings.filter(f => f.severity === "high").length * 150000;

  return {
    company: { name: customer.companyName ?? customer.fullName, contactName: customer.fullName, plan: customer.subscriptionPlan, memberSince: customer.createdAt },
    currentScore,
    previousScore,
    scoreChange,
    riskLevel,
    criticalFindings: openFindings.filter(f => f.severity === "critical").length,
    highFindings: openFindings.filter(f => f.severity === "high").length,
    topFindings: openFindings.slice(0, 3),
    estimatedRiskTl,
    scanHistory: scans.map(s => ({ score: s.overallScore, date: s.createdAt })),
    reportPeriod: `${month}/${year}`,
    sectorAvgScore: 58,
    sectorPercentile: currentScore > 58 ? 60 : 40,
  };
}

// ─── Background generation task ───────────────────────────────────────────────

async function runBoardReportGeneration(reportId: number, customerId: number, month: number, year: number): Promise<void> {
  try {
    const reportData = await collectReportData(customerId, month, year);
    const aiReport = await generateBoardReportAI(reportData);

    await db.update(boardReportsTable).set({
      currentScore: reportData["currentScore"] as number,
      previousScore: reportData["previousScore"] as number,
      scoreChange: reportData["scoreChange"] as number,
      riskLevel: reportData["riskLevel"] as string,
      criticalFindings: reportData["criticalFindings"] as number,
      highFindings: reportData["highFindings"] as number,
      estimatedRiskTl: reportData["estimatedRiskTl"] as number,
      executiveSummary: aiReport.executiveSummary,
      keyAchievements: aiReport.keyAchievements,
      keyRisks: aiReport.keyRisks,
      requiredDecisions: aiReport.requiredDecisions,
      nextMonthPlan: aiReport.nextMonthFocus,
      reportJson: { ...aiReport, rawData: reportData },
      status: "draft",
    }).where(eq(boardReportsTable.id, reportId));

    logger.info({ boardReportId: reportId, customerId }, "Board report generated");
  } catch (err) {
    logger.error({ err, boardReportId: reportId }, "Board report generation failed");
    await db.update(boardReportsTable)
      .set({ status: "failed_generation" })
      .where(eq(boardReportsTable.id, reportId))
      .catch(() => null);
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/board-report/recipients
router.get("/board-report/recipients", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req) as number;
  const rows = await db.select().from(boardReportRecipientsTable)
    .where(and(eq(boardReportRecipientsTable.customerId, customerId), eq(boardReportRecipientsTable.isActive, true)));
  res.json(rows);
});

// POST /api/board-report/recipients
router.post("/board-report/recipients", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req) as number;
  const { email, name, role } = req.body as { email?: string; name?: string; role?: string };
  if (!email) { res.status(400).json({ error: "E-posta gerekli" }); return; }

  const [row] = await db.insert(boardReportRecipientsTable)
    .values({ customerId, email, name: name ?? null, role: role ?? null })
    .returning();
  res.status(201).json(row);
});

// DELETE /api/board-report/recipients/:id
router.delete("/board-report/recipients/:id", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req) as number;
  const id = Number(req.params["id"]);
  if (!id) { res.status(400).json({ error: "Gecersiz ID" }); return; }

  await db.update(boardReportRecipientsTable)
    .set({ isActive: false })
    .where(and(eq(boardReportRecipientsTable.id, id), eq(boardReportRecipientsTable.customerId, customerId)));
  res.json({ ok: true });
});

// GET /api/board-report/reports
router.get("/board-report/reports", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req) as number;
  const rows = await db.select({
    id: boardReportsTable.id,
    reportMonth: boardReportsTable.reportMonth,
    reportYear: boardReportsTable.reportYear,
    status: boardReportsTable.status,
    generatedAt: boardReportsTable.generatedAt,
    currentScore: boardReportsTable.currentScore,
    riskLevel: boardReportsTable.riskLevel,
    scoreChange: boardReportsTable.scoreChange,
  }).from(boardReportsTable)
    .where(eq(boardReportsTable.customerId, customerId))
    .orderBy(desc(boardReportsTable.generatedAt)).limit(12);
  res.json(rows);
});

// GET /api/board-report/reports/:id
router.get("/board-report/reports/:id", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req) as number;
  const id = Number(req.params["id"]);
  if (!id) { res.status(400).json({ error: "Gecersiz ID" }); return; }

  const [row] = await db.select().from(boardReportsTable)
    .where(and(eq(boardReportsTable.id, id), eq(boardReportsTable.customerId, customerId)));
  if (!row) { res.status(404).json({ error: "Rapor bulunamadi" }); return; }

  // Auto-recover stale "generating" reports — server restart mid-AI-generation leaves them stuck
  if (row.status === "generating") {
    const startedAt = row.generationStartedAt;
    if (!startedAt || Date.now() - new Date(startedAt).getTime() > STALE_MS) {
      await db.update(boardReportsTable)
        .set({ status: "failed_generation" })
        .where(and(eq(boardReportsTable.id, id), eq(boardReportsTable.status, "generating")));
      res.json({ ...row, status: "failed_generation" });
      return;
    }
  }

  res.json(row);
});

// POST /api/board-report/reports/generate
router.post("/board-report/reports/generate", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req) as number;
  const now = new Date();
  const month = (req.body as Record<string, unknown>)["month"] as number ?? now.getMonth() + 1;
  const year = (req.body as Record<string, unknown>)["year"] as number ?? now.getFullYear();

  // Create record in "generating" state with timestamp so recovery can detect orphaned jobs
  const [draft] = await db.insert(boardReportsTable)
    .values({ customerId, reportMonth: month, reportYear: year, status: "generating", generationStartedAt: new Date() })
    .returning();

  // Fire-and-forget — claimBoardReportGeneration guards against duplicate/stale retries
  void runBoardReportGeneration(draft!.id, customerId, month, year);

  res.status(201).json({ id: draft!.id, status: "generating" });
});

// POST /api/board-report/reports/:id/regenerate — retry after failure or timeout
router.post("/board-report/reports/:id/regenerate", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req) as number;
  const id = Number(req.params["id"]);
  if (!id) { res.status(400).json({ error: "Gecersiz ID" }); return; }

  const [row] = await db.select({
    id: boardReportsTable.id,
    customerId: boardReportsTable.customerId,
    reportMonth: boardReportsTable.reportMonth,
    reportYear: boardReportsTable.reportYear,
    status: boardReportsTable.status,
  }).from(boardReportsTable)
    .where(and(eq(boardReportsTable.id, id), eq(boardReportsTable.customerId, customerId)));

  if (!row) { res.status(404).json({ error: "Rapor bulunamadi" }); return; }
  if (row.status === "draft" || row.status === "approved" || row.status === "sent") {
    res.json({ status: row.status, message: "Rapor zaten hazir" }); return;
  }

  const claimed = await claimBoardReportGeneration(id);
  if (!claimed) { res.json({ status: "generating", message: "Rapor zaten olusturuluyor" }); return; }

  void runBoardReportGeneration(id, customerId, row.reportMonth, row.reportYear);
  res.json({ status: "generating", message: "Rapor olusturma yeniden baslatildi" });
});

// PUT /api/board-report/reports/:id/approve
router.put("/board-report/reports/:id/approve", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req) as number;
  const id = Number(req.params["id"]);

  const [row] = await db.select().from(boardReportsTable)
    .where(and(eq(boardReportsTable.id, id), eq(boardReportsTable.customerId, customerId)));
  if (!row) { res.status(404).json({ error: "Rapor bulunamadi" }); return; }

  await db.update(boardReportsTable)
    .set({ status: "approved", approvedAt: new Date() })
    .where(eq(boardReportsTable.id, id));
  res.json({ ok: true });
});

// POST /api/board-report/reports/:id/send
router.post("/board-report/reports/:id/send", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req) as number;
  const id = Number(req.params["id"]);

  const [row] = await db.select().from(boardReportsTable)
    .where(and(eq(boardReportsTable.id, id), eq(boardReportsTable.customerId, customerId)));
  if (!row) { res.status(404).json({ error: "Rapor bulunamadi" }); return; }

  const recipients = await db.select().from(boardReportRecipientsTable)
    .where(and(eq(boardReportRecipientsTable.customerId, customerId), eq(boardReportRecipientsTable.isActive, true)));

  if (recipients.length === 0) {
    res.status(400).json({ error: "Alici listesi bos. Once alici ekleyin." });
    return;
  }

  const ai = row.reportJson as Record<string, unknown> | null;
  const month = row.reportMonth;
  const year = row.reportYear;
  const monthNames = ["Ocak","Subat","Mart","Nisan","Mayis","Haziran","Temmuz","Agustos","Eylul","Ekim","Kasim","Aralik"];
  const monthName = monthNames[(month - 1)] ?? String(month);

  const [customer] = await db.select({ companyName: customersTable.companyName, fullName: customersTable.fullName })
    .from(customersTable).where(eq(customersTable.id, customerId));

  const company = customer?.companyName ?? customer?.fullName ?? "Sirketiniz";

  void ai;

  const sentEmails: string[] = [];
  for (const recipient of recipients) {
    await sendMail({
      to: recipient.email,
      subject: `${company} — ${monthName} ${year} Siber Guvenlik Yonetim Brifing`,
      html: `<p>Sayın ${recipient.name ?? recipient.email},</p>
<p>${company}'in ${monthName} ${year} siber guvenlik brifing raporu hazirlanmistir.</p>
<p><strong>Bu ay ozeti:</strong></p>
<ul>
<li>Guvenlik skoru: ${row.currentScore ?? "?"}/100 (gec. ay: ${row.previousScore ?? "?"}, ${(row.scoreChange ?? 0) >= 0 ? "+" : ""}${row.scoreChange ?? 0} degisim)</li>
<li>Acik kritik risk: ${row.criticalFindings ?? 0}</li>
<li>Risk seviyesi: ${row.riskLevel ?? "ORTA"}</li>
</ul>
${row.executiveSummary ? `<p>${row.executiveSummary}</p>` : ""}
<p>Detayli rapor icin: <a href="${getBaseUrl()}/hesabim/yonetim-raporu">${getBaseUrl()}/hesabim/yonetim-raporu</a></p>
<p>CyberStep.io</p>`,
    });
    sentEmails.push(recipient.email);
  }

  await db.update(boardReportsTable)
    .set({ status: "sent", sentToEmails: sentEmails })
    .where(eq(boardReportsTable.id, id));

  logger.info({ boardReportId: id, count: sentEmails.length }, "Board report sent");
  res.json({ ok: true, sent: sentEmails.length });
});

// ─── Admin Routes ─────────────────────────────────────────────────────────────

// GET /api/admin/board-reports
router.get("/admin/board-reports", requireAdmin, async (_req: Request, res: Response) => {
  const reports = await db.select({
    id: boardReportsTable.id,
    customerId: boardReportsTable.customerId,
    reportMonth: boardReportsTable.reportMonth,
    reportYear: boardReportsTable.reportYear,
    status: boardReportsTable.status,
    generatedAt: boardReportsTable.generatedAt,
    currentScore: boardReportsTable.currentScore,
    riskLevel: boardReportsTable.riskLevel,
    sentToEmails: boardReportsTable.sentToEmails,
    criticalFindings: boardReportsTable.criticalFindings,
  }).from(boardReportsTable)
    .orderBy(desc(boardReportsTable.generatedAt))
    .limit(200);
  res.json(reports);
});

export default router;
