import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { customerIntegrationsTable, integrationEventsTable, customersTable, domainScansTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireCustomer, getCustomerId } from "../../middleware/auth";
import { testIntegration } from "../../services/integrations";
import { logger } from "../../lib/logger";
import { z } from "zod";

const router = Router();

// ─── Pro plan gate ────────────────────────────────────────────────────────────

async function requireProPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
  const customerId = getCustomerId(req) as number | undefined;
  if (!customerId) { res.status(401).json({ error: "Giriş gerekli" }); return; }
  const [customer] = await db
    .select({ plan: customersTable.subscriptionPlan })
    .from(customersTable)
    .where(eq(customersTable.id, customerId));
  if (customer?.plan !== "pro") {
    res.status(403).json({ error: "Bu özellik Pro pakete özeldir", upgradeRequired: true });
    return;
  }
  next();
}

// Apply auth + pro gate to all integration routes
router.use(requireCustomer, requireProPlan);

const IntegrationTypes = ["jira", "forti_manager", "qradar", "forti_siem", "crowdstrike", "trend_micro"] as const;

const CreateIntegrationSchema = z.object({
  type: z.enum(IntegrationTypes),
  name: z.string().min(1).max(100),
  config: z.record(z.string(), z.string()),
  active: z.boolean().optional().default(true),
});

const UpdateIntegrationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  config: z.record(z.string(), z.string()).optional(),
  active: z.boolean().optional(),
});

// GET /api/integrations
router.get("/integrations", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req) as number;
  const rows = await db
    .select()
    .from(customerIntegrationsTable)
    .where(eq(customerIntegrationsTable.customerId, customerId))
    .orderBy(desc(customerIntegrationsTable.createdAt));

  const masked = rows.map(r => ({
    ...r,
    config: maskConfig(r.config as Record<string, string>),
  }));
  res.json(masked);
});

// GET /api/integrations/:id/events
router.get("/integrations/:id/events", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req) as number;
  const id = Number(req.params["id"]);
  if (!id) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  const [integration] = await db.select().from(customerIntegrationsTable)
    .where(and(eq(customerIntegrationsTable.id, id), eq(customerIntegrationsTable.customerId, customerId)));
  if (!integration) { res.status(404).json({ error: "Entegrasyon bulunamadı" }); return; }

  const events = await db.select().from(integrationEventsTable)
    .where(eq(integrationEventsTable.integrationId, id))
    .orderBy(desc(integrationEventsTable.createdAt))
    .limit(50);
  res.json(events);
});

// POST /api/integrations — create
router.post("/integrations", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req) as number;
  const parsed = CreateIntegrationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Geçersiz veri", details: parsed.error.issues });
    return;
  }

  const [row] = await db.insert(customerIntegrationsTable).values({
    customerId,
    type: parsed.data.type,
    name: parsed.data.name,
    config: parsed.data.config,
    active: parsed.data.active,
  }).returning();
  if (!row) { res.status(500).json({ error: "Kayıt oluşturulamadı" }); return; }
  res.status(201).json({ ...row, config: maskConfig(row.config as Record<string, string>) });
});

// PATCH /api/integrations/:id — update
router.patch("/integrations/:id", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req) as number;
  const id = Number(req.params["id"]);
  if (!id) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  const [existing] = await db.select().from(customerIntegrationsTable)
    .where(and(eq(customerIntegrationsTable.id, id), eq(customerIntegrationsTable.customerId, customerId)));
  if (!existing) { res.status(404).json({ error: "Entegrasyon bulunamadı" }); return; }

  const parsed = UpdateIntegrationSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Geçersiz veri" }); return; }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.active !== undefined) updates.active = parsed.data.active;
  if (parsed.data.config !== undefined) {
    const merged: Record<string, string> = { ...(existing.config as Record<string, string>) };
    for (const [k, v] of Object.entries(parsed.data.config)) {
      if (v !== "*****") merged[k] = v;
    }
    updates.config = merged;
  }

  const [updated] = await db.update(customerIntegrationsTable).set(updates)
    .where(eq(customerIntegrationsTable.id, id)).returning();
  if (!updated) { res.status(500).json({ error: "Güncelleme başarısız" }); return; }
  res.json({ ...updated, config: maskConfig(updated.config as Record<string, string>) });
});

// DELETE /api/integrations/:id
router.delete("/integrations/:id", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req) as number;
  const id = Number(req.params["id"]);
  if (!id) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  const [existing] = await db.select().from(customerIntegrationsTable)
    .where(and(eq(customerIntegrationsTable.id, id), eq(customerIntegrationsTable.customerId, customerId)));
  if (!existing) { res.status(404).json({ error: "Entegrasyon bulunamadı" }); return; }

  await db.delete(customerIntegrationsTable).where(eq(customerIntegrationsTable.id, id));
  res.json({ ok: true });
});

// POST /api/integrations/:id/test — test saved integration
router.post("/integrations/:id/test", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req) as number;
  const id = Number(req.params["id"]);
  if (!id) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  const [integration] = await db.select().from(customerIntegrationsTable)
    .where(and(eq(customerIntegrationsTable.id, id), eq(customerIntegrationsTable.customerId, customerId)));
  if (!integration) { res.status(404).json({ error: "Entegrasyon bulunamadı" }); return; }

  const result = await testIntegration(integration.type, integration.config as Record<string, string>);

  await db.insert(integrationEventsTable).values({
    integrationId: id,
    eventType: "connection_test",
    status: result.ok ? "success" : "error",
    summary: result.message,
    itemsPushed: 0,
    errorMessage: result.ok ? null : result.message,
  }).catch(() => null);

  await db.update(customerIntegrationsTable)
    .set({
      lastSyncAt: new Date(),
      lastSyncStatus: result.ok ? "success" : "error",
      lastSyncError: result.ok ? null : result.message,
    })
    .where(eq(customerIntegrationsTable.id, id));

  res.json(result);
});

// POST /api/integrations/test-config — test without saving
router.post("/integrations/test-config", requireCustomer, async (req: Request, res: Response) => {
  const schema = z.object({
    type: z.enum(IntegrationTypes),
    config: z.record(z.string(), z.string()),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Geçersiz veri" }); return; }
  const result = await testIntegration(parsed.data.type, parsed.data.config);
  res.json(result);
});

// ─── Domain scan findings builder ────────────────────────────────────────────

type Finding = { domain: string; severity: string; title: string; description: string; recommendation: string };

function buildFindingsFromScan(scan: typeof domainScansTable.$inferSelect): Finding[] {
  const findings: Finding[] = [];
  const domain = scan.domain;
  const cves = (scan.cveSummary as Array<{ service: string; cveId: string; description: string; cvssScore: number }> ?? []);

  for (const cve of cves) {
    const severity = cve.cvssScore >= 9 ? "Kritik" : cve.cvssScore >= 7 ? "Yüksek" : "Orta";
    findings.push({ domain, severity, title: `${cve.cveId} — ${cve.service}`, description: `CVSS ${cve.cvssScore}: ${cve.description}`, recommendation: "İlgili servis için güvenlik yamasını acilen uygulayın." });
  }
  if (!scan.spfPass) findings.push({ domain, severity: "Yüksek", title: "SPF Kaydı Eksik", description: "E-posta sahteciliğine karşı SPF koruması bulunmuyor.", recommendation: "DNS'e SPF TXT kaydı ekleyin." });
  if (!scan.dmarcPass) findings.push({ domain, severity: "Yüksek", title: "DMARC Koruması Yok", description: "Domain spoofing saldırılarına karşı DMARC politikası tanımlanmamış.", recommendation: "DMARC politikası oluşturun ve yayımlayın." });
  if (!scan.dkimPass) findings.push({ domain, severity: "Orta", title: "DKIM İmzası Eksik", description: "E-posta bütünlüğü kriptografik olarak doğrulanamıyor.", recommendation: "DKIM anahtarı oluşturun ve DNS'e ekleyin." });
  if (!scan.sslPass) findings.push({ domain, severity: "Kritik", title: "SSL/TLS Sertifikası Geçersiz", description: "Aktif SSL sertifikası yok veya süresi dolmuş.", recommendation: "Geçerli SSL sertifikası edinin ve yapılandırın." });
  else if (scan.sslDaysUntilExpiry !== null && scan.sslDaysUntilExpiry < 30)
    findings.push({ domain, severity: "Yüksek", title: `SSL Sertifikası ${scan.sslDaysUntilExpiry} Gün İçinde Sona Eriyor`, description: "SSL sertifikası yakında geçersiz olacak.", recommendation: "SSL sertifikasını hemen yenileyin." });
  if (scan.blacklisted) findings.push({ domain, severity: "Kritik", title: `Kara Listede Kayıtlı (${scan.blacklistCount} liste)`, description: "Domain spam veya zararlı içerik listelerinde yer alıyor.", recommendation: "Kara liste kaldırma işlemi başlatın." });
  if (scan.urlhausListed) findings.push({ domain, severity: "Kritik", title: "URLhaus Kötü Amaçlı URL Listesinde", description: `URLhaus tehdit veritabanında kayıtlı${scan.urlhausThreat ? ` (${scan.urlhausThreat})` : ""}.`, recommendation: "URLhaus'a kaldırma talebi gönderin, sistemi temizleyin." });
  if (scan.usomListed) findings.push({ domain, severity: "Kritik", title: "USOM Türkiye Siber Tehdit Listesinde", description: "BTK siber tehdit listesinde kayıtlı.", recommendation: "USOM ile iletişime geçin." });
  if (scan.safeBrowsingFlagged) findings.push({ domain, severity: "Kritik", title: "Google Safe Browsing Tehdit Tespiti", description: "Google bu domaini zararlı olarak işaretlemiş.", recommendation: "Google Search Console'dan kaldırma talebi gönderin." });
  if (scan.hibpBreachCount > 0) findings.push({ domain, severity: "Yüksek", title: `${scan.hibpBreachCount} Veri İhlali Geçmişi (HIBP)`, description: "Bu domaine ait e-posta adresleri veri ihlallerinde sızdırılmış.", recommendation: "Etkilenen hesapların şifrelerini değiştirin, MFA etkinleştirin." });
  if (scan.httpHeadersScore < 40) findings.push({ domain, severity: "Orta", title: `HTTP Güvenlik Başlıkları Zayıf (${scan.httpHeadersScore}/100)`, description: "HSTS, CSP, X-Frame-Options gibi kritik başlıklar eksik.", recommendation: "Web sunucuya güvenlik başlıklarını ekleyin." });
  if (scan.virusTotalMalicious > 0) findings.push({ domain, severity: scan.virusTotalMalicious > 5 ? "Kritik" : "Yüksek", title: `VirusTotal: ${scan.virusTotalMalicious} Motor Zararlı Tespit Etti`, description: "Birden fazla antivirüs motoru bu domaini zararlı işaretlemiş.", recommendation: "Sistemi tam kapsamlı kötü yazılım taramasından geçirin." });
  return findings;
}

// POST /api/integrations/push/domain-scan/:scanId — manuel tetikleme
router.post("/integrations/push/domain-scan/:scanId", async (req: Request, res: Response) => {
  const customerId = getCustomerId(req) as number;
  const scanId = Number(req.params["scanId"]);
  if (!scanId) { res.status(400).json({ error: "Geçersiz tarama ID" }); return; }

  const [scan] = await db.select().from(domainScansTable).where(eq(domainScansTable.id, scanId));
  if (!scan) { res.status(404).json({ error: "Tarama bulunamadı" }); return; }

  const findings = buildFindingsFromScan(scan);
  if (findings.length === 0) {
    res.json({ ok: true, pushed: 0, message: "Gönderilecek bulgu bulunamadı." });
    return;
  }

  await pushToCustomerIntegrations(customerId, "findings", { findings });
  logger.info({ customerId, scanId, count: findings.length }, "Domain scan findings pushed");
  res.json({ ok: true, pushed: findings.length, message: `${findings.length} bulgu entegrasyonlara gönderildi.` });
});

// ─── Secret masking ───────────────────────────────────────────────────────────

const SECRET_KEYS = ["password", "apiToken", "clientSecret", "token", "secret", "passwd"];

function maskConfig(config: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(config)) {
    const isSecret = SECRET_KEYS.some(s => k.toLowerCase().includes(s.toLowerCase()));
    out[k] = isSecret && v ? "*****" : v;
  }
  return out;
}

// ─── Exported automation helper ───────────────────────────────────────────────

export async function pushToCustomerIntegrations(
  customerId: number | null | undefined,
  eventType: "findings" | "blocklist",
  payload: {
    findings?: Array<{ domain: string; severity: string; title: string; description: string; recommendation: string }>;
    blocklist?: string[];
  }
): Promise<void> {
  if (!customerId) return;
  try {
    const integrations = await db.select().from(customerIntegrationsTable)
      .where(and(eq(customerIntegrationsTable.customerId, customerId), eq(customerIntegrationsTable.active, true)));

    for (const integration of integrations) {
      const cfg = integration.config as Record<string, string>;
      let result: { ok: boolean; pushed?: number; created?: number; sent?: number; message: string } = { ok: false, message: "Bu entegrasyon türü bu olay için desteklenmiyor" };

      if (eventType === "findings" && payload.findings) {
        if (integration.type === "jira") {
          const { jiraBulkCreateFromFindings } = await import("../../services/integrations");
          const r = await jiraBulkCreateFromFindings(cfg as never, payload.findings);
          result = { ok: r.created > 0, created: r.created, message: `${r.created} ticket oluşturuldu, ${r.errors} hata` };
        } else if (integration.type === "qradar") {
          const { qradarSendEvents } = await import("../../services/integrations");
          const events = payload.findings.map(f => ({
            source: f.domain,
            severity: f.severity === "Kritik" ? 10 : f.severity === "Yüksek" ? 7 : 4,
            name: f.title,
            description: f.description,
          }));
          result = await qradarSendEvents(cfg as never, events);
        } else if (integration.type === "forti_siem") {
          const { fortiSIEMSendIncidents } = await import("../../services/integrations");
          const incidents = payload.findings.map(f => ({
            title: f.title, description: f.description, source: f.domain,
            severity: (f.severity === "Kritik" ? "1" : f.severity === "Yüksek" ? "2" : "3") as "1" | "2" | "3" | "4" | "5",
          }));
          result = await fortiSIEMSendIncidents(cfg as never, incidents);
        }
      }

      if (eventType === "blocklist" && payload.blocklist) {
        if (integration.type === "forti_manager") {
          const { fortiManagerPushBlocklist } = await import("../../services/integrations");
          result = await fortiManagerPushBlocklist(cfg as never, payload.blocklist);
        } else if (integration.type === "crowdstrike") {
          const { crowdStrikePushIOCs } = await import("../../services/integrations");
          const iocs = payload.blocklist.map(ip => ({
            type: "ipv4" as const, value: ip,
            severity: "high" as const,
            description: "CyberStep tehdit istihbaratı engel listesi",
          }));
          result = await crowdStrikePushIOCs(cfg as never, iocs);
        } else if (integration.type === "trend_micro") {
          const { trendMicroPushIOCs } = await import("../../services/integrations");
          const iocs = payload.blocklist.map(ip => ({
            type: "ip" as const, value: ip,
            description: "CyberStep tehdit istihbaratı engel listesi",
          }));
          result = await trendMicroPushIOCs(cfg as never, iocs);
        }
      }

      await db.insert(integrationEventsTable).values({
        integrationId: integration.id,
        eventType,
        status: result.ok ? "success" : "error",
        summary: result.message,
        itemsPushed: result.pushed ?? result.created ?? result.sent ?? 0,
        errorMessage: result.ok ? null : result.message,
      }).catch(() => null);

      await db.update(customerIntegrationsTable)
        .set({
          lastSyncAt: new Date(),
          lastSyncStatus: result.ok ? "success" : "error",
          lastSyncError: result.ok ? null : result.message,
        })
        .where(eq(customerIntegrationsTable.id, integration.id))
        .catch(() => null);
    }
  } catch (err) {
    logger.warn({ err, customerId, eventType }, "Integration push failed");
  }
}

export default router;
