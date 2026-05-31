import { Router } from "express";
import { db } from "@workspace/db";
import { codeSecretsFindingsTable, customersTable } from "@workspace/db";
import { eq, desc, count, and } from "drizzle-orm";
import { requireAdmin } from "./middleware";

const router = Router();

// GET /api/admin/code-secrets — Admin secrets özeti
router.get("/api/admin/code-secrets", requireAdmin, async (req, res) => {
  try {
    const findings = await db.select({
      id: codeSecretsFindingsTable.id,
      customerId: codeSecretsFindingsTable.customerId,
      platform: codeSecretsFindingsTable.platform,
      repoUrl: codeSecretsFindingsTable.repoUrl,
      repoName: codeSecretsFindingsTable.repoName,
      filePath: codeSecretsFindingsTable.filePath,
      secretType: codeSecretsFindingsTable.secretType,
      secretPreview: codeSecretsFindingsTable.secretPreview,
      severity: codeSecretsFindingsTable.severity,
      isVerified: codeSecretsFindingsTable.isVerified,
      isRevoked: codeSecretsFindingsTable.isRevoked,
      discoveredAt: codeSecretsFindingsTable.discoveredAt,
      companyName: customersTable.companyName,
      customerEmail: customersTable.email,
    })
      .from(codeSecretsFindingsTable)
      .leftJoin(customersTable, eq(codeSecretsFindingsTable.customerId, customersTable.id))
      .orderBy(desc(codeSecretsFindingsTable.discoveredAt))
      .limit(200);

    const [{ total }] = await db.select({ total: count() }).from(codeSecretsFindingsTable);
    const [{ critical }] = await db.select({ critical: count() }).from(codeSecretsFindingsTable).where(eq(codeSecretsFindingsTable.severity, "critical"));
    const [{ revoked }] = await db.select({ revoked: count() }).from(codeSecretsFindingsTable).where(eq(codeSecretsFindingsTable.isRevoked, true));

    res.json({
      findings,
      summary: {
        total: Number(total),
        critical: Number(critical),
        revoked: Number(revoked),
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// POST /api/admin/code-secrets/scan/:customerId — Manuel GitHub scan tetikle
router.post("/api/admin/code-secrets/scan/:customerId", requireAdmin, async (req, res) => {
  const customerId = Number(req.params["customerId"]);
  try {
    const [customer] = await db.select({ githubOrg: customersTable.githubOrg, id: customersTable.id })
      .from(customersTable)
      .where(eq(customersTable.id, customerId))
      .limit(1);

    if (!customer?.githubOrg) {
      res.status(400).json({ error: "Müşterinin GitHub org kaydı yok" });
      return;
    }

    res.json({ message: "GitHub taraması başlatıldı." });

    setImmediate(async () => {
      try {
        const { scanGitHubOrg } = await import("../../services/githubScanner");
        const { db: dbI } = await import("@workspace/db");
        const { codeSecretsFindingsTable: csf } = await import("@workspace/db");
        const findings = await scanGitHubOrg(customer.githubOrg!, customerId);
        for (const f of findings) {
          await dbI.insert(csf).values(f).onConflictDoNothing();
        }
      } catch (err) {
        // logger not available here, silently fail
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;
