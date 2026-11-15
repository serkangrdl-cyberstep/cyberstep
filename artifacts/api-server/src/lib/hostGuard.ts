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
