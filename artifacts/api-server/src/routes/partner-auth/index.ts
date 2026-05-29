import { Router } from "express";
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { partnersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger";

const router = Router();

function getSession(req: Request) {
  return req.session as unknown as Record<string, unknown>;
}

// POST /api/partner-auth/register
router.post("/partner-auth/register", async (req: Request, res: Response) => {
  const { email, password, companyName, contactName, phone, website, categories, description } = req.body as {
    email?: string; password?: string; companyName?: string; contactName?: string;
    phone?: string; website?: string; categories?: string[]; description?: string;
  };

  if (!email || !password || !companyName || !contactName) {
    res.status(400).json({ error: "E-posta, şifre, firma adı ve yetkili adı zorunludur" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Şifre en az 8 karakter olmalıdır" });
    return;
  }

  const [existing] = await db.select({ id: partnersTable.id })
    .from(partnersTable).where(eq(partnersTable.email, email.toLowerCase()));
  if (existing) {
    res.status(409).json({ error: "Bu e-posta adresi zaten kayıtlı" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [partner] = await db.insert(partnersTable).values({
    email: email.toLowerCase(),
    passwordHash,
    companyName,
    contactName,
    phone: phone ?? null,
    website: website ?? null,
    categories: categories ?? [],
    description: description ?? null,
    status: "pending",
    tier: "silver",
    subscriptionStatus: "trial",
  }).returning();

  logger.info({ partnerId: partner.id }, "Partner registered — pending approval");

  const { passwordHash: _, ...safe } = partner;
  res.status(201).json({ ...safe, message: "Başvurunuz alındı. Onay sonrası giriş yapabilirsiniz." });
});

// POST /api/partner-auth/login
router.post("/partner-auth/login", async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: "E-posta ve şifre gerekli" });
    return;
  }

  const [partner] = await db.select().from(partnersTable)
    .where(eq(partnersTable.email, email.toLowerCase()));

  if (!partner || !partner.passwordHash) {
    res.status(401).json({ error: "Geçersiz e-posta veya şifre" });
    return;
  }

  const ok = await bcrypt.compare(password, partner.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Geçersiz e-posta veya şifre" });
    return;
  }

  if (partner.status === "pending") {
    res.status(403).json({ error: "Hesabınız henüz onaylanmadı. Onay e-postasını bekleyin." });
    return;
  }
  if (partner.status === "suspended") {
    res.status(403).json({ error: "Hesabınız askıya alınmış. Destek ile iletişime geçin." });
    return;
  }

  getSession(req)["partnerId"] = partner.id;
  logger.info({ partnerId: partner.id }, "Partner login");

  const { passwordHash: _, ...safe } = partner;
  res.json({ success: true, partner: safe });
});

// GET /api/partner-auth/me
router.get("/partner-auth/me", async (req: Request, res: Response) => {
  const partnerId = getSession(req)["partnerId"] as number | undefined;
  if (!partnerId) {
    res.status(401).json({ error: "Giriş yapmanız gerekiyor" });
    return;
  }

  const [partner] = await db.select().from(partnersTable).where(eq(partnersTable.id, partnerId));
  if (!partner) {
    res.status(404).json({ error: "Partner bulunamadı" });
    return;
  }

  const { passwordHash: _, ...safe } = partner;
  res.json(safe);
});

// POST /api/partner-auth/logout
router.post("/partner-auth/logout", (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) logger.error({ err }, "Session destroy error on partner logout");
    res.clearCookie("cstep.sid");
    res.json({ success: true });
  });
});

// PUT /api/partner-auth/profile
router.put("/partner-auth/profile", async (req: Request, res: Response) => {
  const partnerId = getSession(req)["partnerId"] as number | undefined;
  if (!partnerId) { res.status(401).json({ error: "Giriş yapmanız gerekiyor" }); return; }

  const { companyName, contactName, phone, website, description, categories } = req.body as {
    companyName?: string; contactName?: string; phone?: string;
    website?: string; description?: string; categories?: string[];
  };

  const [updated] = await db.update(partnersTable)
    .set({
      ...(companyName && { companyName }),
      ...(contactName && { contactName }),
      ...(phone !== undefined && { phone }),
      ...(website !== undefined && { website }),
      ...(description !== undefined && { description }),
      ...(categories && { categories }),
    })
    .where(eq(partnersTable.id, partnerId))
    .returning();

  const { passwordHash: _, ...safe } = updated;
  res.json(safe);
});

export default router;
