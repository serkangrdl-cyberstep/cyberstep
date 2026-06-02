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

const router = Router();

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
    services: uniqueServices.map(s => ({
      slug: s.slug,
      label: s.label,
      subscriptionId: s.subscriptionId,
      config: configMap[s.slug] ?? {},
      onboardingSteps: onboardingSteps.filter(o => o.serviceSlug === s.slug),
    })),
    integrations,
    ms365: ms365Rows[0] ?? null,
  });
});

// ─── PUT /api/admin-panel/customers/:id/service-config ───────────────────────
router.put("/admin-panel/customers/:customerId/service-config", requireAdmin, async (req: Request, res: Response) => {
  const customerId = Number(req.params["customerId"]);
  const { serviceSlug, config } = req.body as { serviceSlug: string; config: Record<string, string> };

  if (!customerId || !serviceSlug || typeof config !== "object") {
    res.status(400).json({ error: "Eksik parametreler" });
    return;
  }

  const autoTokenFields: Record<string, string[]> = {
    "fortinet-fabric": ["webhookToken"],
    "noc": ["snmpToken"],
  };
  for (const field of autoTokenFields[serviceSlug] ?? []) {
    if (!config[field]) config[field] = randomUUID().replace(/-/g, "");
  }

  await db.insert(customerServiceConfigsTable)
    .values({ customerId, serviceSlug, config })
    .onConflictDoUpdate({
      target: [customerServiceConfigsTable.customerId, customerServiceConfigsTable.serviceSlug],
      set: { config, updatedAt: new Date() },
    });

  logger.info({ customerId, serviceSlug }, "Admin service config saved");
  res.json({ ok: true, config });
});

export default router;
