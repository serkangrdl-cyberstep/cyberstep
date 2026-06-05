/**
 * HITL Approval Queue — İnsan Onay Mekanizması
 */

import { db } from "@workspace/db";
import {
  pendingApprovalsTable,
  approvalAuditLogTable,
} from "@workspace/db";
import { eq, and, lte } from "drizzle-orm";
import { logger } from "../lib/logger";
async function sendAdminTelegram(message: string): Promise<void> {
  const token  = process.env["ADMIN_TELEGRAM_BOT_TOKEN"];
  const chatId = process.env["ADMIN_TELEGRAM_CHAT_ID"];
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    });
  } catch (err) {
    logger.warn({ err }, "Admin Telegram notify failed");
  }
}

function addHours(d: Date, h: number): Date {
  return new Date(d.getTime() + h * 3_600_000);
}

// ─── Kuyruğa ekle ─────────────────────────────────────────────────────────────

export async function queueForApproval(params: {
  actionType: string;
  title: string;
  description: string;
  riskLevel: "critical" | "high" | "medium" | "low";
  payload: Record<string, unknown>;
  customerId?: number;
  relatedId?: number;
  expiresInHours: number;
  onExpire: "auto_approve" | "auto_reject" | "escalate";
}): Promise<number> {
  const expiresAt = addHours(new Date(), params.expiresInHours);

  const [approval] = await db.insert(pendingApprovalsTable).values({
    actionType:  params.actionType,
    title:       params.title,
    description: params.description,
    riskLevel:   params.riskLevel,
    payload:     params.payload,
    customerId:  params.customerId,
    relatedId:   params.relatedId,
    expiresAt,
    onExpire:    params.onExpire,
    status:      "pending",
  }).returning();

  await db.insert(approvalAuditLogTable).values({
    approvalId:  approval.id,
    action:      "created",
    performedBy: "system",
    notes:       params.description,
  });

  if (params.riskLevel === "critical") {
    const baseUrl = process.env["BASE_URL"] || "";
    await sendAdminTelegram(
      `⚠️ Onay Gerekiyor: ${params.title}\nRisk: KRİTİK\nSüre: ${params.expiresInHours} saat\n${baseUrl}/panel/approvals/${approval.id}`,
    );
  }

  logger.info({ approvalId: approval.id, actionType: params.actionType }, "Approval kuyruğuna eklendi");
  return approval.id;
}

// ─── Onayla ───────────────────────────────────────────────────────────────────

export async function approveAction(approvalId: number, approvedBy: string): Promise<void> {
  const [approval] = await db.select().from(pendingApprovalsTable)
    .where(and(eq(pendingApprovalsTable.id, approvalId), eq(pendingApprovalsTable.status, "pending")))
    .limit(1);

  if (!approval) throw new Error("Onay bulunamadı veya zaten işlendi");

  await db.update(pendingApprovalsTable).set({
    status:     "approved",
    approvedBy,
    approvedAt: new Date(),
  }).where(eq(pendingApprovalsTable.id, approvalId));

  await db.insert(approvalAuditLogTable).values({
    approvalId, action: "approved", performedBy: approvedBy,
  });

  await executeApprovedAction(approval);
}

// ─── Reddet ───────────────────────────────────────────────────────────────────

export async function rejectAction(
  approvalId: number,
  rejectedBy: string,
  reason: string,
): Promise<void> {
  await db.update(pendingApprovalsTable).set({
    status:          "rejected",
    approvedBy:      rejectedBy,
    approvedAt:      new Date(),
    rejectionReason: reason,
  }).where(eq(pendingApprovalsTable.id, approvalId));

  await db.insert(approvalAuditLogTable).values({
    approvalId, action: "rejected", performedBy: rejectedBy, notes: reason,
  });
}

// ─── Expire kontrolü (cron) ───────────────────────────────────────────────────

export async function processExpiredApprovals(): Promise<void> {
  const expired = await db.select().from(pendingApprovalsTable)
    .where(and(eq(pendingApprovalsTable.status, "pending"), lte(pendingApprovalsTable.expiresAt, new Date())));

  for (const approval of expired) {
    switch (approval.onExpire) {
      case "auto_approve":
        await db.update(pendingApprovalsTable).set({
          status: "approved", approvedBy: "auto_expire", approvedAt: new Date(),
        }).where(eq(pendingApprovalsTable.id, approval.id));
        await db.insert(approvalAuditLogTable).values({
          approvalId: approval.id, action: "expired", performedBy: "system",
          notes: "Süre doldu → otomatik onaylandı",
        });
        await executeApprovedAction(approval);
        break;

      case "auto_reject":
        await db.update(pendingApprovalsTable).set({
          status: "rejected", approvedBy: "auto_expire", approvedAt: new Date(),
          rejectionReason: "Süre doldu → otomatik reddedildi",
        }).where(eq(pendingApprovalsTable.id, approval.id));
        await db.insert(approvalAuditLogTable).values({
          approvalId: approval.id, action: "expired", performedBy: "system",
          notes: "Süre doldu → otomatik reddedildi",
        });
        break;

      case "escalate": {
        const baseUrl = process.env["BASE_URL"] || "";
        await sendAdminTelegram(
          `🚨 ACİL: Onay süresi doldu!\n${approval.title}\nHemen karar ver: ${baseUrl}/panel/approvals/${approval.id}`,
        );
        break;
      }
    }
  }

  if (expired.length > 0) {
    logger.info({ count: expired.length }, "Expire olan onaylar işlendi");
  }
}

// ─── Aksiyonu çalıştır ────────────────────────────────────────────────────────

async function executeApprovedAction(
  approval: typeof pendingApprovalsTable.$inferSelect,
): Promise<void> {
  try {
    const payload = approval.payload as Record<string, unknown>;

    switch (approval.actionType) {
      case "fortinet_block": {
        logger.info({ ip: payload["ip"], customerId: payload["customerId"] },
          "FortiGate IOC blok onaylandı");
        break;
      }

      case "board_report_send": {
        const { generateBoardReport } = await import("./ciso/boardReportGenerator");
        await generateBoardReport(payload["customerId"] as number);
        break;
      }

      case "zero_day_alert": {
        const { notifyAffectedDomains } = await import("./cve/cveNotifier");
        await notifyAffectedDomains(payload["cveId"] as string);
        break;
      }

      case "dunning_suspend": {
        logger.info({ customerId: payload["customerId"] }, "Dunning suspend onaylandı — implement edilmemiş");
        break;
      }

      case "index_report_publish": {
        logger.info({ reportId: payload["reportId"] }, "Index report yayını onaylandı");
        break;
      }

      default:
        logger.info({ actionType: approval.actionType }, "Bilinmeyen aksiyon tipi — atlandı");
    }

    await db.update(pendingApprovalsTable).set({
      executed: true, executedAt: new Date(),
    }).where(eq(pendingApprovalsTable.id, approval.id));

    await db.insert(approvalAuditLogTable).values({
      approvalId: approval.id, action: "executed", performedBy: "system",
    });

  } catch (err) {
    logger.error({ err, approvalId: approval.id }, "Approval execution hatası");
    await db.insert(approvalAuditLogTable).values({
      approvalId: approval.id, action: "execution_failed",
      performedBy: "system", notes: String(err),
    });
    await sendAdminTelegram(`❌ Aksiyon çalıştırılamadı: ${approval.title}\nHata: ${String(err)}`);
  }
}
