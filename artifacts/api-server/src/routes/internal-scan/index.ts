import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { db, pool } from "@workspace/db";
import { internalScansTable, customersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireCustomer, getCustomerId } from "../../middleware/auth";
import { logger } from "../../lib/logger";
import { calculateInternalScore } from "../../services/internal-scan-scorer";
import { readFileSync } from "fs";
import { join } from "path";

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getOrCreateApiKey(customerId: number): Promise<string> {
  const row = await pool.query<{ api_key: string | null }>(
    "SELECT api_key FROM customers WHERE id = $1",
    [customerId],
  );
  if (row.rows[0]?.api_key) return row.rows[0].api_key;

  const key = "cs_" + crypto.randomBytes(24).toString("hex");
  await pool.query(
    "UPDATE customers SET api_key = $1 WHERE id = $2 AND api_key IS NULL",
    [key, customerId],
  );
  return key;
}

async function resolveCustomerByApiKey(apiKey: string): Promise<number | null> {
  const row = await pool.query<{ id: number }>(
    "SELECT id FROM customers WHERE api_key = $1",
    [apiKey],
  );
  return row.rows[0]?.id ?? null;
}

function getAppUrl(): string {
  const domains = process.env["REPLIT_DOMAINS"] ?? "";
  const first = domains.split(",")[0]?.trim();
  if (first) return `https://${first}`;
  return "https://cyberstep.io";
}

function generateWindowsScript(customerId: number, apiKey: string, apiUrl: string): string {
  try {
    const template = readFileSync(
      join(process.cwd(), "../../scripts/internal-scan/cyberstep-scan.ps1"),
      "utf8",
    );
    return template
      .replace("{{CUSTOMER_ID}}", String(customerId))
      .replace("{{API_KEY}}", apiKey)
      .replace("{{API_URL}}", apiUrl);
  } catch {
    return `# CyberStep İç Tarama - Windows\n$CustomerId = "${customerId}"\n$ApiKey = "${apiKey}"\n$ApiUrl = "${apiUrl}"\n`;
  }
}

function generateLinuxScript(customerId: number, apiKey: string, apiUrl: string): string {
  try {
    const template = readFileSync(
      join(process.cwd(), "../../scripts/internal-scan/cyberstep-scan.sh"),
      "utf8",
    );
    return template
      .replace("{{CUSTOMER_ID}}", String(customerId))
      .replace("{{API_KEY}}", apiKey)
      .replace("{{API_URL}}", apiUrl);
  } catch {
    return `#!/bin/bash\nCUSTOMER_ID="${customerId}"\nAPI_KEY="${apiKey}"\nAPI_URL="${apiUrl}"\n`;
  }
}

// ─── POST /api/internal-scan/upload — API key auth ────────────────────────────

router.post("/api/internal-scan/upload", async (req: Request, res: Response) => {
  const authHeader = req.headers["authorization"] ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ error: "Authorization: Bearer <api_key> gerekli" });
    return;
  }
  const apiKey = match[1] ?? "";
  const customerId = await resolveCustomerByApiKey(apiKey);
  if (!customerId) {
    res.status(401).json({ error: "Geçersiz API anahtarı" });
    return;
  }

  const scanData = req.body as Record<string, unknown>;
  if (!scanData["scan_type"] || !scanData["scanned_at"]) {
    res.status(400).json({ error: "Geçersiz tarama verisi: scan_type ve scanned_at zorunlu" });
    return;
  }

  const result = calculateInternalScore(scanData);

  const [saved] = await db.insert(internalScansTable).values({
    customerId,
    scanType: String(scanData["scan_type"] ?? ""),
    scanVersion: String(scanData["scan_version"] ?? ""),
    hostname: String(scanData["hostname"] ?? ""),
    rawData: scanData,
    internalScore: result.score,
    scoreBreakdown: result.breakdown,
    findingsCount: result.findings.length,
    scannedAt: new Date(String(scanData["scanned_at"])),
  }).returning();

  logger.info({ customerId, scanId: saved?.id, score: result.score }, "internal scan uploaded");

  res.json({
    success: true,
    scanId: saved?.id,
    internalScore: result.score,
    findings: result.findings,
  });
});

// ─── GET /api/internal-scan/latest — session auth ────────────────────────────

router.get("/api/internal-scan/latest", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req)!;
  const scan = await db.query.internalScansTable.findFirst({
    where: eq(internalScansTable.customerId, customerId),
    orderBy: desc(internalScansTable.scannedAt),
  });
  res.json(scan ?? null);
});

// ─── GET /api/internal-scan/history — session auth ───────────────────────────

router.get("/api/internal-scan/history", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req)!;
  const scans = await db
    .select({
      id: internalScansTable.id,
      scanType: internalScansTable.scanType,
      hostname: internalScansTable.hostname,
      internalScore: internalScansTable.internalScore,
      findingsCount: internalScansTable.findingsCount,
      scannedAt: internalScansTable.scannedAt,
    })
    .from(internalScansTable)
    .where(eq(internalScansTable.customerId, customerId))
    .orderBy(desc(internalScansTable.scannedAt))
    .limit(10);
  res.json(scans);
});

// ─── GET /api/internal-scan/download-script — session auth ───────────────────

router.get("/api/internal-scan/download-script", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req)!;
  const os = req.query["os"] === "linux" ? "linux" : "windows";
  const apiKey = await getOrCreateApiKey(customerId);
  const apiUrl = getAppUrl();

  if (os === "windows") {
    const script = generateWindowsScript(customerId, apiKey, apiUrl);
    res.setHeader("Content-Disposition", "attachment; filename=\"cyberstep-scan.ps1\"");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(script);
  } else {
    const script = generateLinuxScript(customerId, apiKey, apiUrl);
    res.setHeader("Content-Disposition", "attachment; filename=\"cyberstep-scan.sh\"");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(script);
  }
});

// ─── GET /api/internal-scan/api-key — return or create api key ───────────────

router.get("/api/internal-scan/api-key", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req)!;
  const apiKey = await getOrCreateApiKey(customerId);
  res.json({ apiKey });
});

export default router;
