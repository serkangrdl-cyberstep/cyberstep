import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { redTeamReportsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { collectOSINT } from "../../services/osint-collector";
import { getClaudeAiFn } from "../../services/ai-client";

const router = Router();
const claudeFn = getClaudeAiFn("red-team");

const BLOCKED_DOMAIN_SUFFIXES = [".gov.tr", ".edu.tr", ".mil.tr"];
function isBlockedDomain(domain: string) {
  return BLOCKED_DOMAIN_SUFFIXES.some(s => domain.toLowerCase().endsWith(s));
}

function sess(req: Request) { return req.session as unknown as Record<string, unknown>; }
function addToSession(req: Request, id: number) {
  const s = sess(req);
  const existing = (s["ownedRedTeamIds"] as number[] | undefined) ?? [];
  s["ownedRedTeamIds"] = [...new Set([...existing, id])];
}
function requireOwner(req: Request, res: Response, next: import("express").NextFunction): void {
  const adminId = sess(req)["adminId"] as number | undefined;
  if (adminId) { next(); return; }
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  const owned = (sess(req)["ownedRedTeamIds"] as number[] | undefined) ?? [];
  if (!owned.includes(id)) { res.status(403).json({ error: "Erişim izni yok" }); return; }
  next();
}

// ─── POST /api/red-team/start ─────────────────────────────────────────────────

router.post("/api/red-team/start", async (req: Request, res: Response): Promise<void> => {
  const { companyName, domain, contactEmail, sector, consentAccepted } = req.body as {
    companyName: string; domain: string; contactEmail?: string;
    sector?: string; consentAccepted: boolean;
  };

  if (!companyName || !domain) { res.status(400).json({ error: "Şirket adı ve domain zorunlu" }); return; }
  if (!consentAccepted) { res.status(400).json({ error: "Onay gerekli" }); return; }

  const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim();
  if (isBlockedDomain(cleanDomain)) { res.status(403).json({ error: "Bu domain türü için analiz yapılamaz" }); return; }

  const [row] = await db.insert(redTeamReportsTable).values({
    companyName, domain: cleanDomain, contactEmail, sector,
    status: "collecting",
  }).returning({ id: redTeamReportsTable.id });

  addToSession(req, row.id);
  res.json({ id: row.id, status: "collecting" });

  runRedTeam(row.id, cleanDomain, companyName, sector).catch(e =>
    logger.error({ id: row.id, err: e }, "Red team error")
  );
});

async function runRedTeam(id: number, domain: string, companyName: string, sector?: string) {
  try {
    const osint = await collectOSINT(domain);

    const attackVectors: { vector: string; severity: string; description: string; source: string; example: string }[] = [];

    if (osint.technologyStack.length > 0) {
      attackVectors.push({ vector: "Teknoloji Altyapısı Tespiti", severity: "medium", description: "Saldırgan kullandığınız yazılımları biliyor ve bu yazılımlara özgü açıkları araştırabilir.", source: "Web sitesi kaynak kodu", example: `Tespit edilen: ${osint.technologyStack.join(", ")}` });
    }
    if (osint.namedExecutives.length > 0) {
      attackVectors.push({ vector: "Yönetici Bilgisi Maruziyeti", severity: "high", description: "Saldırgan yönetici isimlerini kullanarak hedefli phishing e-postası hazırlayabilir.", source: "Şirket web sitesi / LinkedIn", example: `Bulunan isimler: ${osint.namedExecutives.join(", ")}` });
    }
    if (osint.emailPatterns.length > 0) {
      attackVectors.push({ vector: "E-posta Formatı Tahmini", severity: "high", description: "Saldırgan tüm çalışanların e-posta adresini tahmin edebilir.", source: "Kamuya açık e-postalar", example: `Format: ${osint.emailPatterns[0]}` });
    }
    if (!osint.dmarcConfigured) {
      attackVectors.push({ vector: "E-posta Taklit Riski", severity: "critical", description: "Saldırgan şirket adına e-posta gönderebilir.", source: "DNS kaydı analizi", example: "DMARC kaydı yok — taklit kolay" });
    }
    if (osint.haveIBeenPwnedCount > 0) {
      attackVectors.push({ vector: "Veri İhlali Geçmişi", severity: "high", description: "Önceki ihlallerden elde edilen şifreler hâlâ kullanılıyor olabilir.", source: "HaveIBeenPwned", example: `${osint.haveIBeenPwnedCount} veri ihlalinde domain görünüyor` });
    }

    await db.update(redTeamReportsTable)
      .set({ osintData: osint as unknown as Record<string, unknown>, attackVectors, status: "generating" })
      .where(eq(redTeamReportsTable.id, id));

    const prompt = `
Sen bir etik siber güvenlik red team uzmanısın.
Kamuya açık kaynaklardan toplanan verilerle istihbarat değerlendirmesi yap.

ŞİRKET: ${companyName}
SEKTÖR: ${sector ?? "Belirtilmedi"}

TOPLANAN İSTİHBARAT:
${JSON.stringify(osint, null, 2)}

TESPİT EDİLEN SALDIRI VEKTÖRLERİ:
${attackVectors.map(v => `[${v.severity.toUpperCase()}] ${v.vector}: ${v.example}`).join("\n")}

JSON FORMATINDA ÜRETİN:
{
  "exposure_score": 0,
  "exposure_level": "KRİTİK | YÜKSEK | ORTA | DÜŞÜK",
  "executive_summary": "4-5 cümle. Bir saldırgan bu şirket hakkında ne biliyor ve bunu nasıl kullanabilir. Patron dili.",
  "attacker_profile": "30 dakikada bir saldırganın öğrenebileceklerinin özeti",
  "intelligence_categories": [
    { "category": "Teknoloji İstihbaratı", "findings": ["..."], "attacker_use": "...", "risk": "high" }
  ],
  "most_valuable_finding": "...",
  "attack_scenarios": [
    { "scenario": "...", "uses_found_data": ["..."], "probability": "Yüksek", "potential_damage": "..." }
  ],
  "data_minimization_actions": ["..."],
  "quick_wins": ["..."]
}

Sadece JSON döndür.`;

    const raw = await claudeFn(prompt);
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const reportJson = JSON.parse(cleaned);

    await db.update(redTeamReportsTable)
      .set({ reportJson, status: "completed", completedAt: new Date() })
      .where(eq(redTeamReportsTable.id, id));
  } catch (e) {
    logger.error({ id, err: e }, "Red team report failed");
    await db.update(redTeamReportsTable)
      .set({ status: "error" }).where(eq(redTeamReportsTable.id, id));
  }
}

// ─── GET /api/red-team/:id/report ─────────────────────────────────────────────

router.get("/api/red-team/:id/report", requireOwner, async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params["id"]);
  const rows = await db.select().from(redTeamReportsTable)
    .where(eq(redTeamReportsTable.id, id)).limit(1);
  if (!rows[0]) { res.status(404).json({ error: "Bulunamadı" }); return; }
  const row = rows[0];
  res.json({
    id: row.id,
    status: row.status,
    companyName: row.companyName,
    domain: row.domain,
    attackVectors: row.attackVectors,
    report: row.reportJson,
  });
});

export default router;
