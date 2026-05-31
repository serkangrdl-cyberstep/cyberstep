/**
 * Pluggable SOC notifier.
 *
 * Email is implemented via the existing nodemailer `sendMail`. Other channels
 * (WhatsApp, Slack, SMS) are stubbed: requested-but-unconnected channels are
 * logged, never silently dropped, so they can be wired in later without
 * touching call sites.
 */

import { sendMail } from "../email";
import { logger } from "../../lib/logger";
import { getCustomerEmail } from "./soc-cases";

export type NotifyChannel = "email" | "whatsapp" | "slack" | "sms";

export interface NotifyPayload {
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  narrative?: string;
  recommendedAction?: string;
  caseNumber?: string;
  suspectIps?: string[];
  toEmailOverride?: string;
}

type ChannelHandler = (customerId: number, caseId: number, payload: NotifyPayload) => Promise<{ ok: boolean; message: string }>;

const SEV_LABEL: Record<string, string> = { critical: "Kritik", high: "Yüksek", medium: "Orta", low: "Düşük" };
const SEV_COLOR: Record<string, string> = { critical: "#dc2626", high: "#ea580c", medium: "#d97706", low: "#16a34a" };

function buildEmailHtml(payload: NotifyPayload): string {
  const color = SEV_COLOR[payload.severity] ?? "#d97706";
  const label = SEV_LABEL[payload.severity] ?? payload.severity;
  return `
<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"></head>
<body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
    <div style="background:#0f172a;padding:24px 32px">
      <span style="font-size:22px;font-weight:700;color:#fff">CyberStep.io</span>
      <span style="background:${color};color:#fff;font-size:12px;padding:4px 10px;border-radius:20px;margin-left:12px">${label} · SOC</span>
    </div>
    <div style="padding:32px">
      ${payload.caseNumber ? `<p style="margin:0 0 6px;font-size:12px;color:#94a3b8;letter-spacing:.5px">VAKA ${payload.caseNumber}</p>` : ""}
      <h2 style="margin:0 0 8px;font-size:19px;color:#0f172a">${payload.title}</h2>
      ${payload.narrative ? `<p style="margin:0 0 20px;color:#334155;font-size:14px;line-height:1.7">${payload.narrative}</p>` : ""}
      ${payload.recommendedAction ? `<div style="background:#fef2f2;border-left:4px solid ${color};padding:14px 18px;border-radius:0 8px 8px 0;margin-bottom:16px">
        <p style="margin:0;font-size:13px;color:#991b1b"><strong>Önerilen Aksiyon:</strong> ${payload.recommendedAction}</p></div>` : ""}
      ${payload.suspectIps?.length ? `<p style="margin:0;font-size:13px;color:#64748b">Şüpheli IP'ler: ${payload.suspectIps.join(", ")}</p>` : ""}
    </div>
    <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0">
      <p style="margin:0;color:#94a3b8;font-size:11px;text-align:center">CyberStep.io · AI Destekli SOC</p>
    </div>
  </div>
</body></html>`;
}

const emailHandler: ChannelHandler = async (customerId, _caseId, payload) => {
  const to = payload.toEmailOverride ?? (await getCustomerEmail(customerId));
  if (!to) return { ok: false, message: "Müşteri e-posta adresi bulunamadı" };
  const label = SEV_LABEL[payload.severity] ?? payload.severity;
  try {
    await sendMail({
      to,
      subject: `[CyberStep SOC] ${label} · ${payload.title}`,
      html: buildEmailHtml(payload),
    });
    return { ok: true, message: `E-posta gönderildi: ${to}` };
  } catch (err) {
    logger.error({ err, customerId }, "SOC email notification failed");
    return { ok: false, message: String(err) };
  }
};

// Stubbed channels — log the intent so it is visible, but do not pretend to send.
function makeStub(channel: NotifyChannel): ChannelHandler {
  return async (customerId, caseId, payload) => {
    logger.info({ channel, customerId, caseId, title: payload.title, severity: payload.severity }, `SOC notification channel '${channel}' not connected — logged only`);
    return { ok: false, message: `${channel} kanalı henüz bağlı değil (kaydedildi)` };
  };
}

const HANDLERS: Record<NotifyChannel, ChannelHandler> = {
  email: emailHandler,
  whatsapp: makeStub("whatsapp"),
  slack: makeStub("slack"),
  sms: makeStub("sms"),
};

export async function sendSOCNotification(
  customerId: number,
  caseId: number,
  payload: NotifyPayload,
  channels: NotifyChannel[] = ["email"],
): Promise<Array<{ channel: NotifyChannel; ok: boolean; message: string }>> {
  const results: Array<{ channel: NotifyChannel; ok: boolean; message: string }> = [];
  for (const channel of channels) {
    const handler = HANDLERS[channel];
    if (!handler) {
      results.push({ channel, ok: false, message: "Bilinmeyen kanal" });
      continue;
    }
    const r = await handler(customerId, caseId, payload);
    results.push({ channel, ...r });
  }
  return results;
}
