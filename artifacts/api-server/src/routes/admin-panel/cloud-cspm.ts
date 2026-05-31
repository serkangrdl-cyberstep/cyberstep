import { Router } from "express";
import { db } from "@workspace/db";
import { cloudConnectionsTable, cloudFindingsTable, customersTable } from "@workspace/db";
import { eq, desc, count, and } from "drizzle-orm";
import { requireAdmin } from "./middleware";

const router = Router();

// GET /api/admin/cloud-cspm — Admin cloud özeti
router.get("/api/admin/cloud-cspm", requireAdmin, async (req, res) => {
  try {
    const connections = await db.select({
      id: cloudConnectionsTable.id,
      customerId: cloudConnectionsTable.customerId,
      provider: cloudConnectionsTable.provider,
      accountName: cloudConnectionsTable.accountName,
      regions: cloudConnectionsTable.regions,
      lastScannedAt: cloudConnectionsTable.lastScannedAt,
      isActive: cloudConnectionsTable.isActive,
      createdAt: cloudConnectionsTable.createdAt,
      companyName: customersTable.companyName,
      customerEmail: customersTable.email,
    })
      .from(cloudConnectionsTable)
      .leftJoin(customersTable, eq(cloudConnectionsTable.customerId, customersTable.id))
      .orderBy(desc(cloudConnectionsTable.createdAt));

    const findings = await db.select({
      id: cloudFindingsTable.id,
      customerId: cloudFindingsTable.customerId,
      provider: cloudFindingsTable.provider,
      resourceType: cloudFindingsTable.resourceType,
      findingType: cloudFindingsTable.findingType,
      severity: cloudFindingsTable.severity,
      title: cloudFindingsTable.title,
      isFixed: cloudFindingsTable.isFixed,
      lastSeenAt: cloudFindingsTable.lastSeenAt,
      companyName: customersTable.companyName,
    })
      .from(cloudFindingsTable)
      .leftJoin(customersTable, eq(cloudFindingsTable.customerId, customersTable.id))
      .where(eq(cloudFindingsTable.isFixed, false))
      .orderBy(desc(cloudFindingsTable.lastSeenAt))
      .limit(100);

    const [{ totalConns }] = await db.select({ totalConns: count() }).from(cloudConnectionsTable);
    const [{ totalFindings }] = await db.select({ totalFindings: count() }).from(cloudFindingsTable).where(eq(cloudFindingsTable.isFixed, false));
    const [{ criticalFindings }] = await db.select({ criticalFindings: count() }).from(cloudFindingsTable).where(and(eq(cloudFindingsTable.severity, "critical"), eq(cloudFindingsTable.isFixed, false)));

    res.json({
      connections,
      findings,
      summary: {
        totalConnections: Number(totalConns),
        totalOpenFindings: Number(totalFindings),
        criticalFindings: Number(criticalFindings),
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// POST /api/admin/cloud-cspm/scan/:connectionId — Manuel tarama tetikle
router.post("/api/admin/cloud-cspm/scan/:connectionId", requireAdmin, async (req, res) => {
  const connId = Number(req.params["connectionId"]);
  try {
    const [conn] = await db.select()
      .from(cloudConnectionsTable)
      .where(eq(cloudConnectionsTable.id, connId))
      .limit(1);
    if (!conn) { res.status(404).json({ error: "Bağlantı bulunamadı" }); return; }

    const { runCloudScan } = await import("../cloud-cspm/index");
    res.json({ message: "Tarama başlatıldı." });
    setImmediate(() => runCloudScan(conn, conn.customerId!));
  } catch (err) {
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;
