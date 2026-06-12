// ─── OSINT Zenginleştirme Servisi (WAF Bypass Risk Analizi) ──────────────────
// Wayback Machine CDX, crt.sh, Shodan InternetDB ve RIPE stat üzerinden geçmiş IP,
// alt alan adı, ASN/IP blok ve teknoloji verisi toplar; WAF bypass olasılığını değerlendirir.
// Hata durumunda güvenli fallback döner — taramayı asla durdurmaz.
//
// Netcraft: Enterprise API — kamuya açık değil, key alınamadı, devre dışı bırakıldı.

import axios from "axios";

export interface OsintEnrichmentResult {
  historicalIps: string[];
  subdomainCount: number;
  technologyHints: string[];
  sources: string[];
  wafBypassRisk: "low" | "medium" | "high";
  bypassNote: string | null;
  // RIPE stat — IP blok sahipliği ve ASN bilgisi (ücretsiz, key gerektirmez)
  ripeAsn: string | null;
  ripePrefix: string | null;
  ripeOrg: string | null;
}

const EMPTY: OsintEnrichmentResult = {
  historicalIps: [], subdomainCount: 0, technologyHints: [],
  sources: [], wafBypassRisk: "low", bypassNote: null,
  ripeAsn: null, ripePrefix: null, ripeOrg: null,
};

// Wayback Machine CDX API — geçmiş doğrudan IP URL tespiti
async function fetchWaybackIps(domain: string): Promise<string[]> {
  const url =
    `http://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(domain)}/*` +
    `&output=json&fl=original&limit=100&collapse=timestamp:6&from=20190101` +
    `&filter=statuscode:200`;
  const resp = await axios.get<string[][]>(url, { timeout: 9000 });
  const rows = resp.data;
  if (!Array.isArray(rows) || rows.length < 2) return [];
  const ips = new Set<string>();
  for (const row of rows.slice(1)) {
    const original = row[0] ?? "";
    const ipMatch = original.match(/https?:\/\/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
    if (ipMatch?.[1]) ips.add(ipMatch[1]);
  }
  return [...ips];
}

// crt.sh — sertifika şeffaflık kaydından alt alan adı sayısı
async function fetchCrtshSubdomainCount(domain: string): Promise<number> {
  const url = `https://crt.sh/?q=%.${domain}&output=json`;
  const resp = await axios.get<Array<{ name_value: string }>>(url, {
    timeout: 9000,
    headers: { "Accept": "application/json" },
  });
  const items = resp.data;
  if (!Array.isArray(items)) return 0;
  const names = new Set(
    items.map(i => i.name_value?.replace(/^\*\./, "").toLowerCase()).filter(Boolean),
  );
  return names.size;
}

// Shodan InternetDB — IP tabanlı teknoloji etiketleri
async function fetchShodanInternetDb(domain: string): Promise<string[]> {
  const dns = await import("dns/promises");
  const ips = await dns.resolve4(domain);
  const ip = ips[0];
  if (!ip) return [];
  const url = `https://internetdb.shodan.io/${ip}`;
  const resp = await axios.get<{ tags?: string[] }>(url, {
    timeout: 6000,
    validateStatus: () => true,
  });
  if (resp.status !== 200) return [];
  return resp.data.tags ?? [];
}

// RIPE stat — IP blok sahipliği + ASN bilgisi (ücretsiz, API key gerektirmez)
// stat.ripe.net/data/network-info: ASN numarası ve IP prefix döner
// stat.ripe.net/data/whois: organizasyon adı (opsiyonel)
interface RipeNetworkInfo {
  data?: { asns?: string[]; prefix?: string };
}
interface RipeWhois {
  data?: { records?: Array<Array<{ key: string; value: string }>> };
}

async function fetchRipeStat(domain: string): Promise<{
  asn: string | null;
  prefix: string | null;
  org: string | null;
}> {
  const dns = await import("dns/promises");
  const ips = await dns.resolve4(domain);
  const ip = ips[0];
  if (!ip) return { asn: null, prefix: null, org: null };

  const UA = "CyberStep-Research/1.0 (contact@cyberstep.io)";

  const netResp = await axios.get<RipeNetworkInfo>(
    `https://stat.ripe.net/data/network-info/data.json?resource=${ip}`,
    { timeout: 8000, headers: { "User-Agent": UA } },
  );
  const asns = netResp.data.data?.asns ?? [];
  const prefix = netResp.data.data?.prefix ?? null;
  const asn = asns[0] ? `AS${asns[0]}` : null;

  let org: string | null = null;
  try {
    const whoisResp = await axios.get<RipeWhois>(
      `https://stat.ripe.net/data/whois/data.json?resource=${ip}`,
      { timeout: 8000, headers: { "User-Agent": UA } },
    );
    const records = whoisResp.data.data?.records ?? [];
    for (const block of records) {
      const orgEntry = block.find(r => r.key === "org-name" || r.key === "descr");
      if (orgEntry?.value) { org = orgEntry.value; break; }
    }
  } catch {
    // org bilgisi opsiyonel — sessizce atla
  }

  return { asn, prefix, org };
}

export async function enrichWithOsint(domain: string): Promise<OsintEnrichmentResult> {
  const result: OsintEnrichmentResult = { ...EMPTY, sources: [] };

  const [waybackResult, crtshResult, shodanResult, ripeResult] =
    await Promise.allSettled([
      fetchWaybackIps(domain),
      fetchCrtshSubdomainCount(domain),
      fetchShodanInternetDb(domain),
      fetchRipeStat(domain),
    ]);

  if (waybackResult.status === "fulfilled") {
    result.historicalIps = waybackResult.value;
    if (waybackResult.value.length > 0) result.sources.push("wayback");
  }

  if (crtshResult.status === "fulfilled") {
    result.subdomainCount = crtshResult.value;
    result.sources.push("crt.sh");
  }

  if (shodanResult.status === "fulfilled" && shodanResult.value.length > 0) {
    result.technologyHints = shodanResult.value;
    result.sources.push("shodan_internetdb");
  }

  if (ripeResult.status === "fulfilled") {
    const { asn, prefix, org } = ripeResult.value;
    result.ripeAsn    = asn;
    result.ripePrefix = prefix;
    result.ripeOrg    = org;
    if (asn ?? prefix) result.sources.push("ripe");
  }

  // WAF bypass risk değerlendirmesi
  if (result.historicalIps.length > 0) {
    result.wafBypassRisk = "high";
    result.bypassNote =
      `Wayback Machine'de ${result.historicalIps.length} adet eski doğrudan IP adresi tespit edildi. ` +
      `WAF bypass riski yüksek — saldırganlar bu IP'lere doğrudan erişim deneyebilir.`;
  } else if (result.subdomainCount > 20) {
    result.wafBypassRisk = "medium";
    result.bypassNote =
      `${result.subdomainCount} alt alan adı crt.sh sertifika kayıtlarında mevcut. ` +
      `Bazı alt alan adları WAF koruması olmadan erişilebilir olabilir.`;
  }

  return result;
}
