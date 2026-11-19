/**
 * Müşteri tarafı "Tedarikçi detay" ekranı için bulgu derleyicisi (saf fonksiyon, db'ye dokunmaz).
 * Kural: yalnızca ölçülmüş veri gösterilir; ölçülemeyen kaynak "temiz" sayılmaz, ayrıca listelenir.
 */

export interface RawCve { service: string; cveId: string; description: string; cvssScore: number; adjustedCvssScore?: number; wafMitigated?: boolean }
export interface RawPort { port: number; protocol: string; service: string; product: string; version: string }

export interface VendorCve {
  cveId: string;
  service: string;
  description: string;
  cvss: number;
  wafMitigated: boolean;
  kev: boolean;
  kevRansomware: boolean;
  kevSource: "cisa" | "vulncheck" | null;
  epss: number | null;
  epssPercentile: number | null;
}

export type PortRisk = "high" | "medium" | "low";
export interface VendorPort { port: number; protocol: string; service: string; product: string; version: string; risk: PortRisk; note: string }

// Doğrudan internete açılmaması gereken servisler.
const HIGH_PORTS: Record<number, string> = {
  21: "FTP (şifresiz dosya aktarımı)", 23: "Telnet (şifresiz uzak erişim)", 135: "Windows RPC", 139: "NetBIOS", 445: "SMB dosya paylaşımı",
  1433: "MSSQL veri tabanı", 3306: "MySQL veri tabanı", 3389: "RDP uzak masaüstü", 5432: "PostgreSQL veri tabanı", 5900: "VNC uzak masaüstü",
  6379: "Redis", 9200: "Elasticsearch", 27017: "MongoDB", 11211: "Memcached",
};
const MEDIUM_PORTS: Record<number, string> = { 22: "SSH yönetim erişimi", 25: "SMTP", 110: "POP3", 143: "IMAP", 8080: "Alternatif HTTP", 8443: "Alternatif HTTPS" };

export function classifyPort(p: RawPort): VendorPort {
  const high = HIGH_PORTS[p.port];
  const medium = MEDIUM_PORTS[p.port];
  return { ...p, risk: high ? "high" : medium ? "medium" : "low", note: high ?? medium ?? "" };
}

const RISK_ORDER: Record<PortRisk, number> = { high: 0, medium: 1, low: 2 };

export interface KevInfo { ransomware: boolean; source?: "vulncheck" }

export function buildVendorCves(
  cves: RawCve[] | null | undefined,
  kev: Map<string, KevInfo>,
  epss: Record<string, { score: number | null; percentile: number | null }> | null | undefined,
): VendorCve[] {
  const seen = new Set<string>();
  const out: VendorCve[] = [];
  for (const c of cves ?? []) {
    const key = `${c.cveId}|${c.service}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const k = kev.get(c.cveId);
    const e = epss?.[c.cveId];
    out.push({
      cveId: c.cveId, service: c.service, description: c.description,
      cvss: c.adjustedCvssScore ?? c.cvssScore,
      wafMitigated: c.wafMitigated === true,
      kev: !!k, kevRansomware: k?.ransomware === true, kevSource: k ? (k.source === "vulncheck" ? "vulncheck" : "cisa") : null,
      epss: e?.score ?? null, epssPercentile: e?.percentile ?? null,
    });
  }
  // KEV önce, sonra CVSS
  return out.sort((a, b) => Number(b.kev) - Number(a.kev) || b.cvss - a.cvss);
}

export function buildVendorPorts(ports: RawPort[] | null | undefined): VendorPort[] {
  return (ports ?? []).map(classifyPort).sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk] || a.port - b.port);
}

/** Ölçülemeyen kaynak anahtarlarının insan okunur karşılığı. */
const SOURCE_LABELS: Record<string, string> = {
  shodan: "Shodan (açık portlar)", nvd: "NVD (zafiyet verisi)", otx: "AlienVault OTX", ct: "Sertifika kayıtları (alt alan adları)",
  ssllabs: "SSL Labs", hibp: "İhlal verisi", dnsbl: "DNS kara listeleri", urlhaus: "URLhaus", usom: "USOM", ssl: "SSL/TLS", email: "E-posta kayıtları",
  feodo: "Feodo", threatfox: "ThreatFox", vulncheck: "VulnCheck KEV", hudsonrock: "Hudson Rock", mozilla: "Mozilla Observatory", shadowit: "Gölge BT",
};
export function labelUnchecked(keys: string[] | null | undefined): string[] {
  return (keys ?? []).map((k) => SOURCE_LABELS[k] ?? k);
}
