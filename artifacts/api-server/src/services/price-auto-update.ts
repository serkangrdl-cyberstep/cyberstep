import { db, serviceCatalogTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { sendMail } from "./email";
import { fetchTufeAnnualRate } from "./tufe-fetcher";
import { logger } from "../lib/logger";

const ADMIN_EMAIL = process.env["ADMIN_EMAIL"] ?? "info@cyberstep.com";

function applyRate(value: string | null | undefined, rate: number): string | null {
  if (!value) return null;
  const n = parseFloat(value);
  if (isNaN(n)) return null;
  return (n * (1 + rate / 100)).toFixed(2);
}

function fmtTl(v: string | null | undefined): string {
  if (!v) return "—";
  return `${parseFloat(v).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL`;
}

export async function runPriceAutoUpdate(): Promise<number> {
  // 1. TCMB EVDS'den canlı oran çek
  let rate = await fetchTufeAnnualRate();
  let rateSource = "TCMB EVDS (otomatik)";

  // 2. Çekemediyse TUFE_ANNUAL_RATE env var'a düş
  if (rate === null) {
    const envRate = parseFloat(process.env["TUFE_ANNUAL_RATE"] ?? "");
    if (!isNaN(envRate) && envRate > 0 && envRate <= 200) {
      rate = envRate;
      rateSource = "TUFE_ANNUAL_RATE env (yedek)";
      logger.warn({ rate }, "price_auto_update: EVDS alınamadı, env var kullanılıyor");
    } else {
      logger.warn("price_auto_update: ne EVDS ne env var mevcut — atlandı");
      return 0;
    }
  }

  logger.info({ rate, rateSource }, "price_auto_update: fiyat güncelleme başladı");

  const services = await db
    .select()
    .from(serviceCatalogTable)
    .where(and(eq(serviceCatalogTable.isActive, true), eq(serviceCatalogTable.isFree, false)));

  if (services.length === 0) {
    logger.info("price_auto_update: güncellenecek servis bulunamadı");
    return 0;
  }

  type Row = { label: string; before: string; after: string };
  const rows: Row[] = [];

  for (const svc of services) {
    const newMonthly  = applyRate(svc.monthlyPriceTl, rate);
    const newPrice    = applyRate(svc.priceTl,        rate);
    const newAnnual   = applyRate(svc.priceTlAnnual,  rate);
    const newSetup    = applyRate(svc.setupFeeTl,      rate);

    rows.push({
      label:  svc.label,
      before: fmtTl(svc.monthlyPriceTl),
      after:  fmtTl(newMonthly),
    });

    await db.update(serviceCatalogTable).set({
      monthlyPriceTl: newMonthly ?? svc.monthlyPriceTl,
      ...(newPrice   ? { priceTl: newPrice }           : {}),
      ...(newAnnual  ? { priceTlAnnual: newAnnual }    : {}),
      ...(newSetup   ? { setupFeeTl: newSetup }        : {}),
      updatedAt: new Date(),
    }).where(eq(serviceCatalogTable.id, svc.id));
  }

  logger.info({ count: services.length, rate }, "price_auto_update: fiyatlar güncellendi");

  const tableRows = rows.map(r =>
    `<tr>
      <td style="padding:8px 12px;color:#E8EDF5;border-bottom:1px solid #1E2D42">${r.label}</td>
      <td style="padding:8px 12px;color:#A8B8D0;border-bottom:1px solid #1E2D42;text-align:right">${r.before}</td>
      <td style="padding:8px 12px;color:#00C8FF;border-bottom:1px solid #1E2D42;text-align:right;font-weight:bold">${r.after}</td>
    </tr>`
  ).join("");

  try {
    await sendMail({
      to: ADMIN_EMAIL,
      subject: `CyberStep Otomatik Fiyat Güncelleme — TÜFE %${rate.toFixed(2)}`,
      html: `
<div style="font-family:Inter,Arial,sans-serif;max-width:640px;margin:0 auto;background:#060D1A;color:#E8EDF5;padding:32px;border-radius:12px">
  <div style="margin-bottom:24px">
    <span style="color:#E8EDF5;font-weight:bold;font-size:22px">Cyber</span><span style="color:#00C8FF;font-weight:bold;font-size:22px">Step</span><span style="color:#7B8FAF;font-size:14px">.io</span>
  </div>
  <h2 style="color:#00C8FF;margin:0 0 8px">Yıllık TÜFE Fiyat Güncellemesi</h2>
  <p style="color:#A8B8D0">Uygulanan oran: <strong style="color:#E8EDF5">%${rate.toFixed(2)}</strong></p>
  <p style="color:#5A6A80;font-size:13px;margin:0 0 16px">Kaynak: ${rateSource}</p>
  <table style="width:100%;border-collapse:collapse;margin-top:24px">
    <thead>
      <tr style="background:rgba(0,200,255,0.08)">
        <th style="padding:10px 12px;text-align:left;color:#7B8FAF;font-weight:600;font-size:13px">Servis</th>
        <th style="padding:10px 12px;text-align:right;color:#7B8FAF;font-weight:600;font-size:13px">Eski Fiyat</th>
        <th style="padding:10px 12px;text-align:right;color:#7B8FAF;font-weight:600;font-size:13px">Yeni Fiyat</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
  <p style="font-size:12px;color:#5A6A80;margin-top:24px">
    Oran TCMB EVDS'den otomatik çekilmiştir. Yanlış bir oran uygulandıysa admin panelinden
    fiyatları manuel düzeltebilirsiniz. EVDS çalışmıyorsa yedek olarak TUFE_ANNUAL_RATE
    env değişkeni kullanılır.
  </p>
</div>`.trim(),
    });
  } catch (err) {
    logger.warn({ err }, "price_auto_update: admin e-postası gönderilemedi");
  }

  return services.length;
}
