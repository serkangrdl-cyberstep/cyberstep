import { Router } from "express";
import type { Request, Response } from "express";
import { db, pool } from "@workspace/db";
import {
  customerServiceSubscriptionsTable,
  serviceCatalogTable,
  customerServiceOnboardingTable,
  customerServiceConfigsTable,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireCustomer, requireAdmin, getCustomerId } from "../../middleware/auth";
import { customersTable } from "@workspace/db";
import { logger } from "../../lib/logger";
import { encryptSecret, decryptSecret, encryptionAvailable } from "../../services/fabric-crypto";
import { sendServiceConfigCustomerEmail, sendServiceConfigAdminEmail } from "../../services/email";

const router = Router();

// ─── DB: ensure table exists at startup ──────────────────────────────────────

export async function ensureCustomerServiceConfigsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_service_configs (
      id            SERIAL PRIMARY KEY,
      customer_id   INTEGER NOT NULL,
      service_slug  VARCHAR(128) NOT NULL,
      config        JSONB NOT NULL DEFAULT '{}',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS customer_service_configs_uq
      ON customer_service_configs (customer_id, service_slug)
  `);
  await pool.query(`
    ALTER TABLE customer_service_configs
      ADD COLUMN IF NOT EXISTS migration_status VARCHAR(32)
  `);
  logger.info("customer_service_configs table ensured");

  // Migrate any existing rows that have plaintext secret fields.
  // Safe to run on every startup — already-encrypted values (prefixed "__enc__:")
  // are skipped, so this is fully idempotent.
  await migratePlaintextConfigSecrets();
}

/**
 * Reads every customer_service_configs row and re-writes any secret fields that
 * are still in plaintext (i.e. not yet prefixed with "__enc__:").
 * Skips the entire migration if ENCRYPTION_KEY is not configured.
 */
async function migratePlaintextConfigSecrets(): Promise<void> {
  if (!encryptionAvailable()) {
    logger.warn("ENCRYPTION_KEY not set — skipping customer_service_configs plaintext migration");
    return;
  }

  const rows = await pool.query<{ id: number; config: Record<string, unknown>; migration_status: string | null }>(
    "SELECT id, config, migration_status FROM customer_service_configs"
  );

  let migrated = 0;
  let errors = 0;
  for (const row of rows.rows) {
    const cfg = row.config ?? {};

    // Classify secret fields into plaintext vs already-encrypted
    const secretEntries = Object.entries(cfg).filter(
      ([k, v]) => isSecretField(k) && typeof v === "string" && (v as string).length > 0
    );

    const plaintextSecrets = secretEntries.filter(([, v]) => !(v as string).startsWith("__enc__:"));
    const encryptedSecrets = secretEntries.filter(([, v]) => (v as string).startsWith("__enc__:"));

    if (plaintextSecrets.length > 0) {
      // Row has plaintext secrets — encrypt them
      let encryptedCfg: Record<string, unknown>;
      try {
        encryptedCfg = encryptConfigSecrets(cfg);
      } catch (err) {
        logger.error({ err, rowId: row.id }, "customer_service_configs migration: failed to encrypt row — marking decrypt_error");
        await pool.query(
          "UPDATE customer_service_configs SET migration_status = 'decrypt_error' WHERE id = $1",
          [row.id]
        );
        errors++;
        continue;
      }

      await pool.query(
        "UPDATE customer_service_configs SET config = $1, migration_status = 'plaintext_migrated', updated_at = NOW() WHERE id = $2",
        [JSON.stringify(encryptedCfg), row.id]
      );
      migrated++;
      continue;
    }

    if (encryptedSecrets.length > 0) {
      // Row has only pre-encrypted secrets — verify each one can be decrypted with the current key
      const decryptFailed = encryptedSecrets.some(([k, v]) => {
        const result = decryptSecret((v as string).slice(8));
        if (result === null) {
          logger.warn({ rowId: row.id, field: k }, "customer_service_configs: existing encrypted field cannot be decrypted — ENCRYPTION_KEY mismatch or corrupt data");
          return true;
        }
        return false;
      });

      const newStatus = decryptFailed ? "decrypt_error" : "ok";
      if (row.migration_status !== newStatus) {
        await pool.query(
          "UPDATE customer_service_configs SET migration_status = $1 WHERE id = $2",
          [newStatus, row.id]
        );
      }
      if (decryptFailed) errors++;
      continue;
    }

    // No secret fields at all — mark ok if not already set
    if (!row.migration_status) {
      await pool.query(
        "UPDATE customer_service_configs SET migration_status = 'ok' WHERE id = $1",
        [row.id]
      );
    }
  }

  if (errors > 0) {
    logger.warn({ errors }, "customer_service_configs: some rows have decrypt failures — marked as decrypt_error");
  }
  if (migrated > 0) {
    logger.info({ migrated }, "customer_service_configs: migrated plaintext secrets to encrypted form");
  }
  if (errors === 0 && migrated === 0) {
    logger.info("customer_service_configs: all rows verified — no migration or decryption issues");
  }
}

// ─── Secret field helpers ─────────────────────────────────────────────────────

const SECRET_FIELD_PATTERNS = ["password", "token", "key", "secret", "credential"];

function isSecretField(name: string): boolean {
  const lower = name.toLowerCase();
  return SECRET_FIELD_PATTERNS.some((p) => lower.includes(p));
}

// Returns true if any field in config is sensitive
function hasSecretFields(config: Record<string, unknown>): boolean {
  return Object.keys(config).some((k) => isSecretField(k) && typeof config[k] === "string" && (config[k] as string).length > 0);
}

// Encrypt secret fields before DB write.
// Stored as "__enc__:<ciphertext>" to distinguish from unset values.
// Throws if ENCRYPTION_KEY is unavailable and any secret field is present.
function encryptConfigSecrets(config: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    if (isSecretField(k) && typeof v === "string" && v.length > 0) {
      // Skip values that are already encrypted (e.g. carried over from existing stored config)
      if (v.startsWith("__enc__:")) {
        out[k] = v;
        continue;
      }
      const enc = encryptSecret(v);
      if (!enc) {
        // encryptSecret returns null only when ENCRYPTION_KEY is missing — reject hard
        throw new Error("ENCRYPTION_KEY not configured — cannot store sensitive config field");
      }
      out[k] = `__enc__:${enc}`;
    } else {
      out[k] = v;
    }
  }
  return out;
}

// Return config safe for the client: secret fields become "****".
function maskConfigSecrets(config: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    if (isSecretField(k) && typeof v === "string" && v.length > 0) {
      out[k] = "****";
    } else {
      out[k] = v;
    }
  }
  return out;
}

// Decrypt a single encrypted field value for internal server use only.
export function decryptConfigField(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value.startsWith("__enc__:")) return decryptSecret(value.slice(8));
  return value; // legacy plaintext
}

// ─── Onboarding step definitions ─────────────────────────────────────────────

const SERVICE_ONBOARDING_STEPS: Record<
  string,
  { key: string; label: string; side: "customer" | "admin" }[]
> = {
  "fortinet-fabric": [
    { key: "customer-confirm", label: "CyberStep ekibi FortiManager'ı sizin adınıza yapılandıracak — bilgilendirme alındı", side: "customer" },
    { key: "admin-configure", label: "FortiManager yapılandırması tamamlandı", side: "admin" },
    { key: "admin-verify", label: "CyberStep ekibi bağlantıyı doğruladı", side: "admin" },
    { key: "admin-activate", label: "Fabric izleme aktifleştirildi", side: "admin" },
  ],
  "dns-izleme": [
    { key: "configure", label: "İzlenecek domainler girildi", side: "customer" },
    { key: "notification-email", label: "Bildirim e-postası ayarlandı", side: "customer" },
    { key: "admin-activate", label: "DNS izleme servisi başlatıldı", side: "admin" },
  ],
  "ct-log-izleme": [
    { key: "configure", label: "Domain whitelist girildi", side: "customer" },
    { key: "alert-email", label: "Uyarı e-postası ayarlandı", side: "customer" },
    { key: "admin-activate", label: "CT log izleme aktifleştirildi", side: "admin" },
  ],
  "microsoft-365": [
    { key: "oauth-connect", label: "Microsoft 365 hesabı bağlandı", side: "customer" },
    { key: "admin-verify", label: "Bağlantı CyberStep tarafından doğrulandı", side: "admin" },
    { key: "admin-activate", label: "Azure AD izleme başlatıldı", side: "admin" },
  ],
  "kvkk-bildirim": [
    { key: "configure", label: "KVKK sorumlusu bilgileri girildi", side: "customer" },
    { key: "admin-setup", label: "Bildirim şablonları hazırlandı", side: "admin" },
    { key: "admin-activate", label: "KVKK bildirim sistemi aktif", side: "admin" },
  ],
  "servicenow-entegrasyon": [
    { key: "configure", label: "ServiceNow instance URL girildi", side: "customer" },
    { key: "webhook-setup", label: "Webhook bağlantısı kuruldu", side: "customer" },
    { key: "admin-verify", label: "Entegrasyon doğrulandı", side: "admin" },
  ],
  "soc-operasyon": [
    { key: "configure", label: "Eskalasyon tercihleri ayarlandı", side: "customer" },
    { key: "admin-onboard", label: "SOC ekibine müşteri tanıtıldı", side: "admin" },
    { key: "admin-activate", label: "SOC izleme başladı", side: "admin" },
  ],
  "observability": [
    { key: "configure", label: "Log kaynakları ve API endpoint girildi", side: "customer" },
    { key: "admin-verify", label: "Bağlantı doğrulandı", side: "admin" },
    { key: "admin-activate", label: "Observability servisi başlatıldı", side: "admin" },
  ],
};

function getStepsForSlug(slug: string) {
  if (SERVICE_ONBOARDING_STEPS[slug]) return SERVICE_ONBOARDING_STEPS[slug];
  for (const key of Object.keys(SERVICE_ONBOARDING_STEPS)) {
    if (slug.includes(key) || key.includes(slug)) return SERVICE_ONBOARDING_STEPS[key];
  }
  return [
    { key: "configure", label: "Yapılandırma tamamlandı", side: "customer" as const },
    { key: "admin-activate", label: "Servis aktifleştirildi", side: "admin" as const },
  ];
}

// Determine which additional customer-side steps should be auto-completed
function getAutoCompletableSteps(slug: string, config: Record<string, unknown>): string[] {
  const keys: string[] = ["configure"];

  if (slug.includes("dns") && config["notificationEmail"]) {
    keys.push("notification-email");
  }
  if (slug.includes("ct-log") && config["alertEmail"]) {
    keys.push("alert-email");
  }
  if (
    slug.includes("servicenow") &&
    (config["webhookUrl"] || (config["instanceUrl"] && config["username"]))
  ) {
    keys.push("webhook-setup");
  }

  return keys;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export async function markOnboardingStepDone(
  customerId: number,
  serviceSlug: string,
  stepKey: string
): Promise<void> {
  await db
    .insert(customerServiceOnboardingTable)
    .values({
      customerId,
      serviceSlug,
      stepKey,
      status: "done",
      completedBy: "customer",
      completedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        customerServiceOnboardingTable.customerId,
        customerServiceOnboardingTable.serviceSlug,
        customerServiceOnboardingTable.stepKey,
      ],
      set: {
        status: "done",
        completedBy: "customer",
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/customer/my-services
router.get("/customer/my-services", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req) as number;

  const subscriptions = await db
    .select()
    .from(customerServiceSubscriptionsTable)
    .where(eq(customerServiceSubscriptionsTable.customerId, customerId));

  const slugs = subscriptions.map((s) => s.serviceSlug);

  const [catalogItems, onboardingRows, configRows] = await Promise.all([
    slugs.length > 0
      ? db.select().from(serviceCatalogTable).where(inArray(serviceCatalogTable.slug, slugs))
      : Promise.resolve([]),
    slugs.length > 0
      ? db
          .select()
          .from(customerServiceOnboardingTable)
          .where(
            and(
              eq(customerServiceOnboardingTable.customerId, customerId),
              inArray(customerServiceOnboardingTable.serviceSlug, slugs)
            )
          )
      : Promise.resolve([]),
    slugs.length > 0
      ? db
          .select()
          .from(customerServiceConfigsTable)
          .where(
            and(
              eq(customerServiceConfigsTable.customerId, customerId),
              inArray(customerServiceConfigsTable.serviceSlug, slugs)
            )
          )
      : Promise.resolve([]),
  ]);

  const catalogMap = Object.fromEntries(catalogItems.map((c) => [c.slug, c]));

  // Mask secret fields — never send plaintext or ciphertext to the client
  const configMap = Object.fromEntries(
    configRows.map((c) => [
      c.serviceSlug,
      maskConfigSecrets(c.config as Record<string, unknown>),
    ])
  );

  const onboardingMap: Record<string, Record<string, string>> = {};
  for (const row of onboardingRows) {
    if (!onboardingMap[row.serviceSlug]) onboardingMap[row.serviceSlug] = {};
    onboardingMap[row.serviceSlug][row.stepKey] = row.status;
  }

  const result = subscriptions.map((sub) => {
    const steps = getStepsForSlug(sub.serviceSlug);
    const stepStatuses = onboardingMap[sub.serviceSlug] ?? {};
    const enrichedSteps = steps.map((step) => ({
      ...step,
      status: stepStatuses[step.key] ?? "pending",
    }));
    const completed = enrichedSteps.filter((s) => s.status === "done").length;
    const progress = steps.length > 0 ? Math.round((completed / steps.length) * 100) : 0;

    return {
      subscription: sub,
      catalog: catalogMap[sub.serviceSlug] ?? null,
      config: configMap[sub.serviceSlug] ?? {},
      onboardingSteps: enrichedSteps,
      onboardingProgress: progress,
    };
  });

  res.json(result);
});

// POST /api/customer/service-config/:slug
router.post(
  "/customer/service-config/:slug",
  requireCustomer,
  async (req: Request, res: Response) => {
    const customerId = getCustomerId(req) as number;
    const { slug } = req.params as { slug: string };
    const { config } = req.body as { config?: Record<string, unknown> };

    if (!config || typeof config !== "object") {
      res.status(400).json({ error: "config alanı gerekli" });
      return;
    }

    // Authorization: customer must have an active (or pending) subscription for this slug
    const [subscription] = await db
      .select({ id: customerServiceSubscriptionsTable.id })
      .from(customerServiceSubscriptionsTable)
      .where(
        and(
          eq(customerServiceSubscriptionsTable.customerId, customerId),
          eq(customerServiceSubscriptionsTable.serviceSlug, slug)
        )
      )
      .limit(1);

    if (!subscription) {
      res.status(403).json({ error: "Bu servis için aktif abonelik bulunamadı" });
      return;
    }

    // Load any existing stored config so we can preserve encrypted secrets that the
    // client didn't change (they come back as "****" from the masked GET response).
    const [existing] = await db
      .select({ config: customerServiceConfigsTable.config })
      .from(customerServiceConfigsTable)
      .where(
        and(
          eq(customerServiceConfigsTable.customerId, customerId),
          eq(customerServiceConfigsTable.serviceSlug, slug)
        )
      )
      .limit(1);

    const existingConfig = (existing?.config ?? {}) as Record<string, unknown>;

    // Build merged config:
    //  - For secret fields: if the incoming value is "****" (unchanged placeholder),
    //    keep the previously stored encrypted value — never overwrite with placeholder.
    //  - For secret fields with a real new value: encrypt and store.
    //  - For non-secret fields: take the incoming value as-is.
    const mergedRaw: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(config)) {
      if (isSecretField(k) && v === "****") {
        // Placeholder — preserve existing encrypted value (may be undefined for new records)
        if (existingConfig[k] !== undefined) {
          mergedRaw[k] = existingConfig[k];
        }
        // If no existing value either, simply omit the field
      } else {
        mergedRaw[k] = v;
      }
    }

    // Also carry over any secret fields from existing config that weren't in the
    // incoming payload at all (e.g. the form omitted the field entirely).
    for (const [k, v] of Object.entries(existingConfig)) {
      if (isSecretField(k) && !(k in mergedRaw)) {
        mergedRaw[k] = v;
      }
    }

    // Check encryption requirement against the *new* secret values only
    const newSecretFields = Object.entries(config).filter(
      ([k, v]) => isSecretField(k) && typeof v === "string" && v.length > 0 && v !== "****"
    );
    if (newSecretFields.length > 0 && !encryptionAvailable()) {
      req.log.error({ customerId, slug }, "service-config: ENCRYPTION_KEY not set — refusing to store sensitive config");
      res.status(500).json({ error: "Güvenli yapılandırma şifreleme anahtarı eksik" });
      return;
    }

    let safeConfig: Record<string, unknown>;
    try {
      safeConfig = encryptConfigSecrets(mergedRaw);
    } catch (err) {
      req.log.error({ err, customerId, slug }, "service-config: encryption failed");
      res.status(500).json({ error: "Config şifrelenemedi" });
      return;
    }

    await db
      .insert(customerServiceConfigsTable)
      .values({
        customerId,
        serviceSlug: slug,
        config: safeConfig,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [customerServiceConfigsTable.customerId, customerServiceConfigsTable.serviceSlug],
        set: { config: safeConfig, updatedAt: new Date() },
      });

    // Auto-complete applicable customer-side onboarding steps
    const stepKeys = getAutoCompletableSteps(slug, config);
    const steps = getStepsForSlug(slug);
    const customerStepKeys = new Set(steps.filter((s) => s.side === "customer").map((s) => s.key));

    for (const key of stepKeys) {
      if (customerStepKeys.has(key)) {
        await markOnboardingStepDone(customerId, slug, key);
      }
    }

    logger.info({ customerId, slug, stepsMarked: stepKeys }, "customer/service-config: config saved");
    res.json({ ok: true });

    // Fire-and-forget: send notification emails to customer and admin
    setImmediate(async () => {
      try {
        const [customer] = await db
          .select({ email: customersTable.email, fullName: customersTable.fullName, companyName: customersTable.companyName })
          .from(customersTable)
          .where(eq(customersTable.id, customerId))
          .limit(1);

        const [service] = await db
          .select({ label: serviceCatalogTable.label })
          .from(serviceCatalogTable)
          .where(eq(serviceCatalogTable.slug, slug))
          .limit(1);

        if (!customer) return;

        const serviceLabel = service?.label ?? slug;
        const companyName = customer.companyName ?? customer.fullName;

        // Build human-readable field list for customer email (non-empty fields)
        const filledFields = Object.entries(config)
          .filter(([, v]) => v !== null && v !== undefined && v !== "" && v !== "****")
          .map(([k]) => k);

        // Build masked fields list for admin email
        const maskedFields = Object.entries(config)
          .filter(([, v]) => v !== null && v !== undefined && v !== "" && v !== "****")
          .map(([k, v]) => ({
            key: k,
            masked: isSecretField(k)
              ? "****"
              : String(v).length > 60
              ? String(v).slice(0, 57) + "..."
              : String(v),
          }));

        const adminEmail = process.env["SOC_ADMIN_EMAIL"] ?? "serkangrdl@gmail.com";

        await Promise.allSettled([
          sendServiceConfigCustomerEmail({
            customerEmail: customer.email,
            fullName: customer.fullName,
            companyName,
            serviceLabel,
            filledFields,
          }),
          sendServiceConfigAdminEmail({
            adminEmail,
            customerEmail: customer.email,
            fullName: customer.fullName,
            companyName,
            serviceLabel,
            serviceSlug: slug,
            maskedFields,
          }),
        ]);
      } catch (err) {
        logger.error({ err, customerId, slug }, "service-config: notification emails failed");
      }
    });
  }
);

// ─── Admin: list all service subscriptions + onboarding progress ─────────────

router.get("/admin/customer-service-subscriptions", requireAdmin, async (_req: Request, res: Response) => {
  const subscriptions = await db.select().from(customerServiceSubscriptionsTable);
  if (subscriptions.length === 0) {
    res.json([]);
    return;
  }

  const customerIds = [...new Set(subscriptions.map(s => s.customerId).filter((id): id is number => id !== null))];
  const slugs = [...new Set(subscriptions.map(s => s.serviceSlug))];

  const [customers, onboardingRows, configRows] = await Promise.all([
    customerIds.length > 0
      ? db.select({ id: customersTable.id, email: customersTable.email, companyName: customersTable.companyName })
          .from(customersTable).where(inArray(customersTable.id, customerIds))
      : Promise.resolve([]),
    slugs.length > 0
      ? db.select().from(customerServiceOnboardingTable)
          .where(inArray(customerServiceOnboardingTable.serviceSlug, slugs))
      : Promise.resolve([]),
    customerIds.length > 0
      ? db.select({
          customerId: customerServiceConfigsTable.customerId,
          serviceSlug: customerServiceConfigsTable.serviceSlug,
          migrationStatus: customerServiceConfigsTable.migrationStatus,
        }).from(customerServiceConfigsTable)
          .where(inArray(customerServiceConfigsTable.customerId, customerIds))
      : Promise.resolve([]),
  ]);

  const customerMap = Object.fromEntries(customers.map(c => [c.id, c]));

  // configStatusMap[customerId][serviceSlug] = migrationStatus
  const configStatusMap: Record<number, Record<string, string | null>> = {};
  for (const cfg of configRows) {
    if (!configStatusMap[cfg.customerId]) configStatusMap[cfg.customerId] = {};
    configStatusMap[cfg.customerId][cfg.serviceSlug] = cfg.migrationStatus ?? null;
  }

  // onboardingMap[customerId][serviceSlug][stepKey] = { status, completedBy, completedAt }
  const onboardingMap: Record<number, Record<string, Record<string, { status: string; completedBy: string | null; completedAt: Date | null }>>> = {};
  for (const row of onboardingRows) {
    if (!onboardingMap[row.customerId]) onboardingMap[row.customerId] = {};
    if (!onboardingMap[row.customerId][row.serviceSlug]) onboardingMap[row.customerId][row.serviceSlug] = {};
    onboardingMap[row.customerId][row.serviceSlug][row.stepKey] = {
      status: row.status,
      completedBy: row.completedBy ?? null,
      completedAt: row.completedAt ?? null,
    };
  }

  const result = subscriptions.map(sub => {
    const customerId = sub.customerId ?? 0;
    const steps = getStepsForSlug(sub.serviceSlug);
    const subOnboarding = onboardingMap[customerId]?.[sub.serviceSlug] ?? {};
    const enrichedSteps = steps.map(step => ({
      ...step,
      status: subOnboarding[step.key]?.status ?? "pending",
      completedBy: subOnboarding[step.key]?.completedBy ?? null,
      completedAt: subOnboarding[step.key]?.completedAt ?? null,
    }));
    const completed = enrichedSteps.filter(s => s.status === "done").length;
    const progress = steps.length > 0 ? Math.round((completed / steps.length) * 100) : 0;

    return {
      subscription: sub,
      customer: customerMap[customerId] ?? { id: customerId, email: sub.email, companyName: sub.companyName, contactName: sub.contactName },
      steps: enrichedSteps,
      progress,
      configMigrationStatus: configStatusMap[customerId]?.[sub.serviceSlug] ?? null,
    };
  });

  res.json(result);
});

// POST /api/admin/customer-service-subscriptions/onboarding — mark a step done or pending as admin
router.post("/admin/customer-service-subscriptions/onboarding", requireAdmin, async (req: Request, res: Response) => {
  const { customerId, serviceSlug, stepKey, action } = req.body as {
    customerId?: number;
    serviceSlug?: string;
    stepKey?: string;
    action?: "done" | "pending";
  };

  if (!customerId || !serviceSlug || !stepKey || !action) {
    res.status(400).json({ error: "customerId, serviceSlug, stepKey, action gerekli" });
    return;
  }
  if (action !== "done" && action !== "pending") {
    res.status(400).json({ error: "action 'done' veya 'pending' olmalı" });
    return;
  }

  if (action === "done") {
    await db
      .insert(customerServiceOnboardingTable)
      .values({
        customerId,
        serviceSlug,
        stepKey,
        status: "done",
        completedBy: "admin",
        completedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          customerServiceOnboardingTable.customerId,
          customerServiceOnboardingTable.serviceSlug,
          customerServiceOnboardingTable.stepKey,
        ],
        set: { status: "done", completedBy: "admin", completedAt: new Date(), updatedAt: new Date() },
      });
    logger.info({ customerId, serviceSlug, stepKey }, "admin: onboarding step marked done");
  } else {
    await db
      .insert(customerServiceOnboardingTable)
      .values({
        customerId,
        serviceSlug,
        stepKey,
        status: "pending",
        completedBy: null,
        completedAt: null,
      })
      .onConflictDoUpdate({
        target: [
          customerServiceOnboardingTable.customerId,
          customerServiceOnboardingTable.serviceSlug,
          customerServiceOnboardingTable.stepKey,
        ],
        set: { status: "pending", completedBy: null, completedAt: null, updatedAt: new Date() },
      });
    logger.info({ customerId, serviceSlug, stepKey }, "admin: onboarding step marked pending");
  }

  res.json({ ok: true });
});

// ─── Admin: decrypt service config for a specific customer ───────────────────
// POST /api/admin/customer-service-config/:customerId/:slug/decrypt
// Only accessible to admins. Decrypts all secret fields and returns plain config.
// Every call is written to the server audit log.
router.post(
  "/admin/customer-service-config/:customerId/:slug/decrypt",
  requireAdmin,
  async (req: Request, res: Response) => {
    const rawCustomerId = (req.params as { customerId: string; slug: string }).customerId;
    const { slug } = req.params as { customerId: string; slug: string };
    const customerId = parseInt(rawCustomerId, 10);

    if (isNaN(customerId)) {
      res.status(400).json({ error: "Geçersiz customerId" });
      return;
    }

    const [row] = await db
      .select({ config: customerServiceConfigsTable.config })
      .from(customerServiceConfigsTable)
      .where(
        and(
          eq(customerServiceConfigsTable.customerId, customerId),
          eq(customerServiceConfigsTable.serviceSlug, slug)
        )
      )
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "Bu müşteri için yapılandırma bulunamadı" });
      return;
    }

    const rawConfig = (row.config ?? {}) as Record<string, unknown>;

    // Decrypt all secret fields
    const decrypted: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rawConfig)) {
      if (isSecretField(k) && typeof v === "string" && v.length > 0) {
        if (v.startsWith("__enc__:")) {
          const plain = decryptSecret(v.slice(8));
          decrypted[k] = plain ?? "[şifre çözülemedi]";
        } else {
          decrypted[k] = v; // legacy plaintext — return as-is
        }
      } else {
        decrypted[k] = v;
      }
    }

    // Audit trail — always log who accessed what
    const actorAdminId = (req.session as unknown as Record<string, unknown>)["adminId"] ?? null;
    logger.info(
      {
        audit: "admin-decrypt-service-config",
        adminId: actorAdminId,
        targetCustomerId: customerId,
        serviceSlug: slug,
        ip: req.ip,
        at: new Date().toISOString(),
      },
      "AUDIT: admin decrypted service config"
    );

    res.json({ config: decrypted });
  }
);

// ─── GET /api/customer/kurulum-durumu ────────────────────────────────────────
// Customer-facing setup status: active services + onboarding steps + safe generated URLs
router.get("/customer/kurulum-durumu", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req) as number;
  const baseUrl = `${req.protocol}://${req.get("host")}`;

  const subscriptions = await db.select().from(customerServiceSubscriptionsTable)
    .where(and(eq(customerServiceSubscriptionsTable.customerId, customerId), eq(customerServiceSubscriptionsTable.status, "active")));

  const slugs = subscriptions.map(s => s.serviceSlug);

  type ConfigRow = typeof customerServiceConfigsTable.$inferSelect;
  type OnboardingRow = typeof customerServiceOnboardingTable.$inferSelect;
  type CatalogRow = typeof serviceCatalogTable.$inferSelect;

  const [catalogItems, onboardingRows, configRows] = await Promise.all([
    slugs.length > 0 ? db.select().from(serviceCatalogTable).where(inArray(serviceCatalogTable.slug, slugs)) : Promise.resolve([] as CatalogRow[]),
    slugs.length > 0 ? db.select().from(customerServiceOnboardingTable).where(and(eq(customerServiceOnboardingTable.customerId, customerId), inArray(customerServiceOnboardingTable.serviceSlug, slugs))) : Promise.resolve([] as OnboardingRow[]),
    slugs.length > 0 ? db.select().from(customerServiceConfigsTable).where(and(eq(customerServiceConfigsTable.customerId, customerId), inArray(customerServiceConfigsTable.serviceSlug, slugs))) : Promise.resolve([] as ConfigRow[]),
  ]);

  const catalogMap = Object.fromEntries(catalogItems.map(c => [c.slug, c]));
  const onboardingMap: Record<string, Record<string, string>> = {};
  for (const row of onboardingRows) {
    if (!onboardingMap[row.serviceSlug]) onboardingMap[row.serviceSlug] = {};
    onboardingMap[row.serviceSlug][row.stepKey] = row.status;
  }

  // Only expose non-secret generated tokens to customer
  function getGeneratedUrls(slug: string, config: Record<string, unknown>): Array<{ label: string; url: string }> {
    const token = typeof config["webhookToken"] === "string" && config["webhookToken"].length > 10 ? config["webhookToken"] : null;
    const snmpToken = typeof config["snmpToken"] === "string" && config["snmpToken"].length > 10 ? config["snmpToken"] : null;
    if (slug === "fortinet-fabric" && token) {
      return [
        { label: "Syslog-over-HTTPS Endpoint", url: `${baseUrl}/api/fabric/ingest/${token}` },
        { label: "Webhook Endpoint", url: `${baseUrl}/api/fabric/webhook/${token}` },
      ];
    }
    if (slug === "noc" && snmpToken) {
      return [
        { label: "SNMP Trap Host", url: "snmptrap.cyberstep.io" },
        { label: "Community String / Token", url: snmpToken },
      ];
    }
    return [];
  }

  // Page links for customer-side steps
  const SERVICE_PAGE_LINKS: Record<string, string> = {
    "fortinet-fabric": "/hesabim/fortinet-entegrasyonu",
    "soc-operasyon": "/hesabim/soc",
    "noc": "/hesabim/noc-kurulum",
    "ms365": "/hesabim/entegrasyonlarim",
    "microsoft-365": "/hesabim/entegrasyonlarim",
    "dns-izleme": "/hesabim/dns-izleme",
    "ct-log-izleme": "/hesabim/servislerim",
    "kvkk-bildirim": "/hesabim/servislerim",
    "servicenow": "/hesabim/soc",
    "servicenow-entegrasyon": "/hesabim/soc",
    "observability": "/hesabim/servislerim",
  };

  const onboardingCompletedAt: Record<string, Record<string, string | null>> = {};
  for (const row of onboardingRows) {
    if (!onboardingCompletedAt[row.serviceSlug]) onboardingCompletedAt[row.serviceSlug] = {};
    onboardingCompletedAt[row.serviceSlug][row.stepKey] = row.completedAt ? row.completedAt.toISOString() : null;
  }

  const result = subscriptions.map(sub => {
    const raw = configRows.find(c => c.serviceSlug === sub.serviceSlug)?.config as Record<string, unknown> ?? {};
    const steps = getStepsForSlug(sub.serviceSlug);
    const stepStatuses = onboardingMap[sub.serviceSlug] ?? {};
    const completedAts = onboardingCompletedAt[sub.serviceSlug] ?? {};
    const enrichedSteps = steps.map(s => ({ ...s, status: stepStatuses[s.key] ?? "pending" }));
    const doneCustomer = enrichedSteps.filter(s => s.side === "customer" && s.status === "done").length;
    const totalCustomer = enrichedSteps.filter(s => s.side === "customer").length;
    const allStepsDone = enrichedSteps.length > 0 && enrichedSteps.every(s => s.status === "done" || s.status === "skipped");
    const activatedAt = allStepsDone
      ? Object.values(completedAts).filter(Boolean).sort().at(-1) ?? null
      : null;

    return {
      subscription: sub,
      catalog: catalogMap[sub.serviceSlug] ?? null,
      onboardingSteps: enrichedSteps,
      doneCustomerSteps: doneCustomer,
      totalCustomerSteps: totalCustomer,
      allDone: allStepsDone,
      activatedAt,
      generatedUrls: getGeneratedUrls(sub.serviceSlug, raw),
      pageLink: SERVICE_PAGE_LINKS[sub.serviceSlug] ?? "/hesabim/servislerim",
    };
  });

  const totalCustomer = result.reduce((a, r) => a + r.totalCustomerSteps, 0);
  const doneCustomer = result.reduce((a, r) => a + r.doneCustomerSteps, 0);

  res.json({
    services: result,
    totalCustomerSteps: totalCustomer,
    doneCustomerSteps: doneCustomer,
    overallProgress: totalCustomer > 0 ? Math.round((doneCustomer / totalCustomer) * 100) : 0,
  });
});

export default router;
