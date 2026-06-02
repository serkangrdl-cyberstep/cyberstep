---
name: Write-after-send reminder pattern
description: Cron-based email reminders must mark sentAt AFTER successful send, not before; use atomic conditional update to prevent duplicates.
---

## Rule
For any cron that sends emails and then marks a DB flag (`reminder*SentAt`, `alertedAt`, etc.):
1. **Send email first** — do not write the flag before the SMTP call
2. **Write flag after** — only on successful send
3. **Atomic conditional update** — `WHERE flagColumn IS NULL` to guard against overlapping cron runs

## Why
If the flag is written first and SMTP throws (misconfiguration, network error, rate limit), the row is permanently marked "sent" and the email is never delivered on subsequent cron runs. Code review will reject "write-first" patterns as violating guaranteed delivery.

## How to apply
```ts
// WRONG: flag written before send
await db.update(t).set({ reminderSentAt: new Date() }).where(eq(t.id, sub.id));
await sendMail(...); // if this throws, reminder is skipped forever

// CORRECT: send first, then conditional atomic update
await sendMail(...); // throws on failure → cron retries next run
const { rowCount } = await db.update(t)
  .set({ reminderSentAt: new Date() })
  .where(and(eq(t.id, sub.id), isNull(t.reminderSentAt)));
if (rowCount === 0) logger.warn({ id: sub.id }, "Already marked, duplicate prevented");
```
This pattern applies to: subscription reminders, SLA breach emails, connection alert emails, onboarding D+3/D+7 emails.
