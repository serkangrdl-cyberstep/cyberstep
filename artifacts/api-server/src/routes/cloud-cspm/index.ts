import { Router } from "express";
import { db } from "@workspace/db";
import { cloudConnectionsTable, cloudFindingsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireCustomer, getCustomerId } from "../../middleware/auth";
import { logger } from "../../lib/logger";
import { encryptSecret, decryptSecret } from "../../services/fabric-crypto";
import { AWSCSPMScanner, parseAwsCredentials } from "../../services/awsCSPM";

const router = Router();

// GET /api/portal/cloud/connections
router.get("/api/portal/cloud/connections", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }
  try {
    const conns = await db.select({
      id: cloudConnectionsTable.id,
      provider: cloudConnectionsTable.provider,
      accountId: cloudConnectionsTable.accountId,
      accountName: cloudConnectionsTable.accountName,
      regions: cloudConnectionsTable.regions,
      lastScannedAt: cloudConnectionsTable.lastScannedAt,
      isActive: cloudConnectionsTable.isActive,
      createdAt: cloudConnectionsTable.createdAt,
    })
      .from(cloudConnectionsTable)
      .where(eq(cloudConnectionsTable.customerId, customerId))
      .orderBy(desc(cloudConnectionsTable.createdAt));
    res.json({ connections: conns });
  } catch (err) {
    req.log.error({ err }, "GET /api/portal/cloud/connections error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// POST /api/portal/cloud/connect — AWS bağlantısı kaydet
router.post("/api/portal/cloud/connect", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }
  const { provider, accessKeyId, secretAccessKey, accountName, regions } = req.body as {
    provider: string;
    accessKeyId: string;
    secretAccessKey: string;
    accountName?: string;
    regions?: string[];
  };

  if (!provider || !accessKeyId || !secretAccessKey) {
    res.status(400).json({ error: "Provider, accessKeyId ve secretAccessKey zorunlu" });
    return;
  }

  try {
    if (provider === "aws") {
      try {
        const { IAMClient, GetAccountSummaryCommand } = await import("@aws-sdk/client-iam");
        const iam = new IAMClient({
          credentials: { accessKeyId, secretAccessKey },
          region: "us-east-1",
        });
        await iam.send(new GetAccountSummaryCommand({}));
      } catch {
        try {
          const { S3Client, ListBucketsCommand } = await import("@aws-sdk/client-s3");
          const s3 = new S3Client({
            credentials: { accessKeyId, secretAccessKey },
            region: "us-east-1",
          });
          await s3.send(new ListBucketsCommand({}));
        } catch {
          res.status(400).json({ error: "AWS kimlik bilgileri doğrulanamadı. Lütfen kontrol edin." });
          return;
        }
      }
    }

    const credJson = JSON.stringify({ accessKeyId, secretAccessKey });
    const credentialsEncrypted = encryptSecret(credJson) ?? credJson;

    const [conn] = await db.insert(cloudConnectionsTable).values({
      customerId,
      provider,
      accountName: accountName || `${provider.toUpperCase()} Hesabı`,
      accessType: "read_only",
      credentialsEncrypted,
      regions: regions ?? ["eu-central-1"],
      isActive: true,
    }).returning({ id: cloudConnectionsTable.id, provider: cloudConnectionsTable.provider });

    res.status(201).json({ connection: conn, message: "Bulut hesabı bağlandı. İlk tarama gece otomatik yapılacak." });
  } catch (err) {
    req.log.error({ err }, "POST /api/portal/cloud/connect error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// DELETE /api/portal/cloud/connections/:id
router.delete("/api/portal/cloud/connections/:id", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }
  const id = Number(req.params["id"]);
  try {
    await db.delete(cloudConnectionsTable).where(
      and(eq(cloudConnectionsTable.id, id), eq(cloudConnectionsTable.customerId, customerId))
    );
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "DELETE cloud connection error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// GET /api/portal/cloud/findings
router.get("/api/portal/cloud/findings", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }
  try {
    const findings = await db.select()
      .from(cloudFindingsTable)
      .where(and(eq(cloudFindingsTable.customerId, customerId), eq(cloudFindingsTable.isFixed, false)))
      .orderBy(desc(cloudFindingsTable.lastSeenAt));
    res.json({ findings });
  } catch (err) {
    req.log.error({ err }, "GET /api/portal/cloud/findings error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// POST /api/portal/cloud/scan/:connectionId — Manuel tarama başlat
router.post("/api/portal/cloud/scan/:connectionId", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }
  const connId = Number(req.params["connectionId"]);

  try {
    const [conn] = await db.select()
      .from(cloudConnectionsTable)
      .where(and(eq(cloudConnectionsTable.id, connId), eq(cloudConnectionsTable.customerId, customerId)))
      .limit(1);
    if (!conn) { res.status(404).json({ error: "Bağlantı bulunamadı" }); return; }

    res.json({ message: "Tarama başlatıldı. Sonuçlar birkaç dakika içinde görünecek." });

    setImmediate(async () => {
      await runCloudScan(conn, customerId);
    });
  } catch (err) {
    req.log.error({ err }, "POST /api/portal/cloud/scan error");
  }
});

export async function runCloudScan(
  conn: typeof cloudConnectionsTable.$inferSelect,
  customerId: number
): Promise<void> {
  try {
    const raw = decryptSecret(conn.credentialsEncrypted ?? "");
    if (!raw) { logger.warn({ connId: conn.id }, "cloud scan: no credentials"); return; }

    const creds = parseAwsCredentials(raw);
    if (!creds) { logger.warn({ connId: conn.id }, "cloud scan: invalid credential format"); return; }

    const regions = (conn.regions as string[]) ?? ["eu-central-1"];
    const scanner = new AWSCSPMScanner(creds.accessKeyId, creds.secretAccessKey, regions);
    const findings = await scanner.runFullScan();

    for (const f of findings) {
      await db.insert(cloudFindingsTable).values({
        connectionId: conn.id,
        customerId,
        ...f,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
      }).onConflictDoNothing();
    }

    await db.update(cloudConnectionsTable)
      .set({ lastScannedAt: new Date() })
      .where(eq(cloudConnectionsTable.id, conn.id));

    logger.info({ connId: conn.id, count: findings.length }, "Cloud CSPM scan complete");
  } catch (err) {
    logger.error({ err, connId: conn.id }, "runCloudScan error");
  }
}

export default router;
