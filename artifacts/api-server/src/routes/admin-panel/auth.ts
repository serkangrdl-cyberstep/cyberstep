import { Router } from "express";
import type { Request, Response } from "express";
import { verifyAdminPassword, generateTotpSecret, generateTotpQrUrl, verifyTotp, enableTotp, updateLastLogin } from "../../services/auth";
import { db } from "@workspace/db";
import { adminUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger";
import QRCode from "qrcode";

const router = Router();

function sess(req: Request) {
  return req.session as unknown as Record<string, unknown>;
}

router.post("/admin-panel/auth/login", async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) { res.status(400).json({ error: "E-posta ve şifre gerekli" }); return; }

  const user = await verifyAdminPassword(email, password);
  if (!user) { res.status(401).json({ error: "Geçersiz kimlik bilgileri" }); return; }

  if (user.totpEnabled) {
    sess(req)["pendingAdminId"] = user.id;
    res.json({ requiresTotp: true });
  } else {
    sess(req)["adminId"] = user.id;
    sess(req)["pendingAdminId"] = undefined;
    await updateLastLogin(user.id);
    logger.info({ userId: user.id }, "Admin login");
    res.json({ success: true });
  }
});

router.post("/admin-panel/auth/totp-verify", async (req: Request, res: Response) => {
  const pendingId = sess(req)["pendingAdminId"] as number | undefined;
  if (!pendingId) { res.status(401).json({ error: "Önce giriş yapın" }); return; }

  const { token } = req.body as { token?: string };
  if (!token) { res.status(400).json({ error: "TOTP kodu gerekli" }); return; }

  const [user] = await db.select().from(adminUsersTable).where(eq(adminUsersTable.id, pendingId));
  if (!user?.totpSecret) { res.status(400).json({ error: "TOTP yapılandırılmamış" }); return; }

  const ok = await verifyTotp(user.totpSecret, token);
  if (!ok) { res.status(401).json({ error: "Geçersiz TOTP kodu" }); return; }

  sess(req)["adminId"] = user.id;
  sess(req)["pendingAdminId"] = undefined;
  await updateLastLogin(user.id);
  logger.info({ userId: user.id }, "Admin TOTP verified, login complete");
  res.json({ success: true });
});

router.post("/admin-panel/auth/logout", (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) logger.error({ err }, "Session destroy error on admin logout");
    res.clearCookie("cstep.sid");
    res.json({ success: true });
  });
});

router.get("/admin-panel/auth/me", async (req: Request, res: Response) => {
  const adminId = sess(req)["adminId"] as number | undefined;
  if (!adminId) { res.status(401).json({ error: "Giriş yapılmamış" }); return; }

  const [user] = await db.select({
    id: adminUsersTable.id,
    email: adminUsersTable.email,
    totpEnabled: adminUsersTable.totpEnabled,
    lastLoginAt: adminUsersTable.lastLoginAt,
  }).from(adminUsersTable).where(eq(adminUsersTable.id, adminId));

  if (!user) { res.status(401).json({ error: "Kullanıcı bulunamadı" }); return; }
  res.json(user);
});

router.post("/admin-panel/auth/totp-setup", async (req: Request, res: Response) => {
  const adminId = sess(req)["adminId"] as number | undefined;
  if (!adminId) { res.status(401).json({ error: "Giriş yapılmamış" }); return; }

  const [user] = await db.select().from(adminUsersTable).where(eq(adminUsersTable.id, adminId));
  if (!user) { res.status(404).json({ error: "Kullanıcı bulunamadı" }); return; }

  const secret = await generateTotpSecret();
  const otpauthUrl = await generateTotpQrUrl(user.email, secret);
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

  sess(req)["pendingTotpSecret"] = secret;
  res.json({ secret, qrDataUrl });
});

router.post("/admin-panel/auth/totp-disable", async (req: Request, res: Response) => {
  const adminId = sess(req)["adminId"] as number | undefined;
  if (!adminId) { res.status(401).json({ error: "Giriş yapılmamış" }); return; }

  await db.update(adminUsersTable)
    .set({ totpEnabled: false, totpSecret: null })
    .where(eq(adminUsersTable.id, adminId));

  logger.info({ userId: adminId }, "TOTP disabled for admin");
  res.json({ success: true });
});

router.post("/admin-panel/auth/totp-confirm", async (req: Request, res: Response) => {
  const adminId = sess(req)["adminId"] as number | undefined;
  if (!adminId) { res.status(401).json({ error: "Giriş yapılmamış" }); return; }

  const { token } = req.body as { token?: string };
  const secret = sess(req)["pendingTotpSecret"] as string | undefined;
  if (!token || !secret) { res.status(400).json({ error: "Geçersiz istek" }); return; }

  const ok = await verifyTotp(secret, token);
  if (!ok) { res.status(401).json({ error: "TOTP kodu geçersiz" }); return; }

  await enableTotp(adminId, secret);
  sess(req)["pendingTotpSecret"] = undefined;
  logger.info({ userId: adminId }, "TOTP enabled for admin");
  res.json({ success: true });
});

export default router;
