import { Router } from "express";
import { pool } from "@workspace/db";
import { requireCustomer, getCustomerId } from "../../middleware/auth";
import { encryptSecret, decryptSecret } from "../../services/fabric-crypto";
import { testNetgsmConfig, type NetgsmEvent } from "../../services/netgsmNotifier";

const router = Router();

const ALL_EVENTS: NetgsmEvent[] = [
  "soc.case.opened", "soc.case.closed", "soc.case.critical", "soc.sla.breached",
];

// ─── GET /api/integrations/netgsm ────────────────────────────────────────────
router.get("/integrations/netgsm", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }
  try {
    const { rows } = await pool.query(
      `SELECT id, header, phone_numbers AS "phoneNumbers", active, events,
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM netgsm_configs WHERE customer_id = $1 LIMIT 1`,
      [customerId],
    );
    res.json({ config: rows[0] ?? null });
  } catch (err) {
    req.log.error({ err }, "GET /api/integrations/netgsm error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── POST /api/integrations/netgsm ───────────────────────────────────────────
router.post("/integrations/netgsm", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

  const { username, password, header, phoneNumbers, events } = req.body as {
    username: string; password: string; header?: string;
    phoneNumbers: string[]; events?: NetgsmEvent[];
  };

  if (!username || !password || !phoneNumbers?.length) {
    res.status(400).json({ error: "username, password ve en az 1 telefon numarası zorunludur" }); return;
  }

  const usernameEnc = encryptSecret(username);
  const passwordEnc = encryptSecret(password);
  if (!usernameEnc || !passwordEnc) { res.status(500).json({ error: "Şifreleme hatası" }); return; }

  const selectedEvents = events?.length ? events : ["soc.case.critical", "soc.sla.breached"] as NetgsmEvent[];
  const msgHeader = (header ?? "CYBERSTEP").slice(0, 11);

  try {
    const { rows } = await pool.query(
      `INSERT INTO netgsm_configs (customer_id, username_enc, password_enc, header, phone_numbers, events)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (customer_id) DO UPDATE
         SET username_enc  = EXCLUDED.username_enc,
             password_enc  = EXCLUDED.password_enc,
             header        = EXCLUDED.header,
             phone_numbers = EXCLUDED.phone_numbers,
             events        = EXCLUDED.events,
             active        = true,
             updated_at    = NOW()
       RETURNING id, header, phone_numbers AS "phoneNumbers", active, events, created_at AS "createdAt"`,
      [customerId, usernameEnc, passwordEnc, msgHeader, phoneNumbers, selectedEvents],
    );
    res.json({ config: rows[0] });
  } catch (err) {
    req.log.error({ err }, "POST /api/integrations/netgsm error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── PUT /api/integrations/netgsm ────────────────────────────────────────────
router.put("/integrations/netgsm", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

  const { username, password, header, phoneNumbers, events, active } = req.body as {
    username?: string; password?: string; header?: string;
    phoneNumbers?: string[]; events?: NetgsmEvent[]; active?: boolean;
  };

  try {
    const usernameEnc = username ? encryptSecret(username) : undefined;
    const passwordEnc = password ? encryptSecret(password) : undefined;
    const { rowCount } = await pool.query(
      `UPDATE netgsm_configs
       SET username_enc  = CASE WHEN $1::TEXT IS NOT NULL THEN $1 ELSE username_enc END,
           password_enc  = CASE WHEN $2::TEXT IS NOT NULL THEN $2 ELSE password_enc END,
           header        = COALESCE($3, header),
           phone_numbers = COALESCE($4, phone_numbers),
           events        = COALESCE($5, events),
           active        = COALESCE($6, active),
           updated_at    = NOW()
       WHERE customer_id = $7`,
      [usernameEnc ?? null, passwordEnc ?? null, header ?? null, phoneNumbers ?? null, events ?? null, active ?? null, customerId],
    );
    if (!rowCount) { res.status(404).json({ error: "Yapılandırma bulunamadı" }); return; }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "PUT /api/integrations/netgsm error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── DELETE /api/integrations/netgsm ─────────────────────────────────────────
router.delete("/integrations/netgsm", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }
  try {
    await pool.query(`DELETE FROM netgsm_configs WHERE customer_id = $1`, [customerId]);
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "DELETE /api/integrations/netgsm error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── POST /api/integrations/netgsm/test ──────────────────────────────────────
router.post("/integrations/netgsm/test", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

  const { username, password, header, testPhone } = req.body as {
    username?: string; password?: string; header?: string; testPhone?: string;
  };

  try {
    let uname = username;
    let pass = password;
    let hdr = header ?? "CYBERSTEP";
    let phone = testPhone;

    if (!uname || !pass || !phone) {
      const { rows } = await pool.query(
        `SELECT username_enc, password_enc, header, phone_numbers FROM netgsm_configs WHERE customer_id = $1 LIMIT 1`,
        [customerId],
      );
      if (!rows[0]) { res.status(404).json({ error: "Yapılandırma bulunamadı" }); return; }
      uname = uname ?? (decryptSecret(rows[0].username_enc as string) ?? "");
      pass = pass ?? (decryptSecret(rows[0].password_enc as string) ?? "");
      hdr = hdr ?? (rows[0].header as string);
      phone = phone ?? ((rows[0].phone_numbers as string[])[0] ?? "");
    }

    if (!uname || !pass || !phone) {
      res.status(400).json({ error: "username, password ve testPhone gerekli" }); return;
    }

    const result = await testNetgsmConfig(uname, pass, hdr, phone);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "NetGSM test error");
    res.status(500).json({ error: `Test başarısız: ${(err as Error).message}` });
  }
});

export default router;
