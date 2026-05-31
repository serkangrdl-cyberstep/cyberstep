import { Router } from "express";
import { db } from "@workspace/db";
import {
  remediationTicketsTable,
  remediationCommentsTable,
  attackPathsTable,
} from "@workspace/db";
import { eq, desc, and, asc } from "drizzle-orm";
import { requireCustomer, getCustomerId } from "../../middleware/auth";
import { calculateUnifiedRiskScore, getSLADays, getSLADeadline } from "../../services/riskPrioritization";
import { scheduleVerificationScan } from "../../services/verificationScanner";

const router = Router();

let ticketSeq = 0;
function generateTicketNumber(): string {
  ticketSeq++;
  const year = new Date().getFullYear();
  const seq = String(ticketSeq).padStart(5, "0");
  return `CS-REM-${year}-${seq}`;
}

// GET /api/portal/tickets — Müşterinin ticket listesi
router.get("/api/portal/tickets", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }
  try {
    const tickets = await db.select()
      .from(remediationTicketsTable)
      .where(eq(remediationTicketsTable.customerId, customerId))
      .orderBy(desc(remediationTicketsTable.unifiedRiskScore));
    res.json({ tickets });
  } catch (err) {
    req.log.error({ err }, "GET /api/portal/tickets error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// GET /api/portal/tickets/:id — Tekil ticket + yorumlar
router.get("/api/portal/tickets/:id", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }
  const id = Number(req.params["id"]);
  try {
    const [ticket] = await db.select()
      .from(remediationTicketsTable)
      .where(and(eq(remediationTicketsTable.id, id), eq(remediationTicketsTable.customerId, customerId)))
      .limit(1);
    if (!ticket) { res.status(404).json({ error: "Bulunamadı" }); return; }

    const comments = await db.select()
      .from(remediationCommentsTable)
      .where(and(eq(remediationCommentsTable.ticketId, id), eq(remediationCommentsTable.isInternal, false)))
      .orderBy(asc(remediationCommentsTable.createdAt));

    res.json({ ticket, comments });
  } catch (err) {
    req.log.error({ err }, "GET /api/portal/tickets/:id error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// POST /api/portal/findings/:findingId/remediate — Bulgudan ticket aç
router.post("/api/portal/findings/:findingId/remediate", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }
  const findingId = Number(req.params["findingId"]);
  const {
    findingTitle, findingSeverity, findingDescription, findingType,
    affectedAsset, cvssScore, epssScore, assignedToName, assignedToEmail,
  } = req.body as Record<string, string | number>;

  try {
    const severity = String(findingSeverity || "medium");
    const slaDays = getSLADays(severity);
    const slaDeadline = getSLADeadline(severity);

    const unifiedRiskScore = calculateUnifiedRiskScore({
      cvssScore: Number(cvssScore) || 5,
      epssScore: Number(epssScore) || 0.1,
      businessImpact: severity === "critical" ? "critical" : severity === "high" ? "high" : "medium",
      isExternallyReachable: true,
      hasActiveExploit: false,
      threatActorTargeting: false,
    });

    const ticketNumber = generateTicketNumber();
    const dueDate = slaDeadline;

    const [ticket] = await db.insert(remediationTicketsTable).values({
      ticketNumber,
      customerId,
      findingId,
      findingTitle: String(findingTitle || ""),
      findingSeverity: severity,
      findingDescription: String(findingDescription || ""),
      findingType: String(findingType || ""),
      affectedAsset: String(affectedAsset || ""),
      cvssScore: String(cvssScore || "5.0"),
      epssScore: String(epssScore || "0.1"),
      businessImpact: severity === "critical" ? "critical" : "medium",
      unifiedRiskScore: String(unifiedRiskScore),
      assignedToName: assignedToName ? String(assignedToName) : null,
      assignedToEmail: assignedToEmail ? String(assignedToEmail) : null,
      assignedAt: assignedToEmail ? new Date() : null,
      dueDate,
      slaDays,
      slaDeadline,
      status: "open",
    }).returning();

    await db.insert(remediationCommentsTable).values({
      ticketId: ticket.id,
      authorType: "system",
      authorName: "CyberStep",
      comment: `Ticket oluşturuldu. Risk Skoru: ${unifiedRiskScore}/100. SLA: ${slaDays} gün (${slaDeadline.toLocaleDateString("tr-TR")}).`,
      isInternal: false,
    });

    res.status(201).json({ ticket });
  } catch (err) {
    req.log.error({ err }, "POST /api/portal/findings/:id/remediate error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// POST /api/portal/tickets/:id/fixed — "Düzelttim" bildir
router.post("/api/portal/tickets/:id/fixed", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }
  const id = Number(req.params["id"]);
  const { fixDescription } = req.body as { fixDescription?: string };

  try {
    const [ticket] = await db.select()
      .from(remediationTicketsTable)
      .where(and(eq(remediationTicketsTable.id, id), eq(remediationTicketsTable.customerId, customerId)))
      .limit(1);
    if (!ticket) { res.status(404).json({ error: "Bulunamadı" }); return; }

    if (fixDescription) {
      await db.update(remediationTicketsTable).set({
        fixDescription,
        updatedAt: new Date(),
      }).where(eq(remediationTicketsTable.id, id));
    }

    await scheduleVerificationScan(id, 4);

    if (fixDescription) {
      await db.insert(remediationCommentsTable).values({
        ticketId: id,
        authorType: "customer",
        authorName: "Müşteri",
        comment: `Düzeltme bildirimi: ${fixDescription}`,
        isInternal: false,
      });
    }

    res.json({ message: "Doğrulama taraması 4 saat içinde yapılacak.", status: "pending_verification" });
  } catch (err) {
    req.log.error({ err }, "POST /api/portal/tickets/:id/fixed error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// POST /api/portal/tickets/:id/comment — Yorum ekle
router.post("/api/portal/tickets/:id/comment", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }
  const id = Number(req.params["id"]);
  const { comment } = req.body as { comment: string };

  try {
    const [ticket] = await db.select({ id: remediationTicketsTable.id })
      .from(remediationTicketsTable)
      .where(and(eq(remediationTicketsTable.id, id), eq(remediationTicketsTable.customerId, customerId)))
      .limit(1);
    if (!ticket) { res.status(404).json({ error: "Bulunamadı" }); return; }

    await db.insert(remediationCommentsTable).values({
      ticketId: id,
      authorType: "customer",
      authorName: "Müşteri",
      comment,
      isInternal: false,
    });

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "POST /api/portal/tickets/:id/comment error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// POST /api/portal/tickets/:id/accept-risk — Risk kabul et
router.post("/api/portal/tickets/:id/accept-risk", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }
  const id = Number(req.params["id"]);
  const { reason } = req.body as { reason?: string };

  try {
    const [ticket] = await db.select({ id: remediationTicketsTable.id })
      .from(remediationTicketsTable)
      .where(and(eq(remediationTicketsTable.id, id), eq(remediationTicketsTable.customerId, customerId)))
      .limit(1);
    if (!ticket) { res.status(404).json({ error: "Bulunamadı" }); return; }

    await db.update(remediationTicketsTable).set({
      status: "accepted_risk",
      resolutionNotes: reason || "Müşteri riski kabul etti.",
      closedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(remediationTicketsTable.id, id));

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "accept-risk error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// GET /api/portal/attack-paths — Saldırı yolları
router.get("/api/portal/attack-paths", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }
  try {
    const paths = await db.select()
      .from(attackPathsTable)
      .where(and(eq(attackPathsTable.customerId, customerId), eq(attackPathsTable.status, "active")))
      .orderBy(desc(attackPathsTable.confidence));
    res.json({ paths });
  } catch (err) {
    req.log.error({ err }, "GET /api/portal/attack-paths error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// GET /api/portal/risk-priority — Birleşik risk listesi
router.get("/api/portal/risk-priority", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }
  try {
    const tickets = await db.select()
      .from(remediationTicketsTable)
      .where(eq(remediationTicketsTable.customerId, customerId))
      .orderBy(desc(remediationTicketsTable.unifiedRiskScore));

    res.json({ findings: tickets });
  } catch (err) {
    req.log.error({ err }, "GET /api/portal/risk-priority error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;
