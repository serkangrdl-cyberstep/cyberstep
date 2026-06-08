import { pool } from "@workspace/db";
import { sendMail } from "./email";
import { logger } from "../lib/logger";

const ADMIN_EMAIL = process.env["ADMIN_EMAIL"] ?? "info@cyberstep.com";

async function ensureInvoicesTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id              SERIAL PRIMARY KEY,
      customer_id     INTEGER NOT NULL,
      subscription_id INTEGER,
      invoice_number  TEXT NOT NULL UNIQUE,
      service_label   TEXT NOT NULL,
      amount_tl       NUMERIC(10, 2) NOT NULL,
      currency        TEXT NOT NULL DEFAULT 'TRY',
      period_start    TIMESTAMP,
      period_end      TIMESTAMP,
      status          TEXT NOT NULL DEFAULT 'sent',
      sent_at         TIMESTAMP,
      created_at      TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS invoices_customer_id_idx ON invoices (customer_id);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS invoices_created_at_idx ON invoices (created_at DESC);
  `);
}

async function generateInvoiceNumber(): Promise<string> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM invoices WHERE created_at >= DATE_TRUNC('month', NOW())`
  );
  const seq = (parseInt(result.rows[0]?.count ?? "0", 10) + 1).toString().padStart(4, "0");
  const now = new Date();
  return `CS-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${seq}`;
}

function buildInvoiceEmail(params: {
  invoiceNumber: string;
  companyName: string;
  serviceLabel: string;
  amountTl: string;
  currency: string;
  periodStart: Date | null;
  periodEnd: Date | null;
}): string {
  const fmt = (d: Date | null) => d
    ? d.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })
    : "—";

  return `
<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#060D1A;color:#E8EDF5;padding:32px;border-radius:12px">
  <div style="margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-start">
    <div>
      <span style="color:#E8EDF5;font-weight:bold;font-size:22px">Cyber</span><span style="color:#00C8FF;font-weight:bold;font-size:22px">Step</span><span style="color:#7B8FAF;font-size:14px">.io</span>
      <div style="color:#5A6A80;font-size:12px;margin-top:4px">Fiş / Makbuz</div>
    </div>
    <div style="text-align:right">
      <div style="color:#E8EDF5;font-weight:bold">${params.invoiceNumber}</div>
      <div style="color:#5A6A80;font-size:12px">${new Date().toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })}</div>
    </div>
  </div>

  <div style="background:rgba(255,255,255,0.03);border-radius:8px;padding:20px;margin-bottom:24px">
    <div style="color:#7B8FAF;font-size:12px;margin-bottom:4px">FATURA KESİLEN</div>
    <div style="color:#E8EDF5;font-weight:bold">${params.companyName}</div>
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
    <thead>
      <tr style="background:rgba(0,200,255,0.05)">
        <th style="padding:10px 12px;text-align:left;color:#7B8FAF;font-size:13px">Hizmet</th>
        <th style="padding:10px 12px;text-align:left;color:#7B8FAF;font-size:13px">Dönem</th>
        <th style="padding:10px 12px;text-align:right;color:#7B8FAF;font-size:13px">Tutar</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding:12px;color:#E8EDF5">${params.serviceLabel}</td>
        <td style="padding:12px;color:#A8B8D0;font-size:13px">${fmt(params.periodStart)} – ${fmt(params.periodEnd)}</td>
        <td style="padding:12px;color:#00C8FF;font-weight:bold;text-align:right">
          ${parseFloat(params.amountTl).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ${params.currency}
        </td>
      </tr>
    </tbody>
    <tfoot>
      <tr style="border-top:1px solid #1E2D42">
        <td colspan="2" style="padding:12px;color:#7B8FAF;text-align:right;font-size:13px">TOPLAM</td>
        <td style="padding:12px;color:#E8EDF5;font-weight:bold;font-size:18px;text-align:right">
          ${parseFloat(params.amountTl).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ${params.currency}
        </td>
      </tr>
    </tfoot>
  </table>

  <div style="background:rgba(0,224,150,0.07);border:1px solid #00E096;border-radius:8px;padding:16px;margin-bottom:24px">
    <div style="color:#00E096;font-weight:bold">Ödeme Alındı</div>
    <div style="color:#A8B8D0;font-size:13px;margin-top:4px">Hizmetiniz aktif ve kullanıma hazır.</div>
  </div>

  <p style="font-size:12px;color:#5A6A80;line-height:1.6">
    Bu fiş bilgi amaçlıdır. Sorularınız için muhasebe@cyberstep.io adresine yazabilirsiniz.<br>
    CyberStep Bilişim Hizmetleri — Türkiye
  </p>
</div>`.trim();
}

export async function runAutoInvoiceGenerate(): Promise<number> {
  logger.info("auto_invoice_generate: başladı");

  await ensureInvoicesTable();

  const result = await pool.query<{
    sub_id: number;
    customer_id: number;
    email: string;
    full_name: string;
    company_name: string | null;
    service_label: string;
    amount_paid: string | null;
    currency: string;
    started_at: string;
    expires_at: string | null;
  }>(`
    SELECT
      css.id                AS sub_id,
      c.id                  AS customer_id,
      c.email,
      c.full_name,
      c.company_name,
      css.service_label,
      css.amount_paid,
      css.currency,
      css.started_at,
      css.expires_at
    FROM customer_service_subscriptions css
    JOIN customers c ON c.id = css.customer_id
    WHERE css.status = 'active'
      AND css.started_at >= NOW() - INTERVAL '25 hours'
      AND css.amount_paid IS NOT NULL
      AND css.amount_paid::numeric > 0
      AND NOT EXISTS (
        SELECT 1 FROM invoices i
        WHERE i.customer_id = css.customer_id
          AND i.subscription_id = css.id
          AND i.period_start >= NOW() - INTERVAL '25 hours'
      )
    LIMIT 100
  `);

  if (result.rows.length === 0) {
    logger.info("auto_invoice_generate: yeni faturası oluşturulacak abonelik yok");
    return 0;
  }

  logger.info({ count: result.rows.length }, "auto_invoice_generate: yeni abonelikler bulundu");

  let generated = 0;
  for (const row of result.rows) {
    try {
      const invoiceNumber = await generateInvoiceNumber();
      const companyName   = row.company_name ?? row.full_name;
      const periodStart   = row.started_at ? new Date(row.started_at) : null;
      const periodEnd     = row.expires_at ? new Date(row.expires_at)  : null;

      await pool.query(`
        INSERT INTO invoices
          (customer_id, subscription_id, invoice_number, service_label, amount_tl, currency, period_start, period_end, status, sent_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'sent', NOW())
        ON CONFLICT (invoice_number) DO NOTHING
      `, [
        row.customer_id,
        row.sub_id,
        invoiceNumber,
        row.service_label,
        row.amount_paid,
        row.currency,
        periodStart,
        periodEnd,
      ]);

      const html = buildInvoiceEmail({
        invoiceNumber,
        companyName,
        serviceLabel: row.service_label,
        amountTl:     row.amount_paid ?? "0",
        currency:     row.currency,
        periodStart,
        periodEnd,
      });

      await sendMail({
        to: row.email,
        subject: `CyberStep Fatura — ${invoiceNumber}`,
        html,
      });

      generated++;
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      logger.warn({ err, customerId: row.customer_id }, "auto_invoice_generate: fatura gönderilemedi");
    }
  }

  logger.info({ generated }, "auto_invoice_generate: tamamlandı");
  return generated;
}
