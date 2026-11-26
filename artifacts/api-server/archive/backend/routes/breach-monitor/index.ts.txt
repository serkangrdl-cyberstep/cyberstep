import { Router, type Request, type Response } from "express";
import { checkHIBP } from "../domain-scan/index";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../../lib/logger";

const router = Router();

// Basit in-memory rate limit: IP başına saatte 5 sorgu
const ipRequestMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipRequestMap.get(ip);
  if (!entry || now > entry.resetAt) {
    ipRequestMap.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return false;
  }
  if (entry.count >= 5) return true;
  entry.count++;
  return false;
}

// Sorgu kaydını DB'ye yaz (analitik + rate limit persist için)
async function logRequest(domain: string, ip: string, breachCount: number) {
  try {
    await db.execute(sql`
      INSERT INTO breach_monitor_requests (domain, ip_hash, breach_count, queried_at)
      VALUES (${domain}, md5(${ip}), ${breachCount}, NOW())
    `);
  } catch {
    // Tablo yoksa sessizce geç — startup migration bunu ele alır
  }
}

// POST /api/breach-monitor/check
router.post("/breach-monitor/check", async (req: Request, res: Response) => {
  const ip = (req.ip ?? req.socket.remoteAddress ?? "unknown");
  if (isRateLimited(ip)) {
    res.status(429).json({ error: "Saatte en fazla 5 sorgu yapabilirsiniz. Lütfen daha sonra tekrar deneyin." });
    return;
  }

  const { domain } = req.body as { domain?: string };
  if (!domain || typeof domain !== "string") {
    res.status(400).json({ error: "Domain adresi gerekli" });
    return;
  }

  // Domain temizle: boşluklar, protokol, www, path
  const cleaned = domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    ?.split("?")[0] ?? "";

  if (!cleaned || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(cleaned)) {
    res.status(400).json({ error: "Geçerli bir domain adresi girin (örn: sirketiniz.com)" });
    return;
  }

  logger.info({ domain: cleaned, ip: ip.slice(0, 8) + "***" }, "Breach monitor query");

  try {
    const result = await checkHIBP(cleaned);
    await logRequest(cleaned, ip, result.breachCount);

    // Freemium model:
    // - Ücretsiz: ihlal sayısı + ihlal adları + toplam etkilenen hesap sayısı
    // - Kilitli: tam veri kategorileri detayı (Pro özelliği olarak işaretlenir)
    const breaches = result.breaches.map(b => ({
      name: b.name,
      breachDate: b.breachDate,
      pwnCount: b.pwnCount,
      // Veri kategorileri freemium'da kısıtlı — sadece sayı göster
      dataClassCount: b.dataClasses.length,
      // İlk veri kategorisi ücretsiz, geri kalanı Pro
      dataClassPreview: b.dataClasses[0] ?? null,
    }));

    res.json({
      domain: cleaned,
      breachCount: result.breachCount,
      totalPwnCount: result.breaches.reduce((sum, b) => sum + b.pwnCount, 0),
      breaches,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error({ err, domain: cleaned }, "Breach monitor check failed");
    res.status(500).json({ error: "Sızıntı kontrolü şu an yapılamıyor. Lütfen tekrar deneyin." });
  }
});

export default router;
