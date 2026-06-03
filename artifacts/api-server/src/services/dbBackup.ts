/**
 * Haftalık DB Yedekleme Servisi
 * Her Pazar 04:00 Istanbul — kritik tabloları JSON olarak ./backups/ dizinine yazar
 * Tablo başına satır sayısı ve toplam boyut log'lanır, email bildirimi gönderilir.
 */

import fs from "fs";
import path from "path";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import { sendMail } from "./email";

// ─── Config ───────────────────────────────────────────────────────────────────

const BACKUP_TABLES = [
  "customers",
  "domain_scans",
  "lead_candidates",
  "ioc_entries",
  "reports",
  "board_reports",
  "assessments",
  "customer_service_subscriptions",
] as const;

// Backups dizini: proje kökünde ./backups/ (git push'ta GitHub'a da gider)
const BACKUP_DIR = path.resolve(process.cwd(), "backups");

// Son 12 yedeği tut (3 aylık)
const MAX_BACKUP_SETS = 12;

// ─── Ensure schema ────────────────────────────────────────────────────────────

export async function ensureDbBackupTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS db_backup_logs (
      id            SERIAL PRIMARY KEY,
      backup_date   TEXT NOT NULL,
      backup_dir    TEXT NOT NULL,
      tables        JSONB NOT NULL,
      total_rows    INTEGER NOT NULL,
      total_bytes   BIGINT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'ok',
      error_message TEXT,
      duration_ms   INTEGER,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

async function rotateOldBackups(): Promise<void> {
  if (!fs.existsSync(BACKUP_DIR)) return;
  const sets = fs.readdirSync(BACKUP_DIR)
    .filter(f => /^\d{8}$/.test(f))
    .sort()
    .reverse();
  for (const old of sets.slice(MAX_BACKUP_SETS)) {
    const dir = path.join(BACKUP_DIR, old);
    fs.rmSync(dir, { recursive: true, force: true });
    logger.info({ dir }, "Eski yedek silindi");
  }
}

// ─── Main backup function ─────────────────────────────────────────────────────

export async function runDbBackup(): Promise<number> {
  const startedAt = Date.now();
  await ensureDbBackupTable();

  const dateStr = formatDate(new Date());
  const setDir = path.join(BACKUP_DIR, dateStr);
  fs.mkdirSync(setDir, { recursive: true });

  const tableResults: Array<{ table: string; rows: number; bytes: number }> = [];
  let totalRows = 0;
  let totalBytes = 0;

  for (const table of BACKUP_TABLES) {
    try {
      const { rows } = await pool.query(`SELECT * FROM ${table}`);
      const json = JSON.stringify(rows, null, 2);
      const filePath = path.join(setDir, `${table}.json`);
      fs.writeFileSync(filePath, json, "utf8");

      const bytes = Buffer.byteLength(json, "utf8");
      tableResults.push({ table, rows: rows.length, bytes });
      totalRows += rows.length;
      totalBytes += bytes;

      logger.info({ table, rows: rows.length, size: formatBytes(bytes) }, "Tablo yedeklendi");
    } catch (err) {
      logger.warn({ err, table }, "Tablo yedeklenemedi — atlanıyor");
      tableResults.push({ table, rows: 0, bytes: 0 });
    }
  }

  // manifest.json — set içinde özet bilgi
  const manifest = {
    backup_date: dateStr,
    created_at: new Date().toISOString(),
    tables: tableResults,
    total_rows: totalRows,
    total_bytes: totalBytes,
    total_size: formatBytes(totalBytes),
  };
  fs.writeFileSync(
    path.join(setDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );

  const duration = Date.now() - startedAt;

  // DB log kaydı
  await pool.query(
    `INSERT INTO db_backup_logs
       (backup_date, backup_dir, tables, total_rows, total_bytes, status, duration_ms)
     VALUES ($1, $2, $3, $4, $5, 'ok', $6)`,
    [
      dateStr,
      setDir,
      JSON.stringify(tableResults),
      totalRows,
      totalBytes,
      duration,
    ],
  );

  // Eski yedekleri temizle
  await rotateOldBackups();

  // Başarı email bildirimi
  const adminEmail = process.env["SOC_ADMIN_EMAIL"] ?? process.env["SMTP_USER"];
  if (adminEmail) {
    const tableRows = tableResults
      .map(t => `<tr><td style="padding:4px 10px">${t.table}</td><td style="padding:4px 10px;text-align:right">${t.rows.toLocaleString("tr-TR")}</td><td style="padding:4px 10px;text-align:right">${formatBytes(t.bytes)}</td></tr>`)
      .join("");

    await sendMail({
      to: adminEmail,
      subject: `[CyberStep] Haftalık DB Yedeği Alındı — ${dateStr}`,
      html: `
        <h2 style="color:#16a34a">Haftalık DB Yedeği Tamamlandı</h2>
        <p><strong>Tarih:</strong> ${new Date().toLocaleDateString("tr-TR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        <p><strong>Toplam satır:</strong> ${totalRows.toLocaleString("tr-TR")}</p>
        <p><strong>Toplam boyut:</strong> ${formatBytes(totalBytes)}</p>
        <p><strong>Süre:</strong> ${(duration / 1000).toFixed(1)} saniye</p>
        <table border="1" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:16px;font-family:monospace;font-size:13px">
          <thead style="background:#f3f4f6">
            <tr>
              <th style="padding:6px 10px;text-align:left">Tablo</th>
              <th style="padding:6px 10px;text-align:right">Satır</th>
              <th style="padding:6px 10px;text-align:right">Boyut</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
        <p style="margin-top:16px;color:#6b7280;font-size:12px">
          Yedek konumu: <code>${setDir}</code><br>
          Son ${MAX_BACKUP_SETS} yedek saklanır, eskiler otomatik silinir.
        </p>
        <p><a href="https://cyberstep.io/panel/cron-ayarlari">Cron panelinde görüntüle</a></p>
      `,
    }).catch(err => logger.warn({ err }, "Yedek email bildirimi gönderilemedi"));
  }

  logger.info(
    { totalRows, totalBytes, duration, setDir },
    `Haftalık DB yedeği tamamlandı — ${BACKUP_TABLES.length} tablo`,
  );

  return totalRows;
}
