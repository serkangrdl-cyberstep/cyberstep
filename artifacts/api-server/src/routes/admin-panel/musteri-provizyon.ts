import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import {
  customersTable,
  customerServiceConfigsTable,
  customerIntegrationsTable,
  ms365IntegrationsTable,
  customerServiceSubscriptionsTable,
  serviceCatalogTable,
  customerServicesTable,
  customerServiceOnboardingTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAdmin } from "./middleware";
import { logger } from "../../lib/logger";
import { randomUUID } from "crypto";
import { z } from "zod/v4";

const router = Router();

// ─── Zod schema for service-config PUT (T23) ──────────────────────────────────
const serviceConfigSchema = z.object({
  serviceSlug: z.string().min(1).max(100),
  config: z.record(z.string().max(100), z.string().max(2000)),
});

// ─── GET /api/admin-panel/customers/:id/provizyon ─────────────────────────────
router.get("/admin-panel/customers/:customerId/provizyon", requireAdmin, async (req: Request, res: Response) => {
  const customerId = Number(req.params["customerId"]);
  if (!customerId) { res.status(400).json({ error: "Geçersiz müşteri ID" }); return; }

  const [customer] = await db.select({
    id: customersTable.id,
    email: customersTable.email,
    fullName: customersTable.fullName,
    companyName: customersTable.companyName,
  }).from(customersTable).where(eq(customersTable.id, customerId)).limit(1);

  if (!customer) { res.status(404).json({ error: "Müşteri bulunamadı" }); return; }

  const fromCustomerServices = await db.select({
    slug: serviceCatalogTable.slug,
    label: serviceCatalogTable.label,
    subscriptionId: sql<number | null>`null`,
  }).from(customerServicesTable)
    .innerJoin(serviceCatalogTable, eq(customerServicesTable.serviceCatalogId, serviceCatalogTable.id))
    .where(and(eq(customerServicesTable.customerId, customerId), eq(customerServicesTable.status, "active")));

  const fromSubscriptions = await db.select({
    slug: serviceCatalogTable.slug,
    label: serviceCatalogTable.label,
    subscriptionId: customerServiceSubscriptionsTable.id,
  }).from(customerServiceSubscriptionsTable)
    .innerJoin(serviceCatalogTable, eq(customerServiceSubscriptionsTable.serviceSlug, serviceCatalogTable.slug))
    .where(and(eq(customerServiceSubscriptionsTable.customerId, customerId), eq(customerServiceSubscriptionsTable.status, "active")));

  const uniqueServices = [...new Map([...fromCustomerServices, ...fromSubscriptions].map(s => [s.slug, s])).values()];

  const configs = await db.select().from(customerServiceConfigsTable)
    .where(eq(customerServiceConfigsTable.customerId, customerId));

  const integrations = await db.select().from(customerIntegrationsTable)
    .where(eq(customerIntegrationsTable.customerId, customerId));

  const ms365Rows = await db.select({
    id: ms365IntegrationsTable.id,
    azureTenantId: ms365IntegrationsTable.azureTenantId,
    status: ms365IntegrationsTable.status,
    lastSyncAt: ms365IntegrationsTable.lastSyncAt,
    syncError: ms365IntegrationsTable.syncError,
  }).from(ms365IntegrationsTable).where(eq(ms365IntegrationsTable.customerId, customerId)).limit(1);

  const onboardingSteps = await db.select().from(customerServiceOnboardingTable)
    .where(eq(customerServiceOnboardingTable.customerId, customerId));

  const configMap = Object.fromEntries(configs.map(c => [c.serviceSlug, c.config as Record<string, string>]));

  res.json({
    customer,
    services: uniqueServices.map(s => {
      const cfg = (configMap[s.slug] ?? {}) as Record<string, string>;
      // T19/T20: Derive display URLs from stored config so admin UI can show them
      if (cfg["webhookToken"] && (s.slug === "servicenow" || s.slug === "servicenow-entegrasyon")) {
        cfg["webhookUrl"] = `https://cyberstep.io/api/integrations/servicenow/webhook/${cfg["webhookToken"]}`;
      }
      if (cfg["dashboardSlug"] && s.slug === "observability") {
        cfg["dashboardUrl"] = `https://cyberstep.io/dashboard/${cfg["dashboardSlug"]}`;
      }
      return {
        slug: s.slug,
        label: s.label,
        subscriptionId: s.subscriptionId,
        config: cfg,
        onboardingSteps: onboardingSteps.filter(o => o.serviceSlug === s.slug),
      };
    }),
    integrations,
    ms365: ms365Rows[0] ?? null,
  });
});

// ─── PUT /api/admin-panel/customers/:id/service-config ───────────────────────
router.put("/admin-panel/customers/:customerId/service-config", requireAdmin, async (req: Request, res: Response) => {
  const customerId = Number(req.params["customerId"]);
  if (!customerId) { res.status(400).json({ error: "Geçersiz müşteri ID" }); return; }

  // T23: Zod validation
  const parsed = serviceConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Geçersiz parametreler", details: parsed.error.issues });
    return;
  }
  const { serviceSlug, config } = parsed.data;

  // T19: Auto-token fields — generate once, never overwrite
  const autoTokenFields: Record<string, string[]> = {
    "fortinet-fabric": ["webhookToken"],
    "noc": ["snmpToken"],
    "servicenow": ["webhookToken"],
    "servicenow-entegrasyon": ["webhookToken"],
  };
  for (const field of autoTokenFields[serviceSlug] ?? []) {
    if (!config[field]) config[field] = randomUUID().replace(/-/g, "");
  }

  // T20: Observability — auto-generate a stable dashboardSlug, read-only once set
  if (serviceSlug === "observability" && !config["dashboardSlug"]) {
    // Fetch customer name for a human-readable slug prefix
    const [cust] = await db.select({ companyName: customersTable.companyName })
      .from(customersTable).where(eq(customersTable.id, customerId)).limit(1);
    const prefix = (cust?.companyName ?? "musteri")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 30);
    config["dashboardSlug"] = `${prefix}-${randomUUID().split("-")[0]}`;
  }

  // T20: Protect read-only fields — if dashboardSlug already in DB, never overwrite
  const READONLY_ONCE_SET: Record<string, string[]> = {
    "observability": ["dashboardSlug"],
  };
  const existingRows = await db.select({ config: customerServiceConfigsTable.config })
    .from(customerServiceConfigsTable)
    .where(and(eq(customerServiceConfigsTable.customerId, customerId), eq(customerServiceConfigsTable.serviceSlug, serviceSlug)))
    .limit(1);
  const existingConfig = (existingRows[0]?.config ?? {}) as Record<string, string>;
  for (const field of READONLY_ONCE_SET[serviceSlug] ?? []) {
    if (existingConfig[field]) config[field] = existingConfig[field];
  }

  await db.insert(customerServiceConfigsTable)
    .values({ customerId, serviceSlug, config })
    .onConflictDoUpdate({
      target: [customerServiceConfigsTable.customerId, customerServiceConfigsTable.serviceSlug],
      set: { config, updatedAt: new Date() },
    });

  // Derive display URLs for response (T19, T20)
  const derivedUrls: Record<string, string> = {};
  if (config["webhookToken"] && (serviceSlug === "servicenow" || serviceSlug === "servicenow-entegrasyon")) {
    derivedUrls["webhookUrl"] = `https://cyberstep.io/api/integrations/servicenow/webhook/${config["webhookToken"]}`;
  }
  if (config["dashboardSlug"] && serviceSlug === "observability") {
    derivedUrls["dashboardUrl"] = `https://cyberstep.io/dashboard/${config["dashboardSlug"]}`;
  }

  logger.info({ customerId, serviceSlug }, "Admin service config saved");
  res.json({ ok: true, config, ...derivedUrls });
});

export default router;
