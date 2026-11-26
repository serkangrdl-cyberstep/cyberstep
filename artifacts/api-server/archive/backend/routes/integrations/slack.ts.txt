import { Router } from "express";
import { z } from "zod/v4";
import { pool } from "@workspace/db";
import { requireCustomer, getCustomerId } from "../../middleware/auth";
import { logger } from "../../lib/logger";

const router = Router();

const SLACK_CLIENT_ID = process.env["SLACK_CLIENT_ID"] ?? "";
const SLACK_CLIENT_SECRET = process.env["SLACK_CLIENT_SECRET"] ?? "";
const SLACK_REDIRECT_URI = process.env["SLACK_REDIRECT_URI"] ?? "https://cyberstep.io/api/integrations/slack/callback";

const ALL_EVENTS = ["soc.case.opened", "soc.case.closed", "soc.case.critical", "soc.sla.breached", "scan.completed"];

// GET /api/integrations/slack — müşterinin Slack konfigürasyonu
router.get("/integrations/slack", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  try {
    const result = await pool.query(
      `SELECT id, team_id, team_name, channel_id, channel_name, bot_user_id, events, active, created_at
       FROM slack_integrations WHERE customer_id = $1`,
      [customerId]
    );
    res.json({ config: result.rows[0] ?? null });
  } catch (err) {
    logger.error({ err }, "Failed to get Slack config");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// GET /api/integrations/slack/oauth — OAuth akışını başlat
router.get("/integrations/slack/oauth", requireCustomer, (req, res) => {
  if (!SLACK_CLIENT_ID) {
    res.status(503).json({ error: "Slack entegrasyonu henüz yapılandırılmamış" });
    return;
  }
  const state = `${getCustomerId(req)}_${Date.now()}`;
  const params = new URLSearchParams({
    client_id: SLACK_CLIENT_ID,
    scope: "incoming-webhook,chat:write",
    redirect_uri: SLACK_REDIRECT_URI,
    state,
  });
  res.json({ url: `https://slack.com/oauth/v2/authorize?${params.toString()}` });
});

// GET /api/integrations/slack/callback — OAuth callback
router.get("/integrations/slack/callback", async (req, res) => {
  const { code, state, error: oauthError } = req.query as Record<string, string>;

  if (oauthError) {
    res.redirect(`/hesabim/entegrasyonlarim?slack=denied`);
    return;
  }

  if (!code || !state) {
    res.redirect(`/hesabim/entegrasyonlarim?slack=error`);
    return;
  }

  const customerId = parseInt(state.split("_")[0]!, 10);
  if (!customerId || isNaN(customerId)) {
    res.redirect(`/hesabim/entegrasyonlarim?slack=error`);
    return;
  }

  try {
    const tokenRes = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: SLACK_CLIENT_ID,
        client_secret: SLACK_CLIENT_SECRET,
        code,
        redirect_uri: SLACK_REDIRECT_URI,
      }),
    });

    const tokenData = await tokenRes.json() as Record<string, unknown>;

    if (!tokenData["ok"]) {
      logger.warn({ tokenData }, "Slack OAuth token exchange failed");
      res.redirect(`/hesabim/entegrasyonlarim?slack=error`);
      return;
    }

    const teamId = String((tokenData["team"] as Record<string, unknown>)?.["id"] ?? "");
    const teamName = String((tokenData["team"] as Record<string, unknown>)?.["name"] ?? "");
    const channelId = String((tokenData["incoming_webhook"] as Record<string, unknown>)?.["channel_id"] ?? "");
    const channelName = String((tokenData["incoming_webhook"] as Record<string, unknown>)?.["channel"] ?? "");
    const accessToken = String(tokenData["access_token"] ?? "");
    const botUserId = String((tokenData["bot_user_id"]) ?? "");

    await pool.query(
      `INSERT INTO slack_integrations (customer_id, team_id, team_name, channel_id, channel_name, access_token, bot_user_id, events, active, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, now())
       ON CONFLICT (customer_id) DO UPDATE SET
         team_id = EXCLUDED.team_id, team_name = EXCLUDED.team_name,
         channel_id = EXCLUDED.channel_id, channel_name = EXCLUDED.channel_name,
         access_token = EXCLUDED.access_token, bot_user_id = EXCLUDED.bot_user_id,
         active = true, updated_at = now()`,
      [customerId, teamId, teamName, channelId, channelName, accessToken, botUserId, ALL_EVENTS]
    );

    logger.info({ customerId, teamName }, "Slack integration connected");
    res.redirect(`/hesabim/entegrasyonlarim?slack=connected`);
  } catch (err) {
    logger.error({ err }, "Slack OAuth callback failed");
    res.redirect(`/hesabim/entegrasyonlarim?slack=error`);
  }
});

// DELETE /api/integrations/slack — bağlantıyı kes
router.delete("/integrations/slack", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  try {
    await pool.query("DELETE FROM slack_integrations WHERE customer_id = $1", [customerId]);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to delete Slack integration");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// POST /api/integrations/slack/test — test mesajı gönder
router.post("/integrations/slack/test", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  try {
    const result = await pool.query(
      "SELECT access_token, channel_id FROM slack_integrations WHERE customer_id = $1 AND active = true",
      [customerId]
    );
    const cfg = result.rows[0] as { access_token: string; channel_id: string } | undefined;
    if (!cfg) {
      res.status(404).json({ error: "Slack bağlantısı bulunamadı" });
      return;
    }

    const r = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.access_token}` },
      body: JSON.stringify({
        channel: cfg.channel_id,
        text: "✅ CyberStep.io Slack entegrasyonu başarıyla test edildi!",
      }),
    });
    const data = await r.json() as { ok: boolean; error?: string };
    if (!data.ok) {
      res.status(400).json({ error: data.error ?? "Slack API hatası" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Slack test failed");
    res.status(500).json({ error: "Test mesajı gönderilemedi" });
  }
});

// PATCH /api/integrations/slack/events — olay tercihlerini güncelle
router.patch("/integrations/slack/events", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  const { events } = z.object({ events: z.array(z.string()).min(1) }).parse(req.body);
  try {
    await pool.query(
      "UPDATE slack_integrations SET events = $2, updated_at = now() WHERE customer_id = $1",
      [customerId, events]
    );
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to update Slack events");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;
