import { Router } from "express";
import { z } from "zod/v4";
import { pool } from "@workspace/db";
import { requireCustomer, getCustomerId } from "../../middleware/auth";
import { encryptSecret } from "../../services/fabric-crypto";
import { testTelegramConfig, getTelegramBotInfo, type TelegramEvent } from "../../services/telegramNotifier";

const router = Router();

const ALL_EVENTS: TelegramEvent[] = [
  "soc.case.opened", "soc.case.closed", "soc.case.critical", "soc.sla.breached", "scan.completed",
];

const VALID_TELEGRAM_EVENTS = z.enum([
  "soc.case.opened", "soc.case.closed", "soc.case.critical", "soc.sla.breached", "scan.completed",
]);

const telegramCreateSchema = z.object({
  botToken: z.string().min(20).max(200).regex(/^\d+:[A-Za-z0-9_-]{35,}$/, "Geçersiz bot token formatı"),
  chatId: z.string().min(1).max(100),
  events: z.array(VALID_TELEGRAM_EVENTS).min(1).max(10).optional(),
});

const telegramUpdateSchema = z.object({
  botToken: z.string().min(20).max(200).regex(/^\d+:[A-Za-z0-9_-]{35,}$/, "Geçersiz bot token formatı").optional(),
  chatId: z.string().min(1).max(100).optional(),
  events: z.array(VALID_TELEGRAM_EVENTS).min(1).max(10).optional(),
  active: z.boolean().optional(),
});

const telegramTestSchema = z.object({
  botToken: z.string().min(20).max(200).optional(),
  chatId: z.string().min(1).max(100).optional(),
});

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

  const parsed = telegramCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Geçersiz istek", details: z.treeifyError(parsed.error) });
    return;
  }
  const { botToken, chatId, events } = parsed.data;

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

  const parsed = telegramUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Geçersiz istek", details: z.treeifyError(parsed.error) });
    return;
  }
  const { botToken, chatId, events, active } = parsed.data;

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

  const parsed = telegramTestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Geçersiz istek", details: z.treeifyError(parsed.error) });
    return;
  }
  const { botToken, chatId } = parsed.data;

  try {
    let token = botToken;
    let chat = chatId;

    if (!token || !chat) {
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
