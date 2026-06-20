// ─── Port Risk Classifier ────────────────────────────────────────────────────
// Bağlama duyarlı port risk değerlendirme motoru.
// Tek başına "port açık = risk" yerine CDN/proxy varlığını, protokolü ve
// servis tipini göz önüne alarak 5 seviyeli risk çıktısı üretir.

export type PortRisk = "none" | "low" | "medium" | "high" | "critical";

export interface PortClassification {
  label: string;
  protocol: "web" | "remote" | "database" | "email" | "admin" | "legacy" | "windows" | "container" | "other";
  baseRisk: PortRisk;
  note: string;
  cdnDowngradeable: boolean;
  wellKnown?: boolean;
}

export interface CdnInfo {
  detected: boolean;
  provider: string | null;
}

export interface ClassifiedPort {
  port: number;
  protocol: string;
  service: string;
  product: string;
  version: string;
  riskLevel: PortRisk;
  riskContext: string;
  isCdnExpected: boolean;
}

export interface PortRiskSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  none: number;
  cdnExpected: number;
  scoreDeduction: number;
}

// CDN sağlayıcı tespiti — ISP/org alanına göre
const CDN_PROVIDER_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /cloudflare/i,            name: "Cloudflare" },
  { pattern: /fastly/i,                name: "Fastly" },
  { pattern: /akamai/i,                name: "Akamai" },
  { pattern: /cloudfront|amazon.*cdn/i, name: "AWS CloudFront" },
  { pattern: /azure.*cdn|microsoft.*cdn/i, name: "Azure CDN" },
  { pattern: /sucuri/i,                name: "Sucuri" },
  { pattern: /imperva|incapsula/i,     name: "Imperva" },
  { pattern: /bunny\.net|bunnycdn/i,   name: "BunnyCDN" },
  { pattern: /stackpath|maxcdn/i,      name: "StackPath" },
];

// Cloudflare'in proxy olarak aktif ilettiği portlar
// https://developers.cloudflare.com/fundamentals/reference/network-ports/
const CDN_STANDARD_PORTS = new Set([
  80, 443,
  8080, 8880, 2052, 2053, 2082, 2083, 2086, 2087, 2095, 2096, 8443,
]);

const PORT_DB: Record<number, PortClassification> = {
  // ── Standart web ─────────────────────────────────────────────────────────
  80:    { label: "HTTP",            protocol: "web",       baseRisk: "none",     note: "Standart web portu — beklenen",                                                                 cdnDowngradeable: true  },
  443:   { label: "HTTPS",           protocol: "web",       baseRisk: "none",     note: "Standart HTTPS — beklenen",                                                                     cdnDowngradeable: true  },
  // ── CDN / Proxy / cPanel portları ────────────────────────────────────────
  8080:  { label: "HTTP Alt",        protocol: "web",       baseRisk: "medium",   note: "Alternatif HTTP portu — CDN ortamlarında normal, aksi hâlde doğrulayın",                      cdnDowngradeable: true  },
  8443:  { label: "HTTPS Alt",       protocol: "web",       baseRisk: "low",      note: "Alternatif HTTPS portu — CDN ortamlarında normal, aksi hâlde doğrulayın",                     cdnDowngradeable: true  },
  8880:  { label: "HTTP Alt",        protocol: "web",       baseRisk: "low",      note: "Alternatif HTTP portu — CDN ortamlarında beklenen, aksi hâlde doğrulayın",                    cdnDowngradeable: true  },
  2052:  { label: "HTTP Proxy",      protocol: "web",       baseRisk: "low",      note: "Alternatif HTTP proxy portu — CDN ortamlarında beklenen",                                      cdnDowngradeable: true  },
  2053:  { label: "DNS-over-TLS",    protocol: "web",       baseRisk: "low",      note: "DNS-over-TLS proxy portu — CDN ortamlarında beklenen",                                         cdnDowngradeable: true  },
  2082:  { label: "cPanel HTTP",     protocol: "admin",     baseRisk: "medium",   note: "cPanel yönetim portu — CDN ortamlarında beklenen, aksi hâlde güvenlik duvarı önerilir",       cdnDowngradeable: true  },
  2083:  { label: "cPanel HTTPS",    protocol: "admin",     baseRisk: "low",      note: "cPanel HTTPS yönetim portu — CDN ortamlarında normal",                                         cdnDowngradeable: true  },
  2086:  { label: "WHM HTTP",        protocol: "admin",     baseRisk: "medium",   note: "WHM yönetim portu — CDN ortamlarında beklenen, aksi hâlde güvenlik duvarı önerilir",          cdnDowngradeable: true  },
  2087:  { label: "WHM HTTPS",       protocol: "admin",     baseRisk: "low",      note: "WHM HTTPS yönetim portu — CDN ortamlarında normal",                                            cdnDowngradeable: true  },
  2095:  { label: "WebMail HTTP",    protocol: "web",       baseRisk: "low",      note: "cPanel webmail portu — CDN ortamlarında normal",                                               cdnDowngradeable: true  },
  2096:  { label: "WebMail HTTPS",   protocol: "web",       baseRisk: "low",      note: "cPanel webmail TLS portu — CDN ortamlarında normal",                                           cdnDowngradeable: true  },
  // ── Uzak erişim ───────────────────────────────────────────────────────────
  22:    { label: "SSH",             protocol: "remote",    baseRisk: "medium",   note: "SSH internete açık — brute-force riski; anahtar kimlik doğrulama ve IP kısıtlaması önerilir", cdnDowngradeable: false },
  3389:  { label: "RDP",            protocol: "remote",    baseRisk: "critical", note: "RDP internete açık — ransomware giriş noktası; VPN arkasına alın",                            cdnDowngradeable: false },
  5900:  { label: "VNC",            protocol: "remote",    baseRisk: "critical", note: "VNC dışarıdan erişilebilir — şifreli VPN zorunlu",                                            cdnDowngradeable: false },
  5901:  { label: "VNC Alt",        protocol: "remote",    baseRisk: "critical", note: "VNC dışarıdan erişilebilir",                                                                   cdnDowngradeable: false },
  // ── Eski/tehlikeli protokoller ────────────────────────────────────────────
  23:    { label: "Telnet",          protocol: "legacy",    baseRisk: "critical", note: "Telnet şifresiz metin protokolü — derhal kapatılmalı",                                         cdnDowngradeable: false },
  21:    { label: "FTP",            protocol: "legacy",    baseRisk: "high",     note: "FTP şifresiz — kimlik bilgileri açıkta; SFTP veya FTPS kullanın",                             cdnDowngradeable: false },
  69:    { label: "TFTP",           protocol: "legacy",    baseRisk: "high",     note: "TFTP şifresiz ve kimlik doğrulamasız",                                                          cdnDowngradeable: false },
  // ── E-posta ───────────────────────────────────────────────────────────────
  25:    { label: "SMTP",           protocol: "email",     baseRisk: "medium",   note: "SMTP doğrudan açık — open relay taraması önerilir",                                            cdnDowngradeable: false },
  110:   { label: "POP3",           protocol: "email",     baseRisk: "medium",   note: "POP3 açık — şifresiz iletim; TLS zorunlu yapın (POP3S/995 tercih edilmeli)",                  cdnDowngradeable: false },
  143:   { label: "IMAP",           protocol: "email",     baseRisk: "low",      note: "IMAP — STARTTLS ile kabul edilebilir; şifreli IMAPS/993 tercih edilmeli",                     cdnDowngradeable: false },
  465:   { label: "SMTPS",          protocol: "email",     baseRisk: "low",      note: "SMTPS (SMTP over TLS) — şifreli mail gönderimi, standart ve beklenen",                       cdnDowngradeable: false },
  587:   { label: "SMTP Submit",    protocol: "email",     baseRisk: "low",      note: "SMTP submission — TLS ile normal, e-posta istemcileri için standart",                         cdnDowngradeable: false },
  993:   { label: "IMAPS",          protocol: "email",     baseRisk: "low",      note: "IMAPS (IMAP over SSL/TLS) — şifreli mail erişimi, standart ve beklenen",                     cdnDowngradeable: false },
  995:   { label: "POP3S",          protocol: "email",     baseRisk: "low",      note: "POP3S (POP3 over SSL/TLS) — şifreli mail erişimi, standart ve beklenen",                     cdnDowngradeable: false },
  // ── DNS ─────────────────────────────────────────────────────────────────
  53:    { label: "DNS",            protocol: "other",     baseRisk: "low",      note: "DNS portu açık — yetkili DNS sunucu; zone transfer (AXFR) denetimi önerilir",                 cdnDowngradeable: false },
  // ── Veritabanı — her koşulda kritik ──────────────────────────────────────
  3306:  { label: "MySQL",          protocol: "database",  baseRisk: "critical", note: "MySQL internete açık — veri sızıntısı riski; güvenlik duvarı ile kısıtlayın",                 cdnDowngradeable: false },
  5432:  { label: "PostgreSQL",     protocol: "database",  baseRisk: "critical", note: "PostgreSQL dışarıdan erişilebilir — güvenlik duvarı zorunlu",                                  cdnDowngradeable: false },
  27017: { label: "MongoDB",        protocol: "database",  baseRisk: "critical", note: "MongoDB internete açık — şifresiz erişim riski çok yüksek",                                   cdnDowngradeable: false },
  6379:  { label: "Redis",          protocol: "database",  baseRisk: "critical", note: "Redis internete açık — yetkisiz erişim ve RCE riski",                                          cdnDowngradeable: false },
  9200:  { label: "Elasticsearch",  protocol: "database",  baseRisk: "critical", note: "Elasticsearch herkese açık — indeks verileri okunabilir",                                      cdnDowngradeable: false },
  9300:  { label: "ES Cluster",     protocol: "database",  baseRisk: "critical", note: "Elasticsearch cluster portu internete açık",                                                    cdnDowngradeable: false },
  1433:  { label: "MSSQL",          protocol: "database",  baseRisk: "critical", note: "MSSQL dışarıdan erişilebilir — güvenlik duvarı ile kısıtlayın",                               cdnDowngradeable: false },
  1521:  { label: "Oracle DB",      protocol: "database",  baseRisk: "critical", note: "Oracle veritabanı internete açık",                                                              cdnDowngradeable: false },
  5984:  { label: "CouchDB",        protocol: "database",  baseRisk: "critical", note: "CouchDB HTTP API internete açık",                                                               cdnDowngradeable: false },
  // ── Windows / SMB ─────────────────────────────────────────────────────────
  445:   { label: "SMB",            protocol: "windows",   baseRisk: "critical", note: "SMB internete açık — WannaCry/EternalBlue risk vektörü; güvenlik duvarı zorunlu",             cdnDowngradeable: false },
  135:   { label: "RPC",            protocol: "windows",   baseRisk: "high",     note: "Windows RPC dışarıdan erişilebilir",                                                            cdnDowngradeable: false },
  139:   { label: "NetBIOS",        protocol: "windows",   baseRisk: "high",     note: "NetBIOS internete açık",                                                                         cdnDowngradeable: false },
  // ── Yönetim panelleri ─────────────────────────────────────────────────────
  10000: { label: "Webmin",         protocol: "admin",     baseRisk: "high",     note: "Webmin yönetim paneli internete açık — güvenlik duvarı önerilir",                              cdnDowngradeable: false },
  8888:  { label: "Admin HTTP",     protocol: "admin",     baseRisk: "medium",   note: "Yönetim paneli portu internete açık",                                                            cdnDowngradeable: false },
  9090:  { label: "Cockpit",        protocol: "admin",     baseRisk: "medium",   note: "Linux Cockpit yönetim arayüzü açık",                                                            cdnDowngradeable: false },
  // ── Docker / Container ────────────────────────────────────────────────────
  2375:  { label: "Docker (HTTP)",  protocol: "container", baseRisk: "critical", note: "Docker daemon TLS olmadan açık — tam sunucu kontrolü riski",                                   cdnDowngradeable: false },
  2376:  { label: "Docker (TLS)",   protocol: "container", baseRisk: "high",     note: "Docker daemon TLS ile açık — erişim kontrolü kritik",                                          cdnDowngradeable: false },
};

// ─── Public API ───────────────────────────────────────────────────────────────

export function detectCdn(isp: string | null): CdnInfo {
  if (!isp) return { detected: false, provider: null };
  for (const { pattern, name } of CDN_PROVIDER_PATTERNS) {
    if (pattern.test(isp)) return { detected: true, provider: name };
  }
  return { detected: false, provider: null };
}

export function classifyPort(
  portData: { port: number; protocol: string; service: string; product: string; version: string },
  cdn: CdnInfo,
): ClassifiedPort {
  const def = PORT_DB[portData.port];
  const isCdnExpected =
    cdn.detected &&
    (def?.cdnDowngradeable ?? false) &&
    CDN_STANDARD_PORTS.has(portData.port);

  let riskLevel: PortRisk;
  let riskContext: string;

  if (isCdnExpected) {
    riskLevel = "none";
    riskContext = `${cdn.provider ?? "CDN"} altyapısında beklenen port — güvenlik riski yok`;
  } else if (def) {
    riskLevel = def.baseRisk;
    riskContext = def.note;
  } else {
    riskLevel = "low";
    riskContext = "Bilinmeyen servis — manuel doğrulama önerilir";
  }

  return { ...portData, riskLevel, riskContext, isCdnExpected };
}

export function buildPortRiskSummary(classifiedPorts: ClassifiedPort[]): PortRiskSummary {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, none: 0, cdnExpected: 0 };
  for (const p of classifiedPorts) {
    counts[p.riskLevel]++;
    if (p.isCdnExpected) counts.cdnExpected++;
  }
  // Ağırlıklı puan kesintisi — max 20 puan
  const scoreDeduction = Math.min(counts.critical * 8 + counts.high * 4 + counts.medium * 1, 20);
  return { ...counts, scoreDeduction };
}

// Rapor/AI prompt için insanca okunabilir özet
export function portRiskLabel(risk: PortRisk): string {
  switch (risk) {
    case "critical": return "Kritik";
    case "high":     return "Yüksek";
    case "medium":   return "Orta";
    case "low":      return "Düşük";
    case "none":     return "Beklenen";
  }
}
