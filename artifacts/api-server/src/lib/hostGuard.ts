/**
 * Dahili ağ alan adı koruması.
 * Tarama uç noktaları kullanıcıdan alan adı alır; ".internal" gibi son ekler
 * (ör. Railway özel ağındaki postgres.railway.internal) sunucudan dahili
 * servislere bağlantı denemesi yaptırmamalı.
 */
const BLOCKED_SUFFIXES = [
  "internal", "local", "localhost", "lan", "home", "corp", "intranet", "private", "home.arpa",
];

export function isInternalHostname(domain: string): boolean {
  const d = domain.trim().toLowerCase().replace(/\.$/, "");
  if (!d) return true;
  return BLOCKED_SUFFIXES.some((suf) => d === suf || d.endsWith(`.${suf}`));
}

// ─── DNS çözümleme tabanlı koruma ────────────────────────────────────────────
// Saldırgan kendi alan adını özel bir IP'ye (10.x, 127.x, 169.254.x vb.) çözdürüp
// tarayıcıyı dahili servislere yöneltemesin. Yalnızca özel adrese çözülen alanlar
// reddedilir; hiç çözülmeyen alan adlarının taranması (DNS bulgusu üretmesi için) serbest.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const PRIVATE_V4 = [
  /^0\./, /^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./,
  /^192\.0\.0\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, /^198\.1[89]\./, /^2(2[4-9]|[3-5]\d)\./,
];

export function isPrivateAddress(addr: string): boolean {
  const a = addr.toLowerCase();
  const mapped = a.startsWith("::ffff:") ? a.slice(7) : a;
  if (isIP(mapped) === 4) return PRIVATE_V4.some((re) => re.test(mapped));
  return a === "::" || a === "::1" || a.startsWith("fc") || a.startsWith("fd") || a.startsWith("fe80:");
}

const cache = new Map<string, { ok: boolean; at: number }>();
const TTL_MS = 5 * 60 * 1000;

/** true: tarama güvenli (genel adres ya da çözülmüyor); false: dahili/özel adrese çözülüyor. */
export async function isPublicDomain(domain: string): Promise<boolean> {
  const d = domain.trim().toLowerCase().replace(/\.$/, "");
  if (isInternalHostname(d)) return false;
  const hit = cache.get(d);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.ok;
  let ok = true;
  try {
    const addrs = await Promise.race([
      lookup(d, { all: true }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("dns-timeout")), 4000)),
    ]);
    ok = addrs.every((a) => !isPrivateAddress(a.address));
  } catch {
    ok = true; // çözülemedi: bağlanılacak adres yok
  }
  if (cache.size > 5000) cache.clear();
  cache.set(d, { ok, at: Date.now() });
  return ok;
}
