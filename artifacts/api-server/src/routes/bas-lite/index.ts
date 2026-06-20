import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { basSimulationsTable, customersTable, domainScansTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { requireCustomer, getCustomerId } from "../../middleware/auth";
import { logger } from "../../lib/logger";
import { callModel } from "@workspace/ai";

const router = Router();

// ─── POST /api/bas-lite/analyze ───────────────────────────────────────────────
router.post("/bas-lite/analyze", requireCustomer, async (req: Request, res: Response) => {
  try {
    const customerId = getCustomerId(req) as number;
    const { domain, findings } = req.body as {
      domain?: string;
      findings?: Array<{ type: string; title: string; severity: string; detail: string }>;
    };

    if (!domain || typeof domain !== "string") {
      res.status(400).json({ error: "domain gerekli" });
      return;
    }
    if (!Array.isArray(findings) || findings.length === 0) {
      res.status(400).json({ error: "En az bir bulgu seçilmeli" });
      return;
    }
    if (findings.length > 15) {
      res.status(400).json({ error: "Maksimum 15 bulgu seçilebilir" });
      return;
    }

    const [sim] = await db
      .insert(basSimulationsTable)
      .values({
        customerId,
        domain,
        selectedFindings: findings,
        status: "queued",
      })
      .returning({ id: basSimulationsTable.id });

    if (!sim) {
      res.status(500).json({ error: "Kayıt oluşturulamadı" });
      return;
    }

    setImmediate(() => void runAnalysis(sim.id, domain, findings));

    res.json({ id: sim.id, status: "queued" });
  } catch (err) {
    logger.error({ err }, "bas-lite: analyze başlatılamadı");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── GET /api/bas-lite/:id ────────────────────────────────────────────────────
router.get("/bas-lite/:id", requireCustomer, async (req: Request, res: Response) => {
  try {
    const customerId = getCustomerId(req) as number;
    const id = parseInt(String(req.params["id"] ?? ""), 10);
    if (isNaN(id)) { res.status(400).json({ error: "Geçersiz id" }); return; }

    const [row] = await db
      .select()
      .from(basSimulationsTable)
      .where(and(eq(basSimulationsTable.id, id), eq(basSimulationsTable.customerId, customerId)));

    if (!row) { res.status(404).json({ error: "Kayıt bulunamadı" }); return; }
    res.json(row);
  } catch (err) {
    logger.error({ err }, "bas-lite: kayıt getirilemedi");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── GET /api/bas-lite ────────────────────────────────────────────────────────
router.get("/bas-lite", requireCustomer, async (req: Request, res: Response) => {
  try {
    const customerId = getCustomerId(req) as number;
    const rows = await db
      .select()
      .from(basSimulationsTable)
      .where(eq(basSimulationsTable.customerId, customerId))
      .orderBy(desc(basSimulationsTable.createdAt))
      .limit(20);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "bas-lite: liste getirilemedi");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── GET /api/bas-lite/domains (domain scan listesi için) ─────────────────────
router.get("/bas-lite/domains/recent", requireCustomer, async (req: Request, res: Response) => {
  try {
    const customerId = getCustomerId(req) as number;
    const [customer] = await db
      .select({ email: customersTable.email })
      .from(customersTable)
      .where(eq(customersTable.id, customerId));

    if (!customer) { res.json([]); return; }

    const rawScans = await db
      .select({
        id: domainScansTable.id,
        domain: domainScansTable.domain,
        overallScore: domainScansTable.overallScore,
        createdAt: domainScansTable.createdAt,
        cveSummary: domainScansTable.cveSummary,
        httpHeadersDetails: domainScansTable.httpHeadersDetails,
        spfPass: domainScansTable.spfPass,
        dmarcPass: domainScansTable.dmarcPass,
        sslPass: domainScansTable.sslPass,
        orphanedAssets: domainScansTable.orphanedAssets,
      })
      .from(domainScansTable)
      .where(
        sql`${domainScansTable.email} = ${customer.email}`
      )
      .orderBy(desc(domainScansTable.createdAt))
      .limit(10);

    // Transform to the shape expected by the frontend
    const scans = rawScans.map(s => ({
      id: s.id,
      domain: s.domain,
      overallScore: s.overallScore,
      createdAt: s.createdAt,
      cveSummary: s.cveSummary,
      orphanedAssets: s.orphanedAssets,
      // Assemble findings from individual pass/fail booleans
      findings: {
        spf: { pass: s.spfPass },
        dmarc: { pass: s.dmarcPass },
        ssl: { pass: s.sslPass },
      },
      // Map httpHeadersDetails to lowercase header name keys
      httpHeaders: s.httpHeadersDetails
        ? {
            "x-frame-options": s.httpHeadersDetails.xFrameOptions,
            "content-security-policy": s.httpHeadersDetails.csp,
            "x-content-type-options": s.httpHeadersDetails.xContentTypeOptions,
          }
        : null,
    }));

    res.json(scans);
  } catch (err) {
    logger.error({ err }, "bas-lite: domain listesi getirilemedi");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── Admin: GET /api/admin/bas-lite ──────────────────────────────────────────
router.get("/admin/bas-lite", async (req: Request, res: Response) => {
  try {
    if (!(req.session as unknown as Record<string, unknown>)["adminId"]) {
      res.status(401).json({ error: "Yetkisiz" });
      return;
    }
    const rows = await db
      .select({
        id: basSimulationsTable.id,
        domain: basSimulationsTable.domain,
        status: basSimulationsTable.status,
        createdAt: basSimulationsTable.createdAt,
        completedAt: basSimulationsTable.completedAt,
      })
      .from(basSimulationsTable)
      .orderBy(desc(basSimulationsTable.createdAt))
      .limit(50);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "bas-lite: admin liste getirilemedi");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── Analysis Engine ──────────────────────────────────────────────────────────

async function runAnalysis(
  simId: number,
  domain: string,
  findings: Array<{ type: string; title: string; severity: string; detail: string }>,
): Promise<void> {
  try {
    await db
      .update(basSimulationsTable)
      .set({ status: "analyzing", analysisStartedAt: new Date() })
      .where(eq(basSimulationsTable.id, simId));

    const findingsList = findings
      .map((f, i) => `${i + 1}. [${f.severity.toUpperCase()}] ${f.title} (${f.type})\n   Detay: ${f.detail}`)
      .join("\n");

    const prompt = `Sen deneyimli bir siber güvenlik uzmanı ve penetrasyon test uzmanısın. Aşağıdaki domain ve güvenlik bulguları için gerçekçi bir BAS (Breach & Attack Simulation) analizi yap.

Domain: ${domain}
Bulunan Güvenlik Açıkları/Sorunlar:
${findingsList}

Her bulgu için şunu değerlendir:
1. Gerçekten sömürülebilir mi? (Evet/Hayır + olasılık: Yüksek/Orta/Düşük)
2. Saldırı zinciri nasıl gider? (somut adımlar)
3. Başarılı sömürünün etkisi ne olur?
4. Öncelik sırası (1=en kritik)
5. Düzeltme yöntemi

Yanıtını YALNIZCA aşağıdaki JSON formatında ver (başka metin ekleme):
{
  "summary": "Genel değerlendirme özeti (2-3 cümle)",
  "overallExploitability": "Yüksek|Orta|Düşük",
  "scenarios": [
    {
      "findingTitle": "Bulgu başlığı",
      "exploitable": true,
      "probability": "Yüksek|Orta|Düşük",
      "attackChain": "Adım adım saldırı zinciri açıklaması",
      "impact": "Başarılı sömürünün etkisi",
      "mitigation": "Kısa düzeltme adımı",
      "priority": 1
    }
  ],
  "attackNarrative": "Bu açıklar birleştirilirse nasıl bir saldırı senaryosu oluşur? (1 paragraf, gerçekçi hikaye)",
  "topRemediation": ["En önemli 3 aksiyon", "İkinci aksiyon", "Üçüncü aksiyon"]
}`;

    const rawText = await callModel({
      task: "bas-lite",
      messages: [{ role: "user", content: prompt }],
      maxTokens: 2000,
    });

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON parse edilemedi: " + rawText.slice(0, 200));

    const report = JSON.parse(jsonMatch[0]) as {
      summary: string;
      overallExploitability: "Yüksek" | "Orta" | "Düşük";
      scenarios: Array<{
        findingTitle: string;
        exploitable: boolean;
        probability: "Yüksek" | "Orta" | "Düşük";
        attackChain: string;
        impact: string;
        mitigation: string;
        priority: number;
      }>;
      attackNarrative: string;
      topRemediation: string[];
    };

    await db
      .update(basSimulationsTable)
      .set({
        status: "completed",
        reportJson: report,
        completedAt: new Date(),
      })
      .where(eq(basSimulationsTable.id, simId));

    logger.info({ simId, domain }, "bas-lite: analiz tamamlandı");
  } catch (err) {
    logger.error({ err, simId }, "bas-lite: analiz başarısız");
    await db
      .update(basSimulationsTable)
      .set({ status: "failed", errorMessage: String(err) })
      .where(eq(basSimulationsTable.id, simId));
  }
}

export default router;
