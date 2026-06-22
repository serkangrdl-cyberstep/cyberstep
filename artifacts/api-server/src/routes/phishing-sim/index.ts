import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import {
  phishingSimulationsTable,
  phishingSimOsintSourcesTable,
} from "@workspace/db";
import { eq, and, gte } from "drizzle-orm";
import { requireAdmin } from "../../middleware/auth";
import { logger } from "../../lib/logger";
import { collectOSINT } from "../../services/osint-collector";
import { getClaudeAiFn } from "../../services/ai-client";

const router = Router();
const claudeFn = getClaudeAiFn("phishing-sim");

const BLOCKED_DOMAIN_SUFFIXES = [".gov.tr", ".edu.tr", ".mil.tr"];

function isBlockedDomain(domain: string): boolean {
  const d = domain.toLowerCase().trim();
  return BLOCKED_DOMAIN_SUFFIXES.some(s => d.endsWith(s));
}

function sess(req: Request) {
  return req.session as unknown as Record<string, unknown>;
}
function addSimToSession(req: Request, id: number) {
  const s = sess(req);
  const existing = (s["ownedSimIds"] as number[] | undefined) ?? [];
  s["ownedSimIds"] = [...new Set([...existing, id])];
}
function requireSimOwner(req: Request, res: Response, next: import("express").NextFunction): void {
  const adminId = sess(req)["adminId"] as number | undefined;
  if (adminId) { next(); return; }
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  const owned = (sess(req)["ownedSimIds"] as number[] | undefined) ?? [];
  if (!owned.includes(id)) { res.status(403).json({ error: "Erişim izni yok" }); return; }
  next();
}

// ─── Start simulation ─────────────────────────────────────────────────────────

router.post("/api/phishing-sim/start", async (req: Request, res: Response): Promise<void> => {
  const { companyName, domain, contactEmail, sector, employeeCount, consentAccepted } = req.body as {
    companyName: string; domain: string; contactEmail?: string;
    sector?: string; employeeCount?: string; consentAccepted: boolean;
  };

  if (!companyName || !domain) { res.status(400).json({ error: "Şirket adı ve domain zorunlu" }); return; }
  if (!consentAccepted) { res.status(400).json({ error: "Onay gerekli" }); return; }

  const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim();
  if (isBlockedDomain(cleanDomain)) { res.status(403).json({ error: "Bu domain türü için simülasyon yapılamaz" }); return; }

  // Rate limit: 1 per domain per 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recent = await db.select({ id: phishingSimulationsTable.id }).from(phishingSimulationsTable)
    .where(and(eq(phishingSimulationsTable.domain, cleanDomain), gte(phishingSimulationsTable.createdAt, thirtyDaysAgo)));
  if (recent.length > 0) { res.status(429).json({ error: "Bu domain için son 30 gün içinde zaten simülasyon oluşturulmuş" }); return; }

  const [sim] = await db.insert(phishingSimulationsTable).values({
    companyName,
    domain: cleanDomain,
    contactEmail,
    sector,
    employeeCount,
    status: "collecting",
    consentAccepted: true,
    consentText: "Simülasyonun yalnızca farkındalık amaçlı olduğunu ve hiçbir gerçek saldırı veya e-posta gönderimi yapılmayacağını anlıyorum.",
    consentAcceptedAt: new Date(),
  }).returning();

  if (!sim) { res.status(500).json({ error: "Simülasyon oluşturulamadı" }); return; }
  addSimToSession(req, sim.id);
  res.status(201).json({ id: sim.id, status: sim.status });

  // Fire-and-forget: OSINT + Claude scenario generation
  (async () => {
    try {
      await db.update(phishingSimulationsTable).set({ status: "collecting" }).where(eq(phishingSimulationsTable.id, sim.id));

      const osint = await collectOSINT(cleanDomain);
      await db.update(phishingSimulationsTable).set({ osintData: osint as unknown as Record<string, unknown>, status: "generating" }).where(eq(phishingSimulationsTable.id, sim.id));

      // Save OSINT sources
      const sources = [
        { type: "website", data: osint.websiteTitle, url: `https://${cleanDomain}`, risk: "medium" },
        ...(osint.technologyStack.length > 0 ? [{ type: "tech_stack", data: osint.technologyStack.join(", "), url: `https://${cleanDomain}`, risk: "medium" }] : []),
        ...(osint.emailPatterns.length > 0 ? [{ type: "email_pattern", data: osint.emailPatterns.join(", "), url: `https://${cleanDomain}`, risk: "high" }] : []),
        ...(osint.haveIBeenPwnedCount > 0 ? [{ type: "hibp", data: `${osint.haveIBeenPwnedCount} veri ihlali`, url: "https://haveibeenpwned.com", risk: "high" }] : []),
        ...(!osint.spfConfigured ? [{ type: "dns", data: "SPF kaydı yok — e-posta taklit riski!", url: `https://${cleanDomain}`, risk: "high" }] : []),
        ...(!osint.dmarcConfigured ? [{ type: "dns", data: "DMARC kaydı yok — phishing riski!", url: `https://${cleanDomain}`, risk: "high" }] : []),
      ];
      for (const s of sources) {
        await db.insert(phishingSimOsintSourcesTable).values({ simulationId: sim.id, sourceType: s.type, sourceUrl: s.url, dataFound: s.data, riskContribution: s.risk });
      }

      const scenarios = await generateScenarios(osint, companyName, cleanDomain, sector ?? "genel");
      await db.update(phishingSimulationsTable).set({ scenarios: scenarios as unknown as Record<string, unknown>[], status: "ready", completedAt: new Date() }).where(eq(phishingSimulationsTable.id, sim.id));
    } catch (err) {
      logger.error({ err, simId: sim.id }, "Phishing sim generation failed");
      await db.update(phishingSimulationsTable).set({ status: "error" as string }).where(eq(phishingSimulationsTable.id, sim.id));
    }
  })();
});

// ─── Status ───────────────────────────────────────────────────────────────────

router.get("/api/phishing-sim/:id/status", requireSimOwner, async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params["id"]);
  const [sim] = await db.select({ id: phishingSimulationsTable.id, status: phishingSimulationsTable.status, createdAt: phishingSimulationsTable.createdAt, completedAt: phishingSimulationsTable.completedAt })
    .from(phishingSimulationsTable).where(eq(phishingSimulationsTable.id, id));
  if (!sim) { res.status(404).json({ error: "Bulunamadı" }); return; }
  const progress = sim.status === "collecting" ? 20 : sim.status === "generating" ? 60 : sim.status === "ready" ? 100 : 0;
  res.json({ status: sim.status, progress });
});

// ─── Report ───────────────────────────────────────────────────────────────────

router.get("/api/phishing-sim/:id/report", requireSimOwner, async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params["id"]);
  const [sim] = await db.select().from(phishingSimulationsTable).where(eq(phishingSimulationsTable.id, id));
  if (!sim) { res.status(404).json({ error: "Bulunamadı" }); return; }
  if (sim.status !== "ready") { res.status(202).json({ status: sim.status, progress: sim.status === "collecting" ? 20 : 60 }); return; }

  const sources = await db.select().from(phishingSimOsintSourcesTable).where(eq(phishingSimOsintSourcesTable.simulationId, id));
  if (!sim.viewedAt) {
    await db.update(phishingSimulationsTable).set({ viewedAt: new Date() }).where(eq(phishingSimulationsTable.id, id));
  }
  res.json({ ...sim, osintSources: sources });
});

// ─── Admin ─────────────────────────────────────────────────────────────────────

router.get("/api/admin/phishing-sim/list", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  const sims = await db.select({
    id: phishingSimulationsTable.id,
    companyName: phishingSimulationsTable.companyName,
    domain: phishingSimulationsTable.domain,
    status: phishingSimulationsTable.status,
    createdAt: phishingSimulationsTable.createdAt,
    consentAccepted: phishingSimulationsTable.consentAccepted,
  }).from(phishingSimulationsTable);
  res.json(sims);
});

// ─── Scenario generation ──────────────────────────────────────────────────────

interface PhishingScenario {
  scenario_id: number;
  attack_type: string;
  attack_type_icon: string;
  why_effective: string;
  public_data_used: string[];
  email: { from_display: string; to: string; subject: string; body: string; manipulation_technique: string };
  red_flags: string[];
  if_successful: string;
  prevention: string;
}

async function generateScenarios(
  osint: Awaited<ReturnType<typeof collectOSINT>>,
  companyName: string,
  domain: string,
  sector: string
): Promise<PhishingScenario[]> {
  const fakeDomain = domain.replace(".", "-") + ".net";
  const prompt = `Bu bir siber güvenlik farkındalık aracı için etik simülasyon. Gerçek saldırı değil, "böyle görünürdü" gösterimi. Çıktının her senaryosuna açıkça ⚠️ BU BİR SİMÜLASYONDUR damgası eklenecek.

Sen bir etik siber güvenlik araştırmacısısın. Aşağıdaki şirkete yönelik gerçekçi spear-phishing senaryoları üreteceksin.

AMAÇ: Farkındalık yaratmak. E-postalar gönderilmeyecek.

ŞİRKET: ${companyName}
DOMAIN: ${domain}
SEKTÖR: ${sector}

KAMUYA AÇIK VERİLER:
Web sitesi başlığı: ${osint.websiteTitle || "Tespit edilemedi"}
Teknoloji altyapısı: ${osint.technologyStack.join(", ") || "Bilinmiyor"}
Kamuya açık isimler: ${osint.namedExecutives.join(", ") || "Tespit edilmedi"}
E-posta formatı: ${osint.emailPatterns[0] ?? `info@${domain}`}
Veri ihlali geçmişi: ${osint.haveIBeenPwnedCount} ihlal
SPF kaydı: ${osint.spfConfigured ? "Var" : "Yok (taklit riski!)"}
DMARC kaydı: ${osint.dmarcConfigured ? "Var" : "Yok (taklit riski!)"}

3 FARKLI SENARYO ÜRET:
Senaryo 1: CEO Dolandırıcılığı (BEC)
Senaryo 2: IT Destek Kimlik Avı
Senaryo 3: Tedarikçi/Fatura Sahteciliği

Her senaryo için kesinlikle şu JSON formatını kullan:
{"scenario_id": 1, "attack_type": "CEO Dolandırıcılığı", "attack_type_icon": "💼", "why_effective": "...", "public_data_used": ["..."], "email": {"from_display": "Ad Soyad <sahte@${fakeDomain}>", "to": "muhasebe@${domain}", "subject": "...", "body": "Gerçekçi Türkçe e-posta (8-12 satır)\\n⚠️ BU BİR SİMÜLASYONDUR", "manipulation_technique": "..."}, "red_flags": ["..."], "if_successful": "...", "prevention": "..."}

ÖNEMLİ KURALLAR:
- Gerçek IBAN veya TC kimlik numarası KULLANMA
- Şirkete özgü bağlam kullan ama uydurma spesifik kişi adı
- Her e-posta sonuna ⚠️ BU BİR SİMÜLASYONDUR ekle
- Sadece JSON array döndür, başka metin ekleme

Bu bir siber güvenlik farkındalık aracı için etik simülasyon.`;

  const raw = await claudeFn(prompt);
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("JSON array not found in Claude response");
  return JSON.parse(jsonMatch[0]) as PhishingScenario[];
}

export default router;
