import type { Request, Response, NextFunction } from "express";
import { db, tenantsTable, tenantUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

function sess(req: Request) {
  return req.session as unknown as Record<string, unknown>;
}

// Ensure the authenticated admin has an active workspace selected in the session.
// Tenant-scoped admin features (e-posta şablonları, bildirim merkezi, ISR/teknoloji
// ortakları) require session.tenantId. If none is selected we pick the admin's first
// workspace, auto-provisioning a default one when the admin has no workspace yet.
// Race-safe via onConflictDoNothing so parallel page-load requests do not collide.
async function ensureTenantForAdmin(req: Request, adminId: number): Promise<void> {
  const s = sess(req);
  if (s["tenantId"]) return;

  const [membership] = await db
    .select({ tenantId: tenantUsersTable.tenantId })
    .from(tenantUsersTable)
    .where(eq(tenantUsersTable.adminUserId, adminId))
    .limit(1);

  if (membership) {
    s["tenantId"] = membership.tenantId;
    return;
  }

  const slug = `workspace-${adminId}`;
  await db.insert(tenantsTable).values({ name: "CyberStep", slug }).onConflictDoNothing();
  const [tenant] = await db
    .select({ id: tenantsTable.id })
    .from(tenantsTable)
    .where(eq(tenantsTable.slug, slug));
  if (!tenant) return;

  await db
    .insert(tenantUsersTable)
    .values({ tenantId: tenant.id, adminUserId: adminId, role: "owner" })
    .onConflictDoNothing();
  s["tenantId"] = tenant.id;
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const adminId = sess(req)["adminId"] as number | undefined;
  if (!adminId) {
    res.status(401).json({ error: "Yetkisiz erişim" });
    return;
  }
  if (!sess(req)["tenantId"]) {
    try {
      await ensureTenantForAdmin(req, adminId);
    } catch {
      // Non-fatal: tenant-scoped routes still guard for a missing workspace.
    }
  }
  next();
}

export function requireTenant(req: Request, res: Response, next: NextFunction): void {
  const adminId = sess(req)["adminId"] as number | undefined;
  const tenantId = sess(req)["tenantId"] as number | undefined;
  if (!adminId) { res.status(401).json({ error: "Yetkisiz erişim" }); return; }
  if (!tenantId) { res.status(403).json({ error: "Workspace seçilmedi", code: "NO_TENANT" }); return; }
  next();
}

export function getTenantId(req: Request): number {
  return sess(req)["tenantId"] as number;
}

export function requireCustomer(req: Request, res: Response, next: NextFunction): void {
  const customerId = sess(req)["customerId"] as number | undefined;
  if (!customerId) {
    res.status(401).json({ error: "Giriş yapmanız gerekiyor" });
    return;
  }
  next();
}

export function requireAssessmentOwner(req: Request, res: Response, next: NextFunction): void {
  // Admin bypasses ownership check
  const adminId = sess(req)["adminId"] as number | undefined;
  if (adminId) { next(); return; }

  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Geçersiz ID" });
    return;
  }

  const owned = (sess(req)["ownedAssessmentIds"] as number[] | undefined) ?? [];
  if (!owned.includes(id)) {
    res.status(403).json({ error: "Bu değerlendirmeye erişim izniniz yok" });
    return;
  }
  next();
}

export function addAssessmentToSession(req: Request, assessmentId: number): void {
  const s = sess(req);
  const existing = (s["ownedAssessmentIds"] as number[] | undefined) ?? [];
  s["ownedAssessmentIds"] = [...new Set([...existing, assessmentId])];
}

export function getAdminId(req: Request): number | undefined {
  return sess(req)["adminId"] as number | undefined;
}

export function getCustomerId(req: Request): number | undefined {
  return sess(req)["customerId"] as number | undefined;
}

export function requirePartner(req: Request, res: Response, next: NextFunction): void {
  const partnerId = sess(req)["partnerId"] as number | undefined;
  if (!partnerId) {
    res.status(401).json({ error: "İş ortağı girişi gerekiyor" });
    return;
  }
  next();
}

export function getPartnerId(req: Request): number | undefined {
  return sess(req)["partnerId"] as number | undefined;
}
