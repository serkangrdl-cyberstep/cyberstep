import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { adminUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createAdminUser } from "../../services/auth";

const router = Router();

// POST /api/admin-panel/setup — one-time setup (only works if no admin exists)
router.post("/admin-panel/setup", async (req: Request, res: Response) => {
  const [existing] = await db.select({ id: adminUsersTable.id }).from(adminUsersTable);
  if (existing) {
    res.status(403).json({ error: "Admin zaten mevcut" });
    return;
  }
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password || password.length < 8) {
    res.status(400).json({ error: "Geçersiz e-posta veya şifre (min 8 karakter)" });
    return;
  }
  await createAdminUser(email, password);
  res.json({ success: true });
});

// POST /api/admin-panel/reset-password — called internally to fix existing admin hash
router.post("/admin-panel/internal/fix-password", async (req: Request, res: Response) => {
  const { secret, email, password } = req.body as { secret?: string; email?: string; password?: string };
  if (secret !== process.env["SESSION_SECRET"]) {
    res.status(403).json({ error: "Yetkisiz" });
    return;
  }
  if (!email || !password) { res.status(400).json({ error: "Eksik bilgi" }); return; }
  const bcrypt = await import("bcryptjs");
  const hash = await bcrypt.hash(password, 12);
  await db.update(adminUsersTable).set({ passwordHash: hash }).where(eq(adminUsersTable.email, email));
  res.json({ success: true });
});

export default router;
