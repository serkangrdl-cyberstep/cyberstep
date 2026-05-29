import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { siteSettingsTable, pricingPlansTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "./middleware";
import { logger } from "../../lib/logger";

const router = Router();

// GET /api/admin-panel/settings
router.get("/admin-panel/settings", requireAdmin, async (_req: Request, res: Response) => {
  const rows = await db.select().from(siteSettingsTable);
  const settings: Record<string, string> = {};
  for (const r of rows) settings[r.key] = r.value;
  res.json(settings);
});

// PUT /api/admin-panel/settings
router.put("/admin-panel/settings", requireAdmin, async (req: Request, res: Response) => {
  const updates = req.body as Record<string, string>;
  for (const [key, value] of Object.entries(updates)) {
    await db.insert(siteSettingsTable)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({ target: siteSettingsTable.key, set: { value, updatedAt: new Date() } });
  }
  logger.info({ keys: Object.keys(updates) }, "Site settings updated");
  res.json({ success: true });
});

// GET /api/admin-panel/pricing
router.get("/admin-panel/pricing", requireAdmin, async (_req: Request, res: Response) => {
  const plans = await db.select().from(pricingPlansTable).orderBy(pricingPlansTable.sortOrder);
  res.json(plans);
});

// PUT /api/admin-panel/pricing/:id
router.put("/admin-panel/pricing/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { name, price, description, features, isActive } = req.body as {
    name?: string; price?: string; description?: string; features?: string[]; isActive?: boolean;
  };

  const [updated] = await db.update(pricingPlansTable)
    .set({ ...(name !== undefined && { name }), ...(price !== undefined && { price }), ...(description !== undefined && { description }), ...(features !== undefined && { features }), ...(isActive !== undefined && { isActive }), updatedAt: new Date() })
    .where(eq(pricingPlansTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Plan bulunamadı" }); return; }
  logger.info({ planId: id }, "Pricing plan updated");
  res.json(updated);
});

// POST /api/admin-panel/pricing — yeni plan oluştur
router.post("/admin-panel/pricing", requireAdmin, async (req: Request, res: Response) => {
  const { slug, name, price, description, features, isActive, sortOrder } = req.body as {
    slug: string; name: string; price?: string; description?: string;
    features?: string[]; isActive?: boolean; sortOrder?: number;
  };
  if (!slug || !name) { res.status(400).json({ error: "slug ve name zorunludur" }); return; }
  const [created] = await db.insert(pricingPlansTable)
    .values({ slug, name, price: price ?? "0", description: description ?? "", features: features ?? [], isActive: isActive ?? true, sortOrder: sortOrder ?? 99 })
    .returning();
  logger.info({ id: created.id, slug }, "Pricing plan created");
  res.status(201).json(created);
});

// GET /api/admin-panel/pricing (public — no auth)
router.get("/public/pricing", async (_req: Request, res: Response) => {
  const plans = await db.select().from(pricingPlansTable)
    .where(eq(pricingPlansTable.isActive, true))
    .orderBy(pricingPlansTable.sortOrder);
  res.json(plans);
});

// GET /api/admin-panel/settings/services — hangi dış servisler aktif
router.get("/admin-panel/settings/services", requireAdmin, (_req: Request, res: Response) => {
  const env = process.env;
  const services = [
    // ─── Her zaman aktif (API anahtarı gerektirmez) ───────────────────────────
    { name: "Gemini AI",      category: "AI",         always: true,  active: !!(env["AI_INTEGRATIONS_GEMINI_BASE_URL"] || env["AI_INTEGRATIONS_GEMINI_API_KEY"]), desc: "Rapor üretimi ve AI destekli analiz (Replit tarafından sağlanır)" },
    { name: "HIBP",           category: "Tehdit",     always: true,  active: true, desc: "Have I Been Pwned — alan adı e-posta sızıntısı taraması" },
    { name: "URLhaus",        category: "Tehdit",     always: true,  active: true, desc: "abuse.ch URLhaus — zararlı URL kara listesi kontrolü" },
    { name: "USOM",           category: "Tehdit",     always: true,  active: true, desc: "USOM (usom.gov.tr) — Türkiye siber tehdit kara listesi" },
    { name: "NVD CVE",        category: "Tehdit",     always: true,  active: true, desc: "NIST NVD — tespit edilen servisler için CVE açık taraması" },
    { name: "DNSBL",          category: "E-posta",    always: true,  active: true, desc: "DNS tabanlı kara liste kontrolü (Spamhaus, Barracuda vb.)" },
    { name: "SSL/TLS",        category: "Altyapı",    always: true,  active: true, desc: "Sertifika geçerlilik, zincir ve sona erme tarihi kontrolü" },
    { name: "SPF/DMARC/DKIM", category: "E-posta",    always: true,  active: true, desc: "E-posta kimlik doğrulama kayıtları analizi" },
    { name: "SSLLabs",        category: "Altyapı",    always: true,  active: true,                           alacart: false, desc: "Qualys SSLLabs — TLS protokol versiyonu, şifreleme zayıflığı ve sertifika zinciri analizi (ücretsiz, ön bellek kullanılır)" },
    // ─── API anahtarı gerektiren servisler ──────────────────────────────────
    { name: "Google Safe Browsing", category: "İtibar", always: false, active: !!env["GOOGLE_SAFE_BROWSING_API_KEY"], alacart: false, desc: "Google'ın kötü amaçlı yazılım ve phishing tespiti — domain 'güvensiz' işaretlenmiş mi?" },
    { name: "VirusTotal",     category: "Tehdit",     always: false, active: !!env["VIRUSTOTAL_API_KEY"],  alacart: false, desc: "Alan adı zararlı yazılım ve tehdit istihbarat taraması" },
    { name: "AbuseIPDB",      category: "Tehdit",     always: false, active: !!env["ABUSEIPDB_API_KEY"],  alacart: false, desc: "IP adresi kötüye kullanım geçmişi ve itibar kontrolü" },
    { name: "Shodan",         category: "Altyapı",    always: false, active: !!env["SHODAN_API_KEY"],     alacart: true,  desc: "A-la-cart servis: Açık port ve servis keşfi, donanım parmak izi, bilinen CVE eşleştirme. Shodan API anahtarı gerektirir (shodan.io ücretsiz/ücretli plan)." },
    { name: "WhoisXML",       category: "Altyapı",    always: false, active: !!env["WHOISXML_API_KEY"],   alacart: true,  desc: "A-la-cart servis: Domain kayıt geçmişi, sahiplik bilgileri ve DNS değişikliği takibi (Domain Hijacking tespiti). WhoisXML API aboneliği gerektirir (whoisxmlapi.com)." },
    { name: "SMTP E-posta",   category: "İletişim",   always: false, active: !!env["SMTP_PASS"],          alacart: false, desc: "Bülten ve bildirim e-postası gönderimi" },
    { name: "ISR IMAP",       category: "İletişim",   always: false, active: !!env["ISR_IMAP_PASS"],      alacart: false, desc: "AI Satış Asistanı — gelen kutusu okuma ve yanıtlama" },
  ];
  res.json(services);
});

// GET /api/admin-panel/settings/public (no auth — for footer/about pages)
router.get("/public/settings", async (_req: Request, res: Response) => {
  const rows = await db.select().from(siteSettingsTable);
  const settings: Record<string, string> = {};
  for (const r of rows) settings[r.key] = r.value;
  res.json(settings);
});

export default router;
