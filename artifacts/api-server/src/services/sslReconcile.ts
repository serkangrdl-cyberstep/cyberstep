/**
 * SSL/TLS ölçümü başarısız olduğunda "ölçülemedi" ile "sitede HTTPS yok / bozuk" ayrımı (saf yardımcı).
 *
 * Eskiden bağlantı kurulamayan her durum "ölçülemedi" sayılıyor, böylece HTTPS'i hiç olmayan siteler
 * web kategorisinde ceza almıyor ve kapsam sahte biçimde düşüyordu.
 *  - ECONNREFUSED: 443'te hizmet yok → HTTPS yok (bulgu)
 *  - Port taraması (Shodan) elimizdeyse: 443 listede yok → HTTPS yok; listede ama 3 denemede de TLS kurulamadı → bozuk TLS
 *  - Başka bir kanıt yoksa ölçülemedi olarak kalır (geçici ağ hatası "bulgu" sayılmaz).
 */
export interface SslResultLike {
  pass: boolean;
  expiryDate: string | null;
  issuer: string | null;
  daysUntilExpiry: number | null;
  note: string | null;
  unchecked?: boolean;
  errorCode?: string;
}

export const NO_HTTPS_NOTE = "Sitede HTTPS (443) hizmeti yok; trafik şifresiz HTTP üzerinden gidiyor.";
export const BROKEN_TLS_NOTE = "443 portu açık ancak güvenli TLS bağlantısı kurulamadı (eski veya uyumsuz TLS yapılandırması olabilir).";

export function reconcileSsl<T extends SslResultLike>(ssl: T, openPorts: Array<{ port: number }> | null | undefined): T {
  if (!ssl.unchecked) return ssl;
  const fail = (note: string): T => ({ ...ssl, pass: false, daysUntilExpiry: null, note, unchecked: false });
  if (ssl.errorCode === "ECONNREFUSED") return fail(NO_HTTPS_NOTE);
  if (openPorts && openPorts.length > 0) {
    return openPorts.some((p) => p.port === 443) ? fail(BROKEN_TLS_NOTE) : fail(NO_HTTPS_NOTE);
  }
  return ssl;
}
