import { Router } from "express";
import { db } from "@workspace/db";
import { remediationTicketsTable, remediationCommentsTable, customersTable } from "@workspace/db";
import { eq, desc, and, lte, count, sql } from "drizzle-orm";
import { requireAdmin } from "./middleware";

const router = Router();

// GET /api/admin/remediation — Tüm ticketlar
router.get("/api/admin/remediation", requireAdmin, async (req, res) => {
  try {
    const { status, page = "1" } = req.query as Record<string, string>;
    const limit = 50;
    const offset = (Number(page) - 1) * limit;

    const where = status
      ? eq(remediationTicketsTable.status, status)
      : undefined;

    const tickets = await db
      .select({
        id: remediationTicketsTable.id,
        ticketNumber: remediationTicketsTable.ticketNumber,
        customerId: remediationTicketsTable.customerId,
        findingTitle: remediationTicketsTable.findingTitle,
        findingSeverity: remediationTicketsTable.findingSeverity,
        affectedAsset: remediationTicketsTable.affectedAsset,
        unifiedRiskScore: remediationTicketsTable.unifiedRiskScore,
        status: remediationTicketsTable.status,
        slaBreached: remediationTicketsTable.slaBreached,
        slaDeadline: remediationTicketsTable.slaDeadline,
        assignedToName: remediationTicketsTable.assignedToName,
        dueDate: remediationTicketsTable.dueDate,
        createdAt: remediationTicketsTable.createdAt,
        companyName: customersTable.companyName,
        customerEmail: customersTable.email,
      })
      .from(remediationTicketsTable)
      .leftJoin(customersTable, eq(remediationTicketsTable.customerId, customersTable.id))
      .where(where)
      .orderBy(desc(remediationTicketsTable.unifiedRiskScore))
      .limit(limit)
      .offset(offset);

    // Özet metrikler
    const [{ total }] = await db.select({ total: count() }).from(remediationTicketsTable);
    const [{ slaRisk }] = await db.select({ slaRisk: count() })
      .from(remediationTicketsTable)
      .where(and(
        eq(remediationTicketsTable.slaBreached, true),
      ));
    const [{ pendingVerif }] = await db.select({ pendingVerif: count() })
      .from(remediationTicketsTable)
      .where(eq(remediationTicketsTable.status, "pending_verification"));

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [{ closedThisMonth }] = await db.select({ closedThisMonth: count() })
      .from(remediationTicketsTable)
      .where(and(
        eq(remediationTicketsTable.status, "verified_fixed"),
        sql`${remediationTicketsTable.closedAt} >= ${thisMonthStart}`,
      ));

    res.json({
      tickets,
      summary: {
        total: Number(total),
        slaBreached: Number(slaRisk),
        pendingVerification: Number(pendingVerif),
        closedThisMonth: Number(closedThisMonth),
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// GET /api/admin/remediation/:id — Tekil ticket
router.get("/api/admin/remediation/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params["id"]);
  try {
    const [ticket] = await db.select()
      .from(remediationTicketsTable)
      .where(eq(remediationTicketsTable.id, id))
      .limit(1);
    if (!ticket) { res.status(404).json({ error: "Bulunamadı" }); return; }

    const comments = await db.select()
      .from(remediationCommentsTable)
      .where(eq(remediationCommentsTable.ticketId, id))
      .orderBy(desc(remediationCommentsTable.createdAt));

    res.json({ ticket, comments });
  } catch (err) {
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// POST /api/admin/remediation/:id/comment — Analist yorum ekle (internal olabilir)
router.post("/api/admin/remediation/:id/comment", requireAdmin, async (req, res) => {
  const id = Number(req.params["id"]);
  const { comment, isInternal = false } = req.body as { comment: string; isInternal?: boolean };
  try {
    await db.insert(remediationCommentsTable).values({
      ticketId: id,
      authorType: "analyst",
      authorName: "CyberStep Analist",
      comment,
      isInternal,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// PATCH /api/admin/remediation/:id/status — Durum güncelle
router.patch("/api/admin/remediation/:id/status", requireAdmin, async (req, res) => {
  const id = Number(req.params["id"]);
  const { status } = req.body as { status: string };
  try {
    await db.update(remediationTicketsTable).set({
      status,
      updatedAt: new Date(),
      ...(status === "verified_fixed" ? { closedAt: new Date(), verifiedAt: new Date(), verifiedBy: "analyst" } : {}),
    }).where(eq(remediationTicketsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;
