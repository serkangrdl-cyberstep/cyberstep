import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../../lib/logger";

const router = Router();

router.get("/public/security-advisories", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query["limit"] ?? 10), 20);
    const result = await db.execute(sql`
      SELECT id, title, source, link, summary, severity, sector, published_at
      FROM security_advisories
      ORDER BY published_at DESC
      LIMIT ${limit}
    `);
    res.json(result.rows);
  } catch (err) {
    logger.warn({ err }, "Security advisories fetch failed");
    res.status(500).json({ error: "Duyurular yüklenemedi" });
  }
});

export default router;
