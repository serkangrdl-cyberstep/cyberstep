import { Router } from "express";
import { pool } from "@workspace/db";
import { requireCustomer, getCustomerId } from "../../middleware/auth";
import { encryptSecret } from "../../services/fabric-crypto";
import { testTelegramConfig, getTelegramBotInfo, type TelegramEvent } from "../../services/telegramNotifier";

const router = Router();

const ALL_EVENTS: TelegramEvent[] = [
  "soc.case.opened", "soc.case.closed", "soc.case.critical", "soc.sla.breached", "scan.completed",
];

// ─── GET /api/integrations/telegram ──────────────────────────────────────────
router.get("/integrations/telegram", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }
  try {
    const { rows } = await pool.query(
      `SELECT id, chat_id AS "chatId", active, events,
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM telegram_configs WHERE customer_id = $1 LIMIT 1`,
      [customerId],
    );
    res.json({ config: rows[0] ?? null });
  } catch (err) {
    req.log.error({ err }, "GET /api/integrations/telegram error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── POST /api/integrations/telegram ─────────────────────────────────────────
router.post("/integrations/telegram", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

  const { botToken, chatId, events } = req.body as {
    botToken: string; chatId: string; events?: TelegramEvent[];
  };
  if (!botToken || !chatId) {
    res.status(400).json({ error: "botToken ve chatId zorunludur" }); return;
  }

  // Verify bot token + chat before saving
  const info = await getTelegramBotInfo(botToken);
  if (!info.ok) {
    res.status(400).json({ error: `Bot token geçersiz: ${info.message}` }); return;
  }

  const tokenEnc = encryptSecret(botToken);
  if (!tokenEnc) { res.status(500).json({ error: "Token şifrelenemedi" }); return; }

  const selectedEvents = events?.length ? events : ALL_EVENTS;

  try {
    const { rows } = await pool.query(
      `INSERT INTO telegram_configs (customer_id, bot_token_enc, chat_id, events)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (customer_id) DO UPDATE
         SET bot_token_enc = EXCLUDED.bot_token_enc,
             chat_id       = EXCLUDED.chat_id,
             events        = EXCLUDED.events,
             active        = true,
             updated_at    = NOW()
       RETURNING id, chat_id AS "chatId", active, events, created_at AS "createdAt"`,
      [customerId, tokenEnc, chatId, selectedEvents],
    );
    res.json({ config: rows[0], botUsername: info.username });
  } catch (err) {
    req.log.error({ err }, "POST /api/integrations/telegram error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── PUT /api/integrations/telegram ──────────────────────────────────────────
router.put("/integrations/telegram", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

  const { botToken, chatId, events, active } = req.body as {
    botToken?: string; chatId?: string; events?: TelegramEvent[]; active?: boolean;
  };

  try {
    const tokenEnc = botToken ? encryptSecret(botToken) : undefined;
    const { rowCount } = await pool.query(
      `UPDATE telegram_configs
       SET bot_token_enc = CASE WHEN $1::TEXT IS NOT NULL THEN $1 ELSE bot_token_enc END,
           chat_id       = COALESCE($2, chat_id),
           events        = COALESCE($3, events),
           active        = COALESCE($4, active),
           updated_at    = NOW()
       WHERE customer_id = $5`,
      [tokenEnc ?? null, chatId ?? null, events ?? null, active ?? null, customerId],
    );
    if (!rowCount) { res.status(404).json({ error: "Yapılandırma bulunamadı" }); return; }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "PUT /api/integrations/telegram error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── DELETE /api/integrations/telegram ───────────────────────────────────────
router.delete("/integrations/telegram", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }
  try {
    await pool.query(`DELETE FROM telegram_configs WHERE customer_id = $1`, [customerId]);
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "DELETE /api/integrations/telegram error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── POST /api/integrations/telegram/test ────────────────────────────────────
router.post("/integrations/telegram/test", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

  const { botToken, chatId } = req.body as { botToken?: string; chatId?: string };

  try {
    let token = botToken;
    let chat = chatId;

    if (!token || !chat) {
      // Try saved config
      const { rows } = await pool.query(
        `SELECT bot_token_enc, chat_id FROM telegram_configs WHERE customer_id = $1 LIMIT 1`,
        [customerId],
      );
      if (!rows[0]) { res.status(404).json({ error: "Yapılandırma bulunamadı" }); return; }
      const { decryptSecret } = await import("../../services/fabric-crypto");
      token = decryptSecret(rows[0].bot_token_enc as string) ?? "";
      chat = rows[0].chat_id as string;
    }

    if (!token || !chat) { res.status(400).json({ error: "botToken ve chatId gerekli" }); return; }
    const result = await testTelegramConfig(token, chat);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Telegram test error");
    res.status(500).json({ error: `Test başarısız: ${(err as Error).message}` });
  }
});

export default router;
