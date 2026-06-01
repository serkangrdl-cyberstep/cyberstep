import cron from "node-cron";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { checkAndSaveDnsChanges, type DnsChange, type DnsSnapshot, formatDnsValue } from "./dnsResolver";
import { sendMail } from "./email";

const TZ = { timezone: "Europe/Istanbul" } as const;

interface WatchedDomainRow {
  id: number;
  customer_id: number;
  domain: string;
  customer_email: string | null;
  [key: string]: unknown;
}

async function createSocCase(customerId: number, domain: string, change: DnsChange): Promise<number | null> {
  try {
    const title = `DNS Değişikliği: ${domain} — ${change.recordType} kaydı`;
    const description = `${change.recordType} kaydında değişiklik tespit edildi.\n\nEski: ${formatDnsValue(change.recordType, change.oldValues)}\nYeni: ${formatDnsValue(change.recordType, change.newValues)}`;

    const result = await db.execute<{ id: number }>(sql`
      INSERT INTO soc_cases (customer_id, title, description, severity, status, source, category, auto_closed)
      VALUES (
        ${customerId}, ${title}, ${description}, ${change.severity},
        'open', 'dns-monitor', 'dns-change', false
      )
      RETURNING id
    `);
    const rows = (result as unknown as { rows: { id: number }[] }).rows;
    return rows?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function sendDnsChangeAlert(to: string, domain: string, changes: DnsChange[], _snapshot: DnsSnapshot): Promise<void> {
  const SEV_LABEL: Record<string, string> = {
    critical: "Kritik", high: "Yüksek", medium: "Orta", low: "Dusuk",
  };

  const rows = changes.map(c => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#0f172a">${c.recordType}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:12px;font-family:monospace">${formatDnsValue(c.recordType, c.oldValues)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#059669;font-size:12px;font-family:monospace">${formatDnsValue(c.recordType, c.newValues)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0">
        <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;background:${c.severity === "critical" ? "#fef2f2" : c.severity === "high" ? "#fff7ed" : "#fffbeb"};color:${c.severity === "critical" ? "#dc2626" : c.severity === "high" ? "#ea580c" : "#ca8a04"}">${SEV_LABEL[c.severity] ?? c.severity}</span>
      </td>
    </tr>
  `).join("");

  await sendMail({
    to,
    subject: `DNS Degisikligi Uyarisi: ${domain} (${changes.length} kayit)`,
    html: `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif">
  <div style="max-width:640px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <div style="background:#0f172a;padding:24px 32px">
      <span style="font-size:22px;font-weight:700;color:#fff">CyberStep.io</span>
    </div>
    <div style="padding:32px">
      <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:14px 18px;border-radius:0 8px 8px 0;margin-bottom:24px">
        <p style="margin:0;font-size:15px;font-weight:700;color:#dc2626">DNS Degisikligi Tespit Edildi</p>
        <p style="margin:4px 0 0;font-size:13px;color:#64748b">${domain} icin ${changes.length} kayit guncellendi.</p>
      </div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:24px">
        <thead>
          <tr style="background:#f8fafc">
            <th style="padding:10px 14px;text-align:left;font-size:12px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0">Kayit Turu</th>
            <th style="padding:10px 14px;text-align:left;font-size:12px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0">Onceki Deger</th>
            <th style="padding:10px 14px;text-align:left;font-size:12px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0">Yeni Deger</th>
            <th style="padding:10px 14px;text-align:left;font-size:12px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0">Onem</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="font-size:13px;color:#64748b;margin:0 0 8px">NS veya MX degisiklikleri yetkisiz transfer veya mail yonlendirmesine isaret edebilir. Lutfen derhal kontrol edin.</p>
    </div>
  </div>
</body></html>`,
  });
}

export function startDnsCrons(): void {
  cron.schedule("*/5 * * * *", async () => {
    try {
      const result = await db.execute<WatchedDomainRow>(sql`
        SELECT d.id, d.customer_id, d.domain, c.email AS customer_email
        FROM dns_watched_domains d
        JOIN customers c ON c.id = d.customer_id
        WHERE d.is_active = true
        ORDER BY COALESCE(d.last_checked_at, '1970-01-01') ASC
        LIMIT 50
      `);
      const rows = (result as unknown as { rows: WatchedDomainRow[] }).rows ?? [];

      for (const row of rows) {
        await checkAndSaveDnsChanges({
          customerId: row.customer_id,
          domain: row.domain,
          watchedDomainId: row.id,
          customerEmail: row.customer_email ?? "",
          onChanges: async (changes, snapshot) => {
            if (row.customer_email) {
              await sendDnsChangeAlert(row.customer_email, row.domain, changes, snapshot);
            }
          },
          onSocCase: createSocCase,
        });
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (err) {
      logger.error({ err }, "DNS monitor cron failed");
    }
  }, TZ);

  logger.info("DNS monitor cron scheduled (every 5 min)");
}
