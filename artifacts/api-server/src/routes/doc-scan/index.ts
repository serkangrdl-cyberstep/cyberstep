import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { documentScansTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createHash } from "crypto";
import { logger } from "../../lib/logger";
import { getClaudeAiFn } from "../../services/ai-client";

const router = Router();
const claudeFn = getClaudeAiFn();

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// IP-based rate limit: max 5 document scans per IP per hour (prevents AI credit abuse)
const scanRateMap = new Map<string, { count: number; resetAt: number }>();
function checkDocScanLimit(req: Request): boolean {
  const ip = String(req.ip ?? req.socket?.remoteAddress ?? "unknown");
  const now = Date.now();
  const entry = scanRateMap.get(ip);
  if (!entry || entry.resetAt < now) {
    scanRateMap.set(ip, { count: 1, resetAt: now + 3600_000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

// ─── POST /api/document-scan/scan ─────────────────────────────────────────────

router.post("/api/document-scan/scan", async (req: Request, res: Response): Promise<void> => {
  if (!checkDocScanLimit(req)) {
    res.status(429).json({ error: "Saatlik tarama limitine ulaştınız. Lütfen daha sonra tekrar deneyin." });
    return;
  }
  try {
    const contentType = req.headers["content-type"] ?? "";
    if (!contentType.includes("application/json")) {
      res.status(400).json({ error: "JSON gönder: { filename, fileType, fileBase64 }" });
      return;
    }

    const { filename, fileType, fileBase64 } = req.body as {
      filename?: string; fileType?: string; fileBase64?: string;
    };

    if (!fileBase64) { res.status(400).json({ error: "fileBase64 zorunlu" }); return; }

    const fileBuffer = Buffer.from(fileBase64, "base64");
    if (fileBuffer.length > MAX_FILE_SIZE) {
      res.status(400).json({ error: "Dosya 10MB'dan büyük olamaz" });
      return;
    }

    const fileHash = createHash("sha256").update(fileBuffer).digest("hex");
    const fileSizeKb = Math.round(fileBuffer.length / 1024);

    // ── Metadata analysis ──────────────────────────────────────────────────────
    const metadataAnomalies: string[] = [];
    const riskFactors: string[] = [];
    let aiGenerationProbability = 0;
    let manipulationProbability = 0;

    if (fileType === "pdf") {
      // Simple heuristic: check if PDF has suspicious binary patterns
      const pdfText = fileBuffer.toString("binary");
      if (!pdfText.includes("%PDF")) {
        metadataAnomalies.push("Geçerli PDF başlığı bulunamadı");
        riskFactors.push("Dosya formatı anomalisi");
        manipulationProbability += 30;
      }
      // Check for common PDF generators that indicate AI tools
      if (pdfText.includes("ChatGPT") || pdfText.includes("Claude") || pdfText.includes("Canva")) {
        metadataAnomalies.push("AI araç imzası tespit edildi");
        riskFactors.push("AI oluşturma aracı izi");
        aiGenerationProbability += 60;
      }
    }

    if (fileType === "image" || fileType === "jpg" || fileType === "jpeg" || fileType === "png") {
      // Check for EXIF anomalies via buffer heuristics
      const hexStart = fileBuffer.slice(0, 4).toString("hex");
      const isJpeg = hexStart.startsWith("ffd8ff");
      const isPng = hexStart === "89504e47";
      if (!isJpeg && !isPng) {
        metadataAnomalies.push("Dosya uzantısı içerikle uyuşmuyor");
        riskFactors.push("Format tutarsızlığı");
        manipulationProbability += 20;
      }
    }

    // ── Hive AI API (if key set) ───────────────────────────────────────────────
    if (process.env["HIVE_API_KEY"] && (fileType === "image" || fileType === "jpg" || fileType === "png")) {
      try {
        const axios = (await import("axios")).default;
        const hiveRes = await axios.post(
          "https://api.thehive.ai/api/v2/task/sync",
          { input: [{ type: "image", data: fileBase64 }] },
          { headers: { Authorization: `Token ${process.env["HIVE_API_KEY"]}`, "Content-Type": "application/json" } }
        );
        const aiScore: number = hiveRes.data?.status?.[0]?.response?.output?.[0]
          ?.classes?.find((c: { class: string; score: number }) => c.class === "ai_generated")?.score ?? 0;
        aiGenerationProbability = Math.max(aiGenerationProbability, Math.round(aiScore * 100));
        if (aiScore > 0.7) riskFactors.push("Yapay zeka ile oluşturulmuş içerik tespit edildi");
      } catch (e) {
        logger.warn({ err: e }, "Hive API error");
      }
    }

    // ── Verdict ───────────────────────────────────────────────────────────────
    const maxRisk = Math.max(
      aiGenerationProbability,
      manipulationProbability,
      metadataAnomalies.length * 20
    );
    const verdict = maxRisk > 75 ? "manipulated"
      : maxRisk > 55 ? "likely_ai"
      : maxRisk > 30 ? "suspicious"
      : "authentic";
    const confidence = Math.min(95, 60 + riskFactors.length * 10);

    // ── Claude analysis summary ───────────────────────────────────────────────
    let analysisSummary = "";
    try {
      const claudePrompt = `
Bir belge güvenlik uzmanısın. Türkçe, kısa (2-3 cümle) analiz yaz.

DOSYA: ${filename ?? "bilinmiyor"} (${fileType ?? "bilinmiyor"}, ${fileSizeKb}KB)
AI ÜRETIM OLASILIGI: %${aiGenerationProbability}
MANİPÜLASYON OLASILIGI: %${manipulationProbability}
METADATA ANOMALİLERİ: ${metadataAnomalies.join(", ") || "yok"}
RİSK FAKTÖRLERİ: ${riskFactors.join(", ") || "yok"}
KARAR: ${verdict}

Bu belgenin güvenilirliği hakkında patron diline 2-3 cümle yaz. Sadece metin döndür.`;

      analysisSummary = await claudeFn(claudePrompt);
    } catch (e) {
      analysisSummary = verdict === "authentic"
        ? "Belge standart formatlara uygun görünüyor, belirgin anomali tespit edilmedi."
        : "Belgede şüpheli işaretler tespit edildi. Daha ayrıntılı inceleme önerilir.";
    }

    const [row] = await db.insert(documentScansTable).values({
      filename: filename ?? "unnamed",
      fileType: fileType ?? "unknown",
      fileSizeKb,
      fileHash,
      aiGenerationProbability: String(aiGenerationProbability),
      manipulationProbability: String(manipulationProbability),
      metadataAnomalies: { items: metadataAnomalies },
      riskFactors,
      verdict,
      confidence,
      analysisSummary,
      paymentType: "single",
    }).returning({ id: documentScansTable.id });

    res.json({
      id: row.id,
      verdict,
      confidence,
      aiGenerationProbability,
      manipulationProbability,
      metadataAnomalies,
      riskFactors,
      analysisSummary,
    });
  } catch (e) {
    logger.error({ err: e }, "Document scan error");
    res.status(500).json({ error: "Tarama başarısız" });
  }
});

// ─── GET /api/document-scan/:id ───────────────────────────────────────────────

router.get("/api/document-scan/:id", async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params["id"]);
  const rows = await db.select().from(documentScansTable)
    .where(eq(documentScansTable.id, id)).limit(1);
  if (!rows[0]) { res.status(404).json({ error: "Bulunamadı" }); return; }
  res.json(rows[0]);
});

export default router;
