import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { adminUsersTable } from "@workspace/db";
import { createAdminUser } from "../../services/auth";

const router = Router();

// POST /api/admin-panel/setup — one-time setup, disabled once any admin exists
router.post("/admin-panel/setup", async (req: Request, res: Response) => {
  const [existing] = await db.select({ id: adminUsersTable.id }).from(adminUsersTable);
  if (existing) {
    res.status(403).json({ error: "Admin zaten mevcut" });
    return;
  }
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password || password.length < 12) {
    res.status(400).json({ error: "Geçersiz e-posta veya şifre (min 12 karakter)" });
    return;
  }
  await createAdminUser(email, password);
  res.json({ success: true });
});

export default router;
