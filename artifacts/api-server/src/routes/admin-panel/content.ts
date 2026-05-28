import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import {
  consultingServicesTable, techPartnersTable, whiteLabelPartnersTable,
} from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireAdmin } from "./middleware";
import { logger } from "../../lib/logger";

const router = Router();

// ─── Consulting Services ───────────────────────────────────────────────────────

router.get("/admin-panel/consulting-services", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(consultingServicesTable).orderBy(asc(consultingServicesTable.sortOrder));
  res.json(rows);
});

router.post("/admin-panel/consulting-services", requireAdmin, async (req: Request, res: Response) => {
  const { title, description, icon, sortOrder } = req.body as {
    title: string; description: string; icon?: string; sortOrder?: number;
  };
  if (!title || !description) { res.status(400).json({ error: "Başlık ve açıklama zorunludur" }); return; }
  const [row] = await db.insert(consultingServicesTable)
    .values({ title, description, icon: icon ?? "Shield", sortOrder: sortOrder ?? 0 })
    .returning();
  logger.info({ id: row.id }, "Consulting service created");
  res.status(201).json(row);
});

router.put("/admin-panel/consulting-services/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { title, description, icon, isActive, sortOrder } = req.body as {
    title?: string; description?: string; icon?: string; isActive?: boolean; sortOrder?: number;
  };
  const [row] = await db.update(consultingServicesTable)
    .set({ ...(title !== undefined && { title }), ...(description !== undefined && { description }), ...(icon !== undefined && { icon }), ...(isActive !== undefined && { isActive }), ...(sortOrder !== undefined && { sortOrder }), updatedAt: new Date() })
    .where(eq(consultingServicesTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Bulunamadı" }); return; }
  res.json(row);
});

router.delete("/admin-panel/consulting-services/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await db.delete(consultingServicesTable).where(eq(consultingServicesTable.id, id));
  logger.info({ id }, "Consulting service deleted");
  res.json({ success: true });
});

// ─── Tech Partners ─────────────────────────────────────────────────────────────

router.get("/admin-panel/tech-partners", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(techPartnersTable).orderBy(asc(techPartnersTable.sortOrder));
  res.json(rows);
});

router.post("/admin-panel/tech-partners", requireAdmin, async (req: Request, res: Response) => {
  const { name, logoUrl, websiteUrl, salesRepName, salesRepEmail, additionalContacts, sortOrder } = req.body as {
    name: string; logoUrl: string; websiteUrl?: string;
    salesRepName?: string; salesRepEmail?: string; additionalContacts?: unknown[];
    sortOrder?: number;
  };
  if (!name || !logoUrl) { res.status(400).json({ error: "İsim ve logo URL zorunludur" }); return; }
  const [row] = await db.insert(techPartnersTable)
    .values({ name, logoUrl, websiteUrl: websiteUrl ?? null, salesRepName: salesRepName ?? null, salesRepEmail: salesRepEmail ?? null, additionalContacts: additionalContacts ?? [], sortOrder: sortOrder ?? 0 })
    .returning();
  logger.info({ id: row.id }, "Tech partner created");
  res.status(201).json(row);
});

router.put("/admin-panel/tech-partners/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { name, logoUrl, websiteUrl, salesRepName, salesRepEmail, additionalContacts, isActive, sortOrder } = req.body as {
    name?: string; logoUrl?: string; websiteUrl?: string;
    salesRepName?: string | null; salesRepEmail?: string | null; additionalContacts?: unknown[];
    isActive?: boolean; sortOrder?: number;
  };
  const [row] = await db.update(techPartnersTable)
    .set({
      ...(name !== undefined && { name }),
      ...(logoUrl !== undefined && { logoUrl }),
      ...(websiteUrl !== undefined && { websiteUrl }),
      ...(salesRepName !== undefined && { salesRepName }),
      ...(salesRepEmail !== undefined && { salesRepEmail }),
      ...(additionalContacts !== undefined && { additionalContacts }),
      ...(isActive !== undefined && { isActive }),
      ...(sortOrder !== undefined && { sortOrder }),
      updatedAt: new Date(),
    })
    .where(eq(techPartnersTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Bulunamadı" }); return; }
  res.json(row);
});

router.delete("/admin-panel/tech-partners/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await db.delete(techPartnersTable).where(eq(techPartnersTable.id, id));
  logger.info({ id }, "Tech partner deleted");
  res.json({ success: true });
});

// ─── White Label Partners ──────────────────────────────────────────────────────

router.get("/admin-panel/whitelabel-partners", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(whiteLabelPartnersTable).orderBy(asc(whiteLabelPartnersTable.createdAt));
  res.json(rows);
});

router.post("/admin-panel/whitelabel-partners", requireAdmin, async (req: Request, res: Response) => {
  const { name, slug, logoUrl, primaryColor, contactEmail, description } = req.body as {
    name: string; slug: string; logoUrl?: string; primaryColor?: string;
    contactEmail?: string; description?: string;
  };
  if (!name || !slug) { res.status(400).json({ error: "İsim ve slug zorunludur" }); return; }

  const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const [existing] = await db.select({ id: whiteLabelPartnersTable.id })
    .from(whiteLabelPartnersTable).where(eq(whiteLabelPartnersTable.slug, cleanSlug));
  if (existing) { res.status(409).json({ error: "Bu slug zaten kullanılıyor" }); return; }

  const [row] = await db.insert(whiteLabelPartnersTable)
    .values({ name, slug: cleanSlug, logoUrl: logoUrl ?? null, primaryColor: primaryColor ?? "#10b981", contactEmail: contactEmail ?? null, description: description ?? null })
    .returning();
  logger.info({ id: row.id, slug: cleanSlug }, "White label partner created");
  res.status(201).json(row);
});

router.put("/admin-panel/whitelabel-partners/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { name, logoUrl, primaryColor, contactEmail, description, isActive } = req.body as {
    name?: string; logoUrl?: string; primaryColor?: string; contactEmail?: string;
    description?: string; isActive?: boolean;
  };
  const [row] = await db.update(whiteLabelPartnersTable)
    .set({ ...(name !== undefined && { name }), ...(logoUrl !== undefined && { logoUrl }), ...(primaryColor !== undefined && { primaryColor }), ...(contactEmail !== undefined && { contactEmail }), ...(description !== undefined && { description }), ...(isActive !== undefined && { isActive }), updatedAt: new Date() })
    .where(eq(whiteLabelPartnersTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Bulunamadı" }); return; }
  res.json(row);
});

router.delete("/admin-panel/whitelabel-partners/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await db.delete(whiteLabelPartnersTable).where(eq(whiteLabelPartnersTable.id, id));
  logger.info({ id }, "White label partner deleted");
  res.json({ success: true });
});

// ─── Public Endpoints ──────────────────────────────────────────────────────────

router.get("/public/consulting-services", async (_req, res) => {
  const rows = await db.select().from(consultingServicesTable)
    .where(eq(consultingServicesTable.isActive, true))
    .orderBy(asc(consultingServicesTable.sortOrder));
  res.json(rows);
});

router.get("/public/tech-partners", async (_req, res) => {
  const rows = await db.select().from(techPartnersTable)
    .where(eq(techPartnersTable.isActive, true))
    .orderBy(asc(techPartnersTable.sortOrder));
  res.json(rows);
});

router.get("/public/whitelabel/:slug", async (req: Request, res: Response) => {
  const { slug } = req.params;
  const [partner] = await db.select().from(whiteLabelPartnersTable)
    .where(eq(whiteLabelPartnersTable.slug, slug as string));
  if (!partner || !partner.isActive) {
    res.status(404).json({ error: "Partner bulunamadı" });
    return;
  }
  res.json(partner);
});

export default router;
