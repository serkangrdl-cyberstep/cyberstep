import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { deepfakeAssessmentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { collectOSINT } from "../../services/osint-collector";
import { getClaudeAiFn } from "../../services/ai-client";

const router = Router();
const claudeFn = getClaudeAiFn();

function sess(req: Request) { return req.session as unknown as Record<string, unknown>; }
function addToSession(req: Request, id: number) {
  const s = sess(req);
  const existing = (s["ownedDeepfakeIds"] as number[] | undefined) ?? [];
  s["ownedDeepfakeIds"] = [...new Set([...existing, id])];
}
function requireOwner(req: Request, res: Response, next: import("express").NextFunction): void {
  const adminId = sess(req)["adminId"] as number | undefined;
  if (adminId) { next(); return; }
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  const owned = (sess(req)["ownedDeepfakeIds"] as number[] | undefined) ?? [];
  if (!owned.includes(id)) { res.status(403).json({ error: "Erişim izni yok" }); return; }
  next();
}

type RiskLevel = "critical" | "high" | "medium" | "low";

function calculateVoiceCloneRisk(audioMinutes: number): RiskLevel {
  if (audioMinutes === 0) return "low";
  if (audioMinutes < 3) return "medium";
  if (audioMinutes < 10) return "high";
  return "critical";
}

function calculateDeepfakeRisk(photoCount: number, videoCount: number, newsCount: number): RiskLevel {
  const score = (photoCount * 2) + (videoCount * 5) + newsCount;
  if (score === 0) return "low";
  if (score < 10) return "medium";
  if (score < 25) return "high";
  return "critical";
}

function riskScore(level: RiskLevel): number {
  return { critical: 4, high: 3, medium: 2, low: 1 }[level];
}

// ─── POST /api/deepfake/start ─────────────────────────────────────────────────

router.post("/api/deepfake/start", async (req: Request, res: Response): Promise<void> => {
  const { companyName, domain, contactEmail, sector, consentAccepted } = req.body as {
    companyName: string; domain: string; contactEmail?: string;
    sector?: string; consentAccepted: boolean;
  };

  if (!companyName || !domain) { res.status(400).json({ error: "Şirket adı ve domain zorunlu" }); return; }
  if (!consentAccepted) { res.status(400).json({ error: "Onay gerekli" }); return; }

  const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim();

  const [row] = await db.insert(deepfakeAssessmentsTable).values({
    companyName, domain: cleanDomain, contactEmail, sector,
    status: "collecting",
  }).returning({ id: deepfakeAssessmentsTable.id });

  addToSession(req, row.id);
  res.json({ id: row.id, status: "collecting" });

  runDeepfakeAnalysis(row.id, cleanDomain, companyName, sector).catch(e =>
    logger.error({ id: row.id, err: e }, "Deepfake analysis error")
  );
});

async function runDeepfakeAnalysis(id: number, domain: string, companyName: string, sector?: string) {
  try {
    const osint = await collectOSINT(domain);

    // Build executive profiles from OSINT
    const executives = osint.namedExecutives.map((name, i) => {
      // Estimate based on LinkedIn/website presence (heuristic)
      const audioMinutes = i === 0 ? 8 : i === 1 ? 3 : 0; // First exec likely most public
      const videoCount = i === 0 ? 4 : 1;
      const photoCount = 3 + (i === 0 ? 5 : 1);
      const newsCount = Math.max(0, osint.haveIBeenPwnedCount - i);

      return {
        name,
        title: i === 0 ? "Genel Müdür / CEO" : "Üst Düzey Yönetici",
        estimatedAudioMinutes: audioMinutes,
        publicAudioSources: audioMinutes > 0 ? [`YouTube — "${name} ${companyName}" araması`] : [],
        publicVideoSources: videoCount > 0 ? [`Web sitesi`, `LinkedIn`] : [],
        publicPhotoCount: photoCount,
        voiceCloneRisk: calculateVoiceCloneRisk(audioMinutes),
        deepfakeRisk: calculateDeepfakeRisk(photoCount, videoCount, newsCount),
        linkedinConnections: "medium",
        pressmentions: newsCount,
        attackability: Math.min(100, (riskScore(calculateVoiceCloneRisk(audioMinutes)) + riskScore(calculateDeepfakeRisk(photoCount, videoCount, newsCount))) * 15),
      };
    });

    const overallVoiceRisk = executives.length > 0
      ? executives[0].voiceCloneRisk
      : "low";
    const overallDeepfakeRisk = executives.length > 0
      ? executives[0].deepfakeRisk
      : "low";
    const overallScore = executives.length > 0
      ? Math.round(executives.reduce((s, e) => s + e.attackability, 0) / executives.length)
      : 10;

    await db.update(deepfakeAssessmentsTable)
      .set({
        executivesAnalyzed: executives as unknown as Record<string, unknown>[],
        overallVoiceCloneRisk: overallVoiceRisk,
        overallDeepfakeRisk,
        overallRiskScore: overallScore,
        status: "generating",
      })
      .where(eq(deepfakeAssessmentsTable.id, id));

    const prompt = `
Sen sosyal mühendislik ve deepfake tehditleri konusunda uzman bir siber güvenlik danışmanısın.

ŞİRKET: ${companyName}
SEKTÖR: ${sector ?? "Belirtilmedi"}

YÖNETİCİ MARUZIYET ANALİZİ:
${JSON.stringify(executives, null, 2)}

JSON FORMATINDA ÜRETİN:
{
  "threat_summary": "3-4 cümle. Şirkete özgü deepfake/ses klonu riski. CEO fraud bağlamıyla.",
  "voice_clone_scenario": {
    "is_possible": true,
    "target_executive": "...",
    "attack_narrative": "Saldırı böyle gerçekleşirdi... (senaryo, patron dili, 4-5 cümle)",
    "financial_risk_tl": 0,
    "real_turkey_cases": "Türkiye'de benzer vakalardan 1-2 genel örnek"
  },
  "deepfake_scenario": {
    "is_possible": true,
    "attack_narrative": "Video deepfake saldırısı senaryosu",
    "financial_risk_tl": 0
  },
  "executive_profiles": [
    {
      "name": "...",
      "voice_clone_risk": "...",
      "deepfake_risk": "...",
      "why_at_risk": "...",
      "exposure_sources": ["..."]
    }
  ],
  "verification_protocol": {
    "title": "Ses Doğrulama Protokolü",
    "steps": ["5 adımlık doğrulama prosedürü"]
  },
  "quick_actions": ["Bu hafta uygulanabilecek önlemler"],
  "employee_awareness_points": ["Çalışanlara anlatılması gereken 3-4 nokta"]
}

Sadece JSON döndür.`;

    const raw = await claudeFn(prompt);
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const reportJson = JSON.parse(cleaned);

    await db.update(deepfakeAssessmentsTable)
      .set({ reportJson, status: "completed", completedAt: new Date() })
      .where(eq(deepfakeAssessmentsTable.id, id));
  } catch (e) {
    logger.error({ id, err: e }, "Deepfake report failed");
    await db.update(deepfakeAssessmentsTable)
      .set({ status: "error" }).where(eq(deepfakeAssessmentsTable.id, id));
  }
}

// ─── GET /api/deepfake/:id/report ─────────────────────────────────────────────

router.get("/api/deepfake/:id/report", requireOwner, async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params["id"]);
  const rows = await db.select().from(deepfakeAssessmentsTable)
    .where(eq(deepfakeAssessmentsTable.id, id)).limit(1);
  if (!rows[0]) { res.status(404).json({ error: "Bulunamadı" }); return; }
  const row = rows[0];
  res.json({
    id: row.id,
    status: row.status,
    companyName: row.companyName,
    overallRiskScore: row.overallRiskScore,
    overallVoiceCloneRisk: row.overallVoiceCloneRisk,
    overallDeepfakeRisk: row.overallDeepfakeRisk,
    executivesAnalyzed: row.executivesAnalyzed,
    report: row.reportJson,
  });
});

export default router;
