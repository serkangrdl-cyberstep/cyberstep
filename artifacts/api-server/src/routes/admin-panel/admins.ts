// ─── Yönetici Kullanıcı CRUD ──────────────────────────────────────────────────
import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { adminUsersTable } from "@workspace/db";
import { eq, ne } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { requireAdmin } from "../../middleware/auth";
import { logger } from "../../lib/logger";

const router = Router();

function sess(req: Request) {
  return req.session as unknown as Record<string, unknown>;
}

function requireSuperadmin(req: Request, res: Response): boolean {
  const adminId = sess(req)["adminId"] as number | undefined;
  if (!adminId) { res.status(401).json({ error: "Yetkisiz" }); return false; }
  // Checked async by caller after this — callers must fetch the user and verify isSuperadmin
  return true;
}

// GET /api/admin-panel/admins — tüm yöneticileri listele (superadmin only)
router.get("/admin-panel/admins", requireAdmin, async (req: Request, res: Response) => {
  const adminId = sess(req)["adminId"] as number;
  const [me] = await db.select({ isSuperadmin: adminUsersTable.isSuperadmin })
    .from(adminUsersTable).where(eq(adminUsersTable.id, adminId));
  if (!me?.isSuperadmin) { res.status(403).json({ error: "Yalnızca süper yönetici erişebilir" }); return; }

  const admins = await db.select({
    id: adminUsersTable.id,
    email: adminUsersTable.email,
    name: adminUsersTable.name,
    departments: adminUsersTable.departments,
    isSuperadmin: adminUsersTable.isSuperadmin,
    totpEnabled: adminUsersTable.totpEnabled,
    lastLoginAt: adminUsersTable.lastLoginAt,
    createdAt: adminUsersTable.createdAt,
  }).from(adminUsersTable);

  res.json(admins);
});

// POST /api/admin-panel/admins — yeni yönetici oluştur (superadmin only)
router.post("/admin-panel/admins", requireAdmin, async (req: Request, res: Response) => {
  const adminId = sess(req)["adminId"] as number;
  const [me] = await db.select({ isSuperadmin: adminUsersTable.isSuperadmin })
    .from(adminUsersTable).where(eq(adminUsersTable.id, adminId));
  if (!me?.isSuperadmin) { res.status(403).json({ error: "Yalnızca süper yönetici erişebilir" }); return; }

  const { email, password, name, departments, isSuperadmin } = req.body as {
    email?: string;
    password?: string;
    name?: string;
    departments?: string[];
    isSuperadmin?: boolean;
  };

  if (!email || !password) { res.status(400).json({ error: "E-posta ve şifre zorunlu" }); return; }
  if (password.length < 8) { res.status(400).json({ error: "Şifre en az 8 karakter olmalı" }); return; }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const [admin] = await db.insert(adminUsersTable).values({
      email: email.toLowerCase().trim(),
      passwordHash,
      name: name?.trim(),
      departments: departments ?? [],
      isSuperadmin: isSuperadmin ?? false,
    }).returning({
      id: adminUsersTable.id,
      email: adminUsersTable.email,
      name: adminUsersTable.name,
      departments: adminUsersTable.departments,
      isSuperadmin: adminUsersTable.isSuperadmin,
    });

    logger.info({ createdBy: adminId, newAdminEmail: email }, "Yeni yönetici oluşturuldu");
    res.status(201).json(admin);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("unique")) { res.status(409).json({ error: "Bu e-posta zaten kayıtlı" }); return; }
    throw err;
  }
});

// PATCH /api/admin-panel/admins/:id — departmanları güncelle (superadmin only)
router.patch("/admin-panel/admins/:id", requireAdmin, async (req: Request, res: Response) => {
  const adminId = sess(req)["adminId"] as number;
  const [me] = await db.select({ isSuperadmin: adminUsersTable.isSuperadmin })
    .from(adminUsersTable).where(eq(adminUsersTable.id, adminId));
  if (!me?.isSuperadmin) { res.status(403).json({ error: "Yalnızca süper yönetici erişebilir" }); return; }

  const targetId = Number(req.params["id"]);
  const { departments, name, isSuperadmin } = req.body as {
    departments?: string[];
    name?: string;
    isSuperadmin?: boolean;
  };

  const updates: Partial<{ departments: string[]; name: string; isSuperadmin: boolean }> = {};
  if (departments !== undefined) updates.departments = departments;
  if (name !== undefined) updates.name = name;
  if (isSuperadmin !== undefined) updates.isSuperadmin = isSuperadmin;

  const [updated] = await db.update(adminUsersTable)
    .set(updates)
    .where(eq(adminUsersTable.id, targetId))
    .returning({
      id: adminUsersTable.id,
      email: adminUsersTable.email,
      name: adminUsersTable.name,
      departments: adminUsersTable.departments,
      isSuperadmin: adminUsersTable.isSuperadmin,
    });

  if (!updated) { res.status(404).json({ error: "Yönetici bulunamadı" }); return; }
  logger.info({ updatedBy: adminId, targetId, updates }, "Yönetici güncellendi");
  res.json(updated);
});

// PATCH /api/admin-panel/admins/:id/password — şifre güncelle (superadmin only)
router.patch("/admin-panel/admins/:id/password", requireAdmin, async (req: Request, res: Response) => {
  const adminId = sess(req)["adminId"] as number;
  const [me] = await db.select({ isSuperadmin: adminUsersTable.isSuperadmin })
    .from(adminUsersTable).where(eq(adminUsersTable.id, adminId));
  if (!me?.isSuperadmin) { res.status(403).json({ error: "Yalnızca süper yönetici erişebilir" }); return; }

  const targetId = Number(req.params["id"]);
  const { password } = req.body as { password?: string };
  if (!password || password.length < 8) { res.status(400).json({ error: "Şifre en az 8 karakter olmalı" }); return; }

  const passwordHash = await bcrypt.hash(password, 12);
  await db.update(adminUsersTable).set({ passwordHash }).where(eq(adminUsersTable.id, targetId));

  logger.info({ updatedBy: adminId, targetId }, "Yönetici şifresi güncellendi");
  res.json({ ok: true });
});

// DELETE /api/admin-panel/admins/:id — yönetici sil (superadmin only, kendini silemez)
router.delete("/admin-panel/admins/:id", requireAdmin, async (req: Request, res: Response) => {
  const adminId = sess(req)["adminId"] as number;
  const [me] = await db.select({ isSuperadmin: adminUsersTable.isSuperadmin })
    .from(adminUsersTable).where(eq(adminUsersTable.id, adminId));
  if (!me?.isSuperadmin) { res.status(403).json({ error: "Yalnızca süper yönetici erişebilir" }); return; }

  const targetId = Number(req.params["id"]);
  if (targetId === adminId) { res.status(400).json({ error: "Kendinizi silemezsiniz" }); return; }

  await db.delete(adminUsersTable).where(eq(adminUsersTable.id, targetId));
  logger.info({ deletedBy: adminId, targetId }, "Yönetici silindi");
  res.json({ ok: true });
});

export default router;
