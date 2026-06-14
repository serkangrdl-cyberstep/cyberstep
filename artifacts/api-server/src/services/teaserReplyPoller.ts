import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { logger } from "../lib/logger";
import { db } from "@workspace/db";
import { prospectRepliesTable, teaserReportsTable, enterpriseProspectsTable } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";

function getImapConfig() {
  const host = process.env["ISR_IMAP_HOST"] ?? process.env["SMTP_HOST"] ?? "imap.gmail.com";
  const user = process.env["ISR_IMAP_USER"] ?? process.env["SMTP_USER"];
  const pass = process.env["ISR_IMAP_PASS"] ?? process.env["SMTP_PASS"];
  if (!user || !pass) return null;
  return { host, port: 993, secure: true, auth: { user, pass } };
}

// Returns true if this email looks like a reply to a teaser (prospect) email
function isTeaserReply(subject: string): boolean {
  return /güvenlik analizi.*cyberstep/i.test(subject);
}

// Extract domain from subject like "Re: acme.com Güvenlik Analizi — CyberStep.io"
function extractDomainFromSubject(subject: string): string | null {
  const clean = subject.replace(/^(re|fwd|yanıt|ilet):?\s*/i, "").trim();
  const match = clean.match(/^([a-z0-9][a-z0-9\-\.]+\.[a-z]{2,})\s/i);
  return match?.[1]?.toLowerCase() ?? null;
}

export async function pollTeaserReplies(): Promise<void> {
  const imapConfig = getImapConfig();
  if (!imapConfig) {
    logger.warn("Teaser reply poller: IMAP credentials not configured — skipping");
    return;
  }

  const client = new ImapFlow({
    ...imapConfig,
    logger: false,
    connectionTimeout: 12_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  });

  const timeoutHandle = setTimeout(() => {
    logger.warn("teaserReplyPoller: 45s timeout — force-closing IMAP");
    try { client.close(); } catch { /* ignore */ }
  }, 45_000);

  try {
    await client.connect();
    await client.mailboxOpen("INBOX");

    const uids = await client.search({ seen: false }, { uid: true });
    const uidList = Array.isArray(uids) ? uids : [];

    if (uidList.length === 0) {
      await client.logout();
      return;
    }

    const batch = uidList.slice(-30);
    const messages: Array<{ uid: number; source: Buffer }> = [];
    for await (const msg of client.fetch(batch.join(","), { source: true, envelope: true }, { uid: true })) {
      if (msg.source) messages.push({ uid: msg.uid, source: msg.source });
    }

    for (const msg of messages) {
      let parsed;
      try { parsed = await simpleParser(msg.source); } catch { continue; }

      const subject = parsed.subject ?? "";
      if (!isTeaserReply(subject)) continue;

      const messageId = parsed.messageId ?? `uid-${msg.uid}`;
      const fromEmail = (parsed.from?.value?.[0]?.address ?? "").toLowerCase();
      const fromName = parsed.from?.value?.[0]?.name ?? "";
      const bodyText = (parsed.text ?? "").slice(0, 8000);
      const receivedAt = parsed.date ?? new Date();

      // Idempotency: skip if already stored
      const existing = await db
        .select({ id: prospectRepliesTable.id })
        .from(prospectRepliesTable)
        .where(eq(prospectRepliesTable.messageId, messageId))
        .limit(1);
      if (existing.length > 0) continue;

      // Try to match to a prospect
      const domain = extractDomainFromSubject(subject);
      let prospectId: number | null = null;
      let teaserReportId: number | null = null;

      if (domain) {
        const [prospect] = await db
          .select({ id: enterpriseProspectsTable.id })
          .from(enterpriseProspectsTable)
          .where(sql`lower(${enterpriseProspectsTable.domain}) = ${domain}`)
          .limit(1);

        if (prospect) {
          prospectId = prospect.id;
          const [latestTeaser] = await db
            .select({ id: teaserReportsTable.id })
            .from(teaserReportsTable)
            .where(and(
              eq(teaserReportsTable.prospectId, prospect.id),
              sql`${teaserReportsTable.emailSentAt} IS NOT NULL`,
            ))
            .orderBy(desc(teaserReportsTable.emailSentAt))
            .limit(1);
          if (latestTeaser) teaserReportId = latestTeaser.id;
        }
      }

      await db.insert(prospectRepliesTable).values({
        prospectId,
        teaserReportId,
        messageId,
        fromEmail,
        fromName,
        subject,
        bodyText,
        receivedAt,
      });

      // If matched, update prospect status to interested
      if (prospectId) {
        await db.update(enterpriseProspectsTable)
          .set({ status: "interested", lastActivityAt: new Date() })
          .where(eq(enterpriseProspectsTable.id, prospectId));
        logger.info({ prospectId, domain, fromEmail }, "Teaser reply received — prospect marked interested");
      } else {
        logger.info({ fromEmail, subject }, "Teaser reply received — no matching prospect");
      }
    }

    await client.logout();
  } catch (err) {
    logger.error({ err }, "teaserReplyPoller: IMAP error");
    try { await client.logout(); } catch { /* ignore */ }
  } finally {
    clearTimeout(timeoutHandle);
  }
}
