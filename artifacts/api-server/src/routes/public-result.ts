import { Router } from "express";
import type { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { eq } from "drizzle-orm";
import { db, domainScansTable } from "@workspace/db";

const router = Router();

const ogImageLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Çok fazla istek. 1 dakika sonra tekrar deneyin." },
});

// ─── GET /api/public/result/:token ──────────────────────────────────────────
router.get("/public/result/:token", async (req: Request, res: Response) => {
  const token = String(req.params["token"]);
  const [scan] = await db.select({
    id: domainScansTable.id,
    domain: domainScansTable.domain,
    overallScore: domainScansTable.overallScore,
    letterGrade: domainScansTable.letterGrade,
    isPubliclyShared: domainScansTable.isPubliclyShared,
    createdAt: domainScansTable.createdAt,
    badgeToken: domainScansTable.badgeToken,
  }).from(domainScansTable).where(eq(domainScansTable.badgeToken, token));

  if (!scan || !scan.isPubliclyShared) {
    res.status(404).json({ error: "Sonuç bulunamadı veya paylaşıma kapalı." });
    return;
  }

  res.json({
    domain: scan.domain,
    score: scan.overallScore,
    letterGrade: scan.letterGrade,
    scanDate: scan.createdAt,
    token: scan.badgeToken,
  });
});

// ─── GET /api/public/result/:token/og-image.png ─────────────────────────────
router.get("/public/result/:token/og-image.png", ogImageLimiter, async (req: Request, res: Response) => {
  const token = String(req.params["token"]);
  const [scan] = await db.select({
    domain: domainScansTable.domain,
    overallScore: domainScansTable.overallScore,
    letterGrade: domainScansTable.letterGrade,
    isPubliclyShared: domainScansTable.isPubliclyShared,
  }).from(domainScansTable).where(eq(domainScansTable.badgeToken, token));

  if (!scan || !scan.isPubliclyShared) {
    res.status(404).end();
    return;
  }

  const score = scan.overallScore;
  const grade = scan.letterGrade ?? "F";
  const domain = scan.domain;

  const scoreColor = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : score >= 40 ? "#f97316" : "#ef4444";
  const gradeColor = grade === "A" ? "#22c55e" : grade === "B" ? "#84cc16" : grade === "C" ? "#f59e0b" : grade === "D" ? "#f97316" : "#ef4444";

  const domainDisplay = domain.length > 30 ? domain.slice(0, 30) + "…" : domain;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#060D1A"/>
      <stop offset="100%" style="stop-color:#0D1F3C"/>
    </linearGradient>
    <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${scoreColor};stop-opacity:0.15"/>
      <stop offset="100%" style="stop-color:${scoreColor};stop-opacity:0.05"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Grid lines decoration -->
  <line x1="0" y1="315" x2="1200" y2="315" stroke="#00C8FF" stroke-opacity="0.05" stroke-width="1"/>
  <line x1="600" y1="0" x2="600" y2="630" stroke="#00C8FF" stroke-opacity="0.05" stroke-width="1"/>

  <!-- Left accent bar -->
  <rect x="0" y="0" width="6" height="630" fill="#00C8FF"/>

  <!-- Score card background -->
  <rect x="760" y="130" width="360" height="370" rx="24" fill="url(#scoreGrad)" stroke="${scoreColor}" stroke-opacity="0.3" stroke-width="1.5"/>

  <!-- Brand -->
  <text x="72" y="100" font-family="system-ui,-apple-system,sans-serif" font-size="22" font-weight="700" fill="#00C8FF" letter-spacing="3">CYBERSTEP.IO</text>
  <text x="72" y="128" font-family="system-ui,-apple-system,sans-serif" font-size="14" fill="#8899AA" letter-spacing="1">Siber Güvenlik Risk Analizi</text>

  <!-- Domain -->
  <text x="72" y="230" font-family="system-ui,-apple-system,sans-serif" font-size="42" font-weight="800" fill="#E8EDF5">${domainDisplay}</text>

  <!-- Label -->
  <text x="72" y="285" font-family="system-ui,-apple-system,sans-serif" font-size="18" fill="#8899AA">domain güvenlik skoru</text>

  <!-- Divider -->
  <rect x="72" y="310" width="560" height="2" fill="#00C8FF" opacity="0.2"/>

  <!-- Stats row -->
  <text x="72" y="370" font-family="system-ui,-apple-system,sans-serif" font-size="16" fill="#8899AA">E-posta Güvenliği · SSL/TLS · DNS · Kara Liste · HIBP</text>
  <text x="72" y="400" font-family="system-ui,-apple-system,sans-serif" font-size="16" fill="#8899AA">Shodan Port Taraması · CVE Eşleştirme · WAF Analizi</text>

  <!-- CTA -->
  <rect x="72" y="460" width="240" height="52" rx="10" fill="#00C8FF" opacity="0.15" stroke="#00C8FF" stroke-opacity="0.4" stroke-width="1.5"/>
  <text x="192" y="492" font-family="system-ui,-apple-system,sans-serif" font-size="16" font-weight="600" fill="#00C8FF" text-anchor="middle">Ücretsiz Tarama Yap →</text>

  <!-- Score number -->
  <text x="940" y="290" font-family="system-ui,-apple-system,sans-serif" font-size="120" font-weight="900" fill="${scoreColor}" text-anchor="middle">${score}</text>
  <text x="940" y="325" font-family="system-ui,-apple-system,sans-serif" font-size="18" fill="#8899AA" text-anchor="middle">/ 100 güvenlik puanı</text>

  <!-- Grade badge -->
  <rect x="876" y="355" width="128" height="80" rx="16" fill="${gradeColor}" opacity="0.15" stroke="${gradeColor}" stroke-opacity="0.5" stroke-width="2"/>
  <text x="940" y="414" font-family="system-ui,-apple-system,sans-serif" font-size="52" font-weight="900" fill="${gradeColor}" text-anchor="middle">${grade}</text>

  <!-- Grade label -->
  <text x="940" y="470" font-family="system-ui,-apple-system,sans-serif" font-size="14" fill="#8899AA" text-anchor="middle">Güvenlik Notu</text>

  <!-- Bottom bar -->
  <rect x="0" y="600" width="1200" height="30" fill="#00C8FF" opacity="0.05"/>
  <text x="600" y="621" font-family="system-ui,-apple-system,sans-serif" font-size="14" fill="#8899AA" text-anchor="middle">cyberstep.io · KOBİ'ler için Türkçe Siber Güvenlik Platformu</text>
</svg>`;

  try {
    const { Resvg } = await import("@resvg/resvg-js");
    const resvg = new Resvg(svg, { font: { loadSystemFonts: false } });
    const rendered = resvg.render();
    const png = rendered.asPng();
    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "public, max-age=300");
    res.send(Buffer.from(png));
  } catch (err) {
    res.status(500).json({ error: "Görsel oluşturulamadı" });
  }
});

export default router;
