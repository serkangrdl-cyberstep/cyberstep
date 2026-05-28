import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { tenantsTable, tenantUsersTable, adminUsersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { requireAdmin } from "./middleware";

const router = Router();

function sess(req: Request) {
  return req.session as unknown as Record<string, unknown>;
}

// Get all tenants for current admin user
router.get("/admin-panel/tenants", requireAdmin, async (req: Request, res: Response) => {
  const adminId = sess(req)["adminId"] as number;
  const memberships = await db.select({
    tenant: tenantsTable,
    role: tenantUsersTable.role,
  })
    .from(tenantUsersTable)
    .innerJoin(tenantsTable, eq(tenantUsersTable.tenantId, tenantsTable.id))
    .where(eq(tenantUsersTable.adminUserId, adminId));

  res.json(memberships.map(m => ({ ...m.tenant, role: m.role })));
});

// Create a new tenant (self-service)
router.post("/admin-panel/tenants", requireAdmin, async (req: Request, res: Response) => {
  const adminId = sess(req)["adminId"] as number;
  const { name, slug } = req.body as { name?: string; slug?: string };

  if (!name || !slug) { res.status(400).json({ error: "Firma adı ve slug gerekli" }); return; }
  if (!/^[a-z0-9-]+$/.test(slug)) { res.status(400).json({ error: "Slug sadece küçük harf, rakam ve - içerebilir" }); return; }

  // Check slug uniqueness
  const [existing] = await db.select({ id: tenantsTable.id }).from(tenantsTable).where(eq(tenantsTable.slug, slug));
  if (existing) { res.status(409).json({ error: "Bu slug zaten kullanımda" }); return; }

  const [tenant] = await db.insert(tenantsTable).values({ name, slug }).returning();
  if (!tenant) { res.status(500).json({ error: "Tenant oluşturulamadı" }); return; }

  // Add creator as owner
  await db.insert(tenantUsersTable).values({ tenantId: tenant.id, adminUserId: adminId, role: "owner" });

  // Set as active tenant in session
  sess(req)["tenantId"] = tenant.id;

  // Seed default email templates (fire-and-forget)
  import("../../../services/email-templates-seed").then(m => m.seedDefaultTemplates(tenant.id)).catch(() => {});

  logger.info({ tenantId: tenant.id, adminId }, "Tenant created");
  res.status(201).json({ ...tenant, role: "owner" });
});

// Select active tenant (workspace switch)
router.post("/admin-panel/tenants/select", requireAdmin, async (req: Request, res: Response) => {
  const adminId = sess(req)["adminId"] as number;
  const { tenantId } = req.body as { tenantId?: number };
  if (!tenantId) { res.status(400).json({ error: "tenantId gerekli" }); return; }

  // Verify membership
  const [membership] = await db.select()
    .from(tenantUsersTable)
    .where(and(eq(tenantUsersTable.tenantId, tenantId), eq(tenantUsersTable.adminUserId, adminId)));

  if (!membership) { res.status(403).json({ error: "Bu workspace'e erişim izniniz yok" }); return; }

  sess(req)["tenantId"] = tenantId;
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
  res.json({ ...tenant, role: membership.role });
});

// Get current tenant
router.get("/admin-panel/tenants/current", requireAdmin, async (req: Request, res: Response) => {
  const adminId = sess(req)["adminId"] as number;
  const tenantId = sess(req)["tenantId"] as number | undefined;
  if (!tenantId) { res.json(null); return; }

  const [membership] = await db.select({ role: tenantUsersTable.role })
    .from(tenantUsersTable)
    .where(and(eq(tenantUsersTable.tenantId, tenantId), eq(tenantUsersTable.adminUserId, adminId)));

  if (!membership) { sess(req)["tenantId"] = undefined; res.json(null); return; }

  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
  if (!tenant) { res.json(null); return; }

  // Mask API keys
  res.json({ ...tenant, aiApiKey: tenant.aiApiKey ? "••••••••" : null, imapPass: null, smtpPass: null, role: membership.role });
});

// Update tenant settings
router.patch("/admin-panel/tenants/:id", requireAdmin, async (req: Request, res: Response) => {
  const adminId = sess(req)["adminId"] as number;
  const tenantId = parseInt(String(req.params.id));

  const [membership] = await db.select()
    .from(tenantUsersTable)
    .where(and(eq(tenantUsersTable.tenantId, tenantId), eq(tenantUsersTable.adminUserId, adminId)));

  if (!membership || membership.role === "member") {
    res.status(403).json({ error: "Bu işlem için admin veya owner rolü gerekli" }); return;
  }

  const {
    name, logoUrl, primaryColor, quoteTerms, quoteFooter, quoteValidDays,
    aiProvider, aiApiKey, aiModel,
    imapHost, imapUser, imapPass, smtpHost, smtpUser, smtpPass, smtpPort,
  } = req.body as Record<string, string | number | undefined>;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) updates["name"] = name;
  if (logoUrl !== undefined) updates["logoUrl"] = logoUrl;
  if (primaryColor !== undefined) updates["primaryColor"] = primaryColor;
  if (quoteTerms !== undefined) updates["quoteTerms"] = quoteTerms;
  if (quoteFooter !== undefined) updates["quoteFooter"] = quoteFooter;
  if (quoteValidDays !== undefined) updates["quoteValidDays"] = Number(quoteValidDays);
  if (aiProvider !== undefined) updates["aiProvider"] = aiProvider;
  if (aiModel !== undefined) updates["aiModel"] = aiModel;
  // Only update API key if a real value is provided (not the masked placeholder)
  if (aiApiKey !== undefined && aiApiKey !== "••••••••" && aiApiKey !== "") updates["aiApiKey"] = aiApiKey;
  if (imapHost !== undefined) updates["imapHost"] = imapHost;
  if (imapUser !== undefined) updates["imapUser"] = imapUser;
  if (imapPass !== undefined && imapPass !== "") updates["imapPass"] = imapPass;
  if (smtpHost !== undefined) updates["smtpHost"] = smtpHost;
  if (smtpUser !== undefined) updates["smtpUser"] = smtpUser;
  if (smtpPass !== undefined && smtpPass !== "") updates["smtpPass"] = smtpPass;
  if (smtpPort !== undefined) updates["smtpPort"] = Number(smtpPort);

  await (db.update(tenantsTable) as unknown as { set: (v: Record<string, unknown>) => { where: (c: unknown) => Promise<unknown> } })
    .set(updates)
    .where(eq(tenantsTable.id, tenantId));

  logger.info({ tenantId, adminId }, "Tenant settings updated");
  res.json({ ok: true });
});

// Get tenant members
router.get("/admin-panel/tenants/:id/members", requireAdmin, async (req: Request, res: Response) => {
  const adminId = sess(req)["adminId"] as number;
  const tenantId = parseInt(String(req.params.id));

  const [membership] = await db.select()
    .from(tenantUsersTable)
    .where(and(eq(tenantUsersTable.tenantId, tenantId), eq(tenantUsersTable.adminUserId, adminId)));
  if (!membership) { res.status(403).json({ error: "Erişim yok" }); return; }

  const members = await db.select({
    id: tenantUsersTable.id,
    role: tenantUsersTable.role,
    joinedAt: tenantUsersTable.joinedAt,
    email: adminUsersTable.email,
    adminUserId: tenantUsersTable.adminUserId,
  })
    .from(tenantUsersTable)
    .innerJoin(adminUsersTable, eq(tenantUsersTable.adminUserId, adminUsersTable.id))
    .where(eq(tenantUsersTable.tenantId, tenantId));

  res.json(members);
});

// Invite member by email (they must already have an admin account)
router.post("/admin-panel/tenants/:id/invite", requireAdmin, async (req: Request, res: Response) => {
  const adminId = sess(req)["adminId"] as number;
  const tenantId = parseInt(String(req.params.id));
  const { email, role = "member" } = req.body as { email?: string; role?: string };

  if (!email) { res.status(400).json({ error: "E-posta gerekli" }); return; }

  const [membership] = await db.select()
    .from(tenantUsersTable)
    .where(and(eq(tenantUsersTable.tenantId, tenantId), eq(tenantUsersTable.adminUserId, adminId)));
  if (!membership || membership.role === "member") {
    res.status(403).json({ error: "Davet etme yetkisi yok" }); return;
  }

  const [invitee] = await db.select({ id: adminUsersTable.id })
    .from(adminUsersTable).where(eq(adminUsersTable.email, email));
  if (!invitee) { res.status(404).json({ error: "Bu e-posta ile kayıtlı kullanıcı bulunamadı" }); return; }

  try {
    await db.insert(tenantUsersTable).values({
      tenantId, adminUserId: invitee.id, role, invitedByAdminUserId: adminId,
    });
    logger.info({ tenantId, inviteeId: invitee.id, role }, "Tenant member invited");
    res.json({ ok: true });
  } catch {
    res.status(409).json({ error: "Bu kullanıcı zaten üye" });
  }
});

// Remove member
router.delete("/admin-panel/tenants/:id/members/:memberId", requireAdmin, async (req: Request, res: Response) => {
  const adminId = sess(req)["adminId"] as number;
  const tenantId = parseInt(String(req.params.id));
  const membershipId = parseInt(String(req.params.memberId));

  const [myMembership] = await db.select()
    .from(tenantUsersTable)
    .where(and(eq(tenantUsersTable.tenantId, tenantId), eq(tenantUsersTable.adminUserId, adminId)));
  if (!myMembership || myMembership.role === "member") {
    res.status(403).json({ error: "Üye çıkarma yetkisi yok" }); return;
  }

  await db.delete(tenantUsersTable).where(eq(tenantUsersTable.id, membershipId));
  res.json({ ok: true });
});

export default router;
