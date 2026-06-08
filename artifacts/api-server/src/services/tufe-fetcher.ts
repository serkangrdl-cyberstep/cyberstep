/**
 * TCMB EVDS — Tüketici Fiyat Endeksi (TÜFE) yıllık değişim oranı çekici
 *
 * Kayıt: https://evds2.tcmb.gov.tr/index.php?/evds/register (ücretsiz)
 * Seri : TP.FG.J0 — Yıllık TÜFE değişimi (%)
 *
 * Env  : TCMB_EVDS_API_KEY — EVDS portalından alınan API anahtarı
 */

import { logger } from "../lib/logger";

const EVDS_BASE = "https://evds2.tcmb.gov.tr/service/evds";
const SERIES    = "TP.FG.J0"; // Yıllık TÜFE (%) — genel

type EvdsItem  = Record<string, string | null>;
type EvdsResp  = { items: EvdsItem[] };

/**
 * TCMB EVDS'den son yıllık TÜFE oranını çeker.
 * Başarısız olursa null döner — çağıran fallback uygular.
 */
export async function fetchTufeAnnualRate(): Promise<number | null> {
  const apiKey = process.env["TCMB_EVDS_API_KEY"];
  if (!apiKey) {
    logger.warn("tufe_fetcher: TCMB_EVDS_API_KEY ayarlanmamış — EVDS sorgusu atlandı");
    return null;
  }

  // Son 2 aylık veriyi çek, en güncel değeri al
  const now       = new Date();
  const endDate   = fmtDate(now);
  const startDate = fmtDate(new Date(now.getFullYear(), now.getMonth() - 2, 1));

  const url = `${EVDS_BASE}/series=${SERIES}&startDate=${startDate}&endDate=${endDate}&type=json&key=${apiKey}`;

  try {
    const res = await fetch(url, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, "tufe_fetcher: EVDS isteği başarısız");
      return null;
    }

    const data = await res.json() as EvdsResp;
    const items = data?.items;
    if (!Array.isArray(items) || items.length === 0) {
      logger.warn("tufe_fetcher: EVDS yanıtında veri yok");
      return null;
    }

    // En son dolu değeri bul (null olmayan)
    const seriesKey = SERIES.replace(/\./g, "_");
    for (let i = items.length - 1; i >= 0; i--) {
      const val = items[i]?.[seriesKey];
      if (val !== null && val !== undefined && val !== "") {
        const rate = parseFloat(String(val));
        if (!isNaN(rate) && rate > 0) {
          logger.info(
            { rate, tarih: items[i]?.["Tarih"] },
            "tufe_fetcher: TÜFE yıllık oranı başarıyla alındı",
          );
          return rate;
        }
      }
    }

    logger.warn({ items }, "tufe_fetcher: geçerli TÜFE değeri bulunamadı");
    return null;
  } catch (err) {
    logger.warn({ err }, "tufe_fetcher: EVDS bağlantı hatası");
    return null;
  }
}

function fmtDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}
