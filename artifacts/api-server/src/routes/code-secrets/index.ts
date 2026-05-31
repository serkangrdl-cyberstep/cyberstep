import { Router } from "express";
import { db } from "@workspace/db";
import { codeSecretsFindingsTable, customersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireCustomer, getCustomerId } from "../../middleware/auth";

const router = Router();

// GET /api/portal/code-secrets — Müşterinin code secret bulgularını getir
router.get("/api/portal/code-secrets", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }
  try {
    const findings = await db.select()
      .from(codeSecretsFindingsTable)
      .where(eq(codeSecretsFindingsTable.customerId, customerId))
      .orderBy(desc(codeSecretsFindingsTable.discoveredAt));
    res.json({ findings });
  } catch (err) {
    req.log.error({ err }, "GET /api/portal/code-secrets error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// POST /api/portal/code-secrets/:id/revoked — Revoke edildi olarak işaretle
router.post("/api/portal/code-secrets/:id/revoked", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }
  const id = Number(req.params["id"]);
  try {
    const [finding] = await db.select({ id: codeSecretsFindingsTable.id })
      .from(codeSecretsFindingsTable)
      .where(and(eq(codeSecretsFindingsTable.id, id), eq(codeSecretsFindingsTable.customerId, customerId)))
      .limit(1);
    if (!finding) { res.status(404).json({ error: "Bulunamadı" }); return; }

    await db.update(codeSecretsFindingsTable)
      .set({ isRevoked: true })
      .where(eq(codeSecretsFindingsTable.id, id));

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "POST /api/portal/code-secrets/:id/revoked error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// POST /api/portal/github-org — GitHub org kaydet
router.post("/api/portal/github-org", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }
  const { githubOrg } = req.body as { githubOrg: string };
  if (!githubOrg) { res.status(400).json({ error: "GitHub org/kullanıcı adı zorunlu" }); return; }

  try {
    const resp = await fetch(`https://api.github.com/users/${githubOrg}`, {
      headers: { "User-Agent": "CyberStep/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) { res.status(400).json({ error: "GitHub organizasyonu/kullanıcısı bulunamadı." }); return; }

    await db.update(customersTable)
      .set({ githubOrg })
      .where(eq(customersTable.id, customerId));

    res.json({ ok: true, message: "GitHub organizasyonu kaydedildi. İlk tarama bu Pazar yapılacak." });
  } catch (err) {
    req.log.error({ err }, "POST /api/portal/github-org error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;
