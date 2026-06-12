// ─── OSINT Zenginleştirme Servisi (WAF Bypass Risk Analizi) ──────────────────
// Wayback Machine CDX, crt.sh, Shodan InternetDB, RIPE stat ve Netcraft
// üzerinden geçmiş IP, alt alan adı, ASN/IP blok ve teknoloji verisi toplar;
// WAF bypass olasılığını değerlendirir.
// Hata durumunda güvenli fallback döner — taramayı asla durdurmaz.

import axios from "axios";

export interface OsintEnrichmentResult {
  historicalIps: string[];
  subdomainCount: number;
  technologyHints: string[];
  sources: string[];
  wafBypassRisk: "low" | "medium" | "high";
  bypassNote: string | null;
  // RIPE stat — IP blok sahipliği ve ASN bilgisi
  ripeAsn: string | null;
  ripePrefix: string | null;
  ripeOrg: string | null;
  // Netcraft — hosting geçmişi ve site detayları (NETCRAFT_API_KEY gerekli)
  netcraftServer: string | null;
  netcraftHoster: string | null;
  netcraftRisk: string | null;
}

const EMPTY: OsintEnrichmentResult = {
  historicalIps: [], subdomainCount: 0, technologyHints: [],
  sources: [], wafBypassRisk: "low", bypassNote: null,
  ripeAsn: null, ripePrefix: null, ripeOrg: null,
  netcraftServer: null, netcraftHoster: null, netcraftRisk: null,
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

// RIPE stat — IP blok sahipliği + ASN bilgisi
// stat.ripe.net/data/network-info: ASN ve prefix döner (ücretsiz, key gerektirmez)
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

  // Network-info: ASN + prefix
  const netResp = await axios.get<RipeNetworkInfo>(
    `https://stat.ripe.net/data/network-info/data.json?resource=${ip}`,
    { timeout: 8000, headers: { "User-Agent": UA } },
  );
  const asns = netResp.data.data?.asns ?? [];
  const prefix = netResp.data.data?.prefix ?? null;
  const asn = asns[0] ? `AS${asns[0]}` : null;

  // WHOIS: organizasyon adı (opsiyonel — başarısız olursa atla)
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
    // org bilgisi isteğe bağlı — sessizce atla
  }

  return { asn, prefix, org };
}

// Netcraft — domain hosting geçmişi (NETCRAFT_API_KEY gerekli)
// GET /v1/search/domains?domain={domain}&per_page=1
interface NetcraftDomain {
  hostname?: string;
  security_score?: number;
  risk_rating?: string;
  server?: { server_header?: string };
  site?: { hosting_company?: string };
}
interface NetcraftSearchResponse {
  results?: NetcraftDomain[];
}

async function fetchNetcraft(domain: string): Promise<{
  server: string | null;
  hoster: string | null;
  risk: string | null;
}> {
  const apiKey = process.env["NETCRAFT_API_KEY"];
  if (!apiKey) return { server: null, hoster: null, risk: null };

  const resp = await axios.get<NetcraftSearchResponse>(
    "https://api.netcraft.com/v1/search/domains",
    {
      params: { domain, per_page: 1 },
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": "CyberStep-SecurityResearch/1.0",
      },
      timeout: 10000,
      validateStatus: () => true,
    },
  );

  if (resp.status !== 200) return { server: null, hoster: null, risk: null };

  const hit = resp.data.results?.[0];
  if (!hit) return { server: null, hoster: null, risk: null };

  return {
    server: hit.server?.server_header ?? null,
    hoster: hit.site?.hosting_company ?? null,
    risk: hit.risk_rating ?? null,
  };
}

export async function enrichWithOsint(domain: string): Promise<OsintEnrichmentResult> {
  const result: OsintEnrichmentResult = { ...EMPTY, sources: [] };

  const [waybackResult, crtshResult, shodanResult, ripeResult, netcraftResult] =
    await Promise.allSettled([
      fetchWaybackIps(domain),
      fetchCrtshSubdomainCount(domain),
      fetchShodanInternetDb(domain),
      fetchRipeStat(domain),
      fetchNetcraft(domain),
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

  if (netcraftResult.status === "fulfilled") {
    const { server, hoster, risk } = netcraftResult.value;
    result.netcraftServer = server;
    result.netcraftHoster = hoster;
    result.netcraftRisk   = risk;
    if (server ?? hoster ?? risk) result.sources.push("netcraft");
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
