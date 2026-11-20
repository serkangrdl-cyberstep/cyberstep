/**
 * Veri kaynağı lisans anahtarı.
 * DATASOURCE_LICENSE_ENFORCE=1 iken yalnızca DATASOURCE_LICENSE_<KAYNAK>=1 olan kaynaklar çağrılır;
 * diğerleri atlanır ve "ölçülemedi" sayılır ("temiz" denmez). Varsayılan (ENFORCE kapalı): tüm kaynaklar çalışır.
 * Lisans/izin alınan kaynak için ilgili ortam değişkeni 1 yapılır. Sistem durumu: docs/satis-oncesi-kontrol-listesi.md
 */
export const LICENSED_SOURCE_IDS = [
  "virustotal", "safebrowsing", "censys", "otx", "ssllabs", "hudsonrock", "threatfox", "urlhaus", "mozilla", "ransomlook", "certspotter",
] as const;
export type LicensedSourceId = (typeof LICENSED_SOURCE_IDS)[number];

type Env = Record<string, string | undefined>;

export function isSourceLicensed(id: LicensedSourceId, env: Env = process.env): boolean {
  if (env["DATASOURCE_LICENSE_ENFORCE"] !== "1") return true;
  return env[`DATASOURCE_LICENSE_${id.toUpperCase()}`] === "1";
}

/** Yönetici/denetim görünümü: her kaynağın şu an çağrılıp çağrılmadığı. */
export function licenseStatus(env: Env = process.env): Array<{ id: LicensedSourceId; active: boolean }> {
  return LICENSED_SOURCE_IDS.map((id) => ({ id, active: isSourceLicensed(id, env) }));
}

/** Rapor/arayüz altbilgisi: atıf zorunlu kaynaklar. */
export const SOURCE_ATTRIBUTIONS: string[] = [
  "Bu ürün NVD API kullanır, ancak NVD tarafından onaylanmamış veya sertifikalandırılmamıştır.",
  "EPSS verileri FIRST.org tarafından sağlanır.",
  "Bilinen istismar edilen açık verisi: VulnCheck KEV (VulnCheck).",
  "Fidye yazılımı sızıntı sitesi verisi: RansomLook (CC BY 4.0).",
];
