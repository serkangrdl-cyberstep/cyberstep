import dns from "dns/promises";
import net from "net";
import { db } from "@workspace/db";
import {
  verificationScanQueueTable,
  remediationTicketsTable,
  remediationCommentsTable,
  customersTable,
} from "@workspace/db";
import { eq, and, lte } from "drizzle-orm";
import { logger } from "../lib/logger";

type VerificationItem = typeof verificationScanQueueTable.$inferSelect;

async function checkDMARCExists(domain: string): Promise<boolean> {
  try {
    const records = await dns.resolveTxt(`_dmarc.${domain}`);
    return records.some(r => r.join("").startsWith("v=DMARC1"));
  } catch {
    return false;
  }
}

async function checkSPFExists(domain: string): Promise<boolean> {
  try {
    const records = await dns.resolveTxt(domain);
    return records.some(r => r.join("").startsWith("v=spf1"));
  } catch {
    return false;
  }
}

async function checkSSLValid(domain: string): Promise<boolean> {
  return new Promise(resolve => {
    const options = { host: domain, port: 443, servername: domain, rejectUnauthorized: true };
    const socket = require("tls").connect(options, () => {
      const cert = socket.getPeerCertificate();
      const valid = cert && cert.valid_to && new Date(cert.valid_to) > new Date();
      socket.destroy();
      resolve(valid as boolean);
    });
    socket.on("error", () => resolve(false));
    socket.setTimeout(5000, () => { socket.destroy(); resolve(false); });
  });
}

async function checkPortClosed(domain: string, port: number): Promise<boolean> {
  return new Promise(resolve => {
    const socket = new net.Socket();
    socket.setTimeout(4000);
    socket.connect(port, domain, () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => resolve(true));
    socket.on("timeout", () => { socket.destroy(); resolve(true); });
  });
}

async function runVerificationCheck(item: VerificationItem): Promise<{ fixed: boolean }> {
  const findingType = item.findingType ?? "";
  const domain = item.domain ?? "";

  const checks: Record<string, () => Promise<boolean>> = {
    no_dmarc:      () => checkDMARCExists(domain),
    no_spf:        () => checkSPFExists(domain),
    ssl_expired:   () => checkSSLValid(domain),
    open_rdp_port: () => checkPortClosed(domain, 3389),
    open_ssh_port: () => checkPortClosed(domain, 22),
  };

  const fn = checks[findingType];
  if (fn) {
    try {
      return { fixed: await fn() };
    } catch {
      return { fixed: false };
    }
  }

  // Spesifik kontrol yoksa — manuel inceleme gerekiyor, fixed değil say
  return { fixed: false };
}

async function closeTicketAsFixed(ticketId: number): Promise<void> {
  await db.update(remediationTicketsTable).set({
    status: "verified_fixed",
    verifiedAt: new Date(),
    verifiedBy: "auto",
    closedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(remediationTicketsTable.id, ticketId));

  await db.insert(remediationCommentsTable).values({
    ticketId,
    authorType: "auto",
    authorName: "CyberStep Doğrulama",
    comment: `Otomatik doğrulama taraması: Bulgu giderildi. Ticket kapatıldı. (${new Date().toLocaleDateString("tr-TR")})`,
    isInternal: false,
  });
}

export async function processVerificationQueue(): Promise<void> {
  const now = new Date();

  const due = await db.select()
    .from(verificationScanQueueTable)
    .where(
      and(
        eq(verificationScanQueueTable.status, "pending"),
        lte(verificationScanQueueTable.scheduledAt, now),
      )
    );

  if (due.length === 0) return;

  logger.info({ count: due.length }, "Processing verification queue");

  for (const item of due) {
    const result = await runVerificationCheck(item);

    await db.update(verificationScanQueueTable).set({
      executedAt: new Date(),
      scanResult: result.fixed ? "fixed" : "still_present",
      status: "completed",
    }).where(eq(verificationScanQueueTable.id, item.id));

    if (result.fixed) {
      await closeTicketAsFixed(item.ticketId!);
    } else {
      await db.update(remediationTicketsTable).set({
        status: "open",
        updatedAt: new Date(),
      }).where(eq(remediationTicketsTable.id, item.ticketId!));

      await db.insert(remediationCommentsTable).values({
        ticketId: item.ticketId!,
        authorType: "auto",
        authorName: "CyberStep Doğrulama",
        comment: `Otomatik doğrulama taraması: Açık hala mevcut. (${new Date().toLocaleDateString("tr-TR")})`,
        isInternal: false,
      });
    }
  }
}

export async function scheduleVerificationScan(ticketId: number, delayHours = 4): Promise<void> {
  const [ticket] = await db.select()
    .from(remediationTicketsTable)
    .where(eq(remediationTicketsTable.id, ticketId))
    .limit(1);

  if (!ticket) return;

  await db.insert(verificationScanQueueTable).values({
    ticketId,
    customerId: ticket.customerId,
    domain: ticket.affectedAsset,
    findingType: ticket.findingType,
    scheduledAt: new Date(Date.now() + delayHours * 3600 * 1000),
    status: "pending",
  });

  await db.update(remediationTicketsTable).set({
    status: "pending_verification",
    updatedAt: new Date(),
  }).where(eq(remediationTicketsTable.id, ticketId));
}

export async function checkRemediationSLABreaches(): Promise<void> {
  const now = new Date();
  const open = await db.select()
    .from(remediationTicketsTable)
    .where(and(
      eq(remediationTicketsTable.slaBreached, false),
    ));

  for (const ticket of open) {
    if (!ticket.slaDeadline) continue;
    if (["verified_fixed", "closed", "false_positive", "wont_fix"].includes(ticket.status ?? "")) continue;
    if (ticket.slaDeadline <= now) {
      await db.update(remediationTicketsTable).set({
        slaBreached: true,
        updatedAt: new Date(),
      }).where(eq(remediationTicketsTable.id, ticket.id));
    }
  }
}
