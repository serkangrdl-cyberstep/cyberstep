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
  80:    { label: "HTTP",                 protocol: "web",       baseRisk: "none",     note: "Standart web portu — beklenen",                                                                    cdnDowngradeable: true  },
  443:   { label: "HTTPS",               protocol: "web",       baseRisk: "none",     note: "Standart HTTPS — beklenen",                                                                        cdnDowngradeable: true  },
  8080:  { label: "HTTP Alt",            protocol: "web",       baseRisk: "low",      note: "Genelde proxy/dev sunucu — doğrudan internete açıksa kontrol edilmeli",                           cdnDowngradeable: true  },
  8000:  { label: "HTTP (dev sunucu)",   protocol: "web",       baseRisk: "medium",   note: "Sıklıkla geliştirme ortamı — production'da açık olmamalı",                                        cdnDowngradeable: false },
  3000:  { label: "HTTP (dev sunucu)",   protocol: "web",       baseRisk: "medium",   note: "Node/React dev sunucusu tipik portu — production'da açık olmamalı",                              cdnDowngradeable: false },
  5000:  { label: "HTTP (dev sunucu)",   protocol: "web",       baseRisk: "medium",   note: "Flask/dev API tipik portu — production'da açık olmamalı",                                         cdnDowngradeable: false },
  // ── Cloudflare resmi proxy portları ──────────────────────────────────────
  // NOT: 8443/8880 için port numarasına değil, gerçek CDN tespitine (ISP/org) güvenin.
  // detectCdn() bu ayrımı zaten yapar — CDN yokken Cloudflare varsaymayın.
  8443:  { label: "HTTPS Alt / CF",      protocol: "web",       baseRisk: "low",      note: "CDN varsa normal; yoksa FortiGate/yönetim arayüzü olabilir — context kontrolü şart",             cdnDowngradeable: true  },
  8880:  { label: "HTTP Alt / CF",       protocol: "web",       baseRisk: "low",      note: "Yalnızca tespit edilen CDN Cloudflare ise normal say — port numarasına güvenme",                  cdnDowngradeable: true  },
  2052:  { label: "CF Proxy (HTTP)",     protocol: "web",       baseRisk: "none",     note: "Cloudflare proxy portu — CDN ortamında beklenen",                                                   cdnDowngradeable: true  },
  2053:  { label: "CF Proxy (HTTPS)",    protocol: "web",       baseRisk: "none",     note: "Cloudflare proxy portu — CDN ortamında beklenen",                                                   cdnDowngradeable: true  },
  2082:  { label: "cPanel HTTP / CF",    protocol: "admin",     baseRisk: "low",      note: "Cloudflare / cPanel yönetim portu — CDN ortamında beklenen",                                       cdnDowngradeable: true  },
  2083:  { label: "cPanel HTTPS / CF",   protocol: "admin",     baseRisk: "none",     note: "Cloudflare / cPanel HTTPS yönetim portu — CDN ortamında normal",                                   cdnDowngradeable: true  },
  2086:  { label: "WHM HTTP / CF",       protocol: "admin",     baseRisk: "low",      note: "Cloudflare / WHM yönetim portu — CDN ortamında beklenen; WHM ile çakışabilir",                     cdnDowngradeable: true  },
  2087:  { label: "WHM HTTPS / CF",      protocol: "admin",     baseRisk: "none",     note: "Cloudflare / WHM HTTPS yönetim portu — CDN ortamında normal",                                      cdnDowngradeable: true  },
  2095:  { label: "WebMail HTTP / CF",   protocol: "web",       baseRisk: "none",     note: "Cloudflare / cPanel webmail portu — CDN ortamında normal",                                          cdnDowngradeable: true  },
  2096:  { label: "WebMail HTTPS / CF",  protocol: "web",       baseRisk: "none",     note: "Cloudflare / cPanel webmail TLS portu — CDN ortamında normal",                                      cdnDowngradeable: true  },
  // ── Uzak erişim ───────────────────────────────────────────────────────────
  22:    { label: "SSH",                 protocol: "remote",    baseRisk: "low",      note: "Şifreli; ama internete açıksa brute-force hedefi — anahtar kimlik doğrulama + IP kısıtlama önerilir", cdnDowngradeable: false },
  3389:  { label: "RDP",                protocol: "remote",    baseRisk: "critical", note: "İnternete doğrudan açık RDP — en sık fidye yazılımı giriş noktası; VPN arkasına alın",            cdnDowngradeable: false },
  5900:  { label: "VNC",                protocol: "remote",    baseRisk: "critical", note: "Genelde zayıf/şifresiz kimlik doğrulama — internete açık olmamalı",                                cdnDowngradeable: false },
  5901:  { label: "VNC Alt",            protocol: "remote",    baseRisk: "critical", note: "VNC dışarıdan erişilebilir",                                                                        cdnDowngradeable: false },
  // ── Eski/tehlikeli protokoller ────────────────────────────────────────────
  23:    { label: "Telnet",             protocol: "legacy",    baseRisk: "critical", note: "Tamamen şifresiz protokol — internete asla açık olmamalı",                                          cdnDowngradeable: false },
  21:    { label: "FTP",               protocol: "legacy",    baseRisk: "high",     note: "Kimlik bilgileri şifresiz iletilir — SFTP/FTPS önerilir",                                           cdnDowngradeable: false },
  69:    { label: "TFTP",              protocol: "legacy",    baseRisk: "high",     note: "TFTP şifresiz ve kimlik doğrulamasız",                                                               cdnDowngradeable: false },
  989:   { label: "FTPS (veri)",       protocol: "legacy",    baseRisk: "low",      note: "Şifreli FTP veri kanalı",                                                                            cdnDowngradeable: false },
  990:   { label: "FTPS (kontrol)",    protocol: "legacy",    baseRisk: "low",      note: "Şifreli FTP kontrol kanalı",                                                                         cdnDowngradeable: false },
  1723:  { label: "PPTP",             protocol: "legacy",    baseRisk: "high",     note: "Eski, kriptografik olarak kırılmış VPN protokolü — modern alternatiflere geçin",                     cdnDowngradeable: false },
  // ── E-posta ───────────────────────────────────────────────────────────────
  25:    { label: "SMTP",              protocol: "email",     baseRisk: "low",      note: "Mail sunucu-sunucu iletişimi — açık olması normal; open relay taraması önerilir",                   cdnDowngradeable: false },
  110:   { label: "POP3",             protocol: "email",     baseRisk: "medium",   note: "Şifresiz olabilir — TLS zorunlu önerilir (POP3S/995 tercih edilmeli)",                              cdnDowngradeable: false },
  143:   { label: "IMAP",             protocol: "email",     baseRisk: "medium",   note: "Şifresiz olabilir — STARTTLS/IMAPS önerilir",                                                        cdnDowngradeable: false },
  465:   { label: "SMTPS",            protocol: "email",     baseRisk: "low",      note: "Şifreli mail gönderimi (implicit TLS) — standart ve beklenen",                                       cdnDowngradeable: false },
  587:   { label: "SMTP Submit",      protocol: "email",     baseRisk: "low",      note: "İstemci mail gönderimi (STARTTLS) — standart ve beklenen",                                           cdnDowngradeable: false },
  993:   { label: "IMAPS",            protocol: "email",     baseRisk: "low",      note: "Şifreli IMAP — standart ve beklenen",                                                                 cdnDowngradeable: false },
  995:   { label: "POP3S",            protocol: "email",     baseRisk: "low",      note: "Şifreli POP3 — standart ve beklenen",                                                                 cdnDowngradeable: false },
  // ── DNS ──────────────────────────────────────────────────────────────────
  53:    { label: "DNS",              protocol: "other",     baseRisk: "low",      note: "İsim sunucusu ise normal; open resolver ise DDoS amplifikasyon riski — zone transfer (AXFR) denetimi önerilir", cdnDowngradeable: false },
  // ── Veritabanları — her koşulda kritik ───────────────────────────────────
  3306:  { label: "MySQL / MariaDB",  protocol: "database",  baseRisk: "critical", note: "Veritabanı doğrudan internete açık — veri sızıntısı riski; güvenlik duvarı ile kısıtlayın",        cdnDowngradeable: false },
  5432:  { label: "PostgreSQL",       protocol: "database",  baseRisk: "critical", note: "Veritabanı doğrudan internete açık — güvenlik duvarı zorunlu",                                       cdnDowngradeable: false },
  1433:  { label: "MSSQL",           protocol: "database",  baseRisk: "critical", note: "Microsoft SQL Server doğrudan internete açık — güvenlik duvarı ile kısıtlayın",                      cdnDowngradeable: false },
  1521:  { label: "Oracle DB",        protocol: "database",  baseRisk: "critical", note: "Oracle veritabanı internete açık",                                                                    cdnDowngradeable: false },
  6379:  { label: "Redis",            protocol: "database",  baseRisk: "critical", note: "Sıklıkla kimlik doğrulamasız çalışır — internete açıksa acil müdahale gerekir",                      cdnDowngradeable: false },
  27017: { label: "MongoDB",          protocol: "database",  baseRisk: "critical", note: "Geçmişte kitlesel veri sızıntılarının başlıca kaynağı — kimlik doğrulama zorunlu",                   cdnDowngradeable: false },
  9200:  { label: "Elasticsearch",    protocol: "database",  baseRisk: "critical", note: "Varsayılan kurulumda kimlik doğrulama yoktur — indeks verileri herkese açık olabilir",               cdnDowngradeable: false },
  9300:  { label: "ES Cluster",       protocol: "database",  baseRisk: "critical", note: "Elasticsearch cluster portu internete açık",                                                          cdnDowngradeable: false },
  5984:  { label: "CouchDB",          protocol: "database",  baseRisk: "critical", note: "CouchDB HTTP API internete açık",                                                                     cdnDowngradeable: false },
  11211: { label: "Memcached",        protocol: "database",  baseRisk: "high",     note: "DDoS amplifikasyon ve veri sızıntısı riski — internete kapalı olmalı",                               cdnDowngradeable: false },
  // ── Ağ güvenliği / VPN / Fortinet bağlamı ────────────────────────────────
  4443:  { label: "Yönetim Arayüzü",  protocol: "admin",     baseRisk: "high",     note: "FortiGate/firewall admin paneli sık kullanır — internete açıksa IP allowlist zorunlu",              cdnDowngradeable: false },
  10443: { label: "Yönetim Arayüzü Alt", protocol: "admin",  baseRisk: "high",     note: "Alternatif admin GUI — internete açık olmamalı",                                                     cdnDowngradeable: false },
  500:   { label: "IPsec (IKE)",      protocol: "other",     baseRisk: "low",      note: "Site-to-site VPN — beklenen açıklık",                                                                 cdnDowngradeable: false },
  4500:  { label: "IPsec NAT-T",      protocol: "other",     baseRisk: "low",      note: "VPN NAT traversal — beklenen açıklık",                                                                cdnDowngradeable: false },
  // ── Windows / Active Directory ────────────────────────────────────────────
  135:   { label: "MS RPC",           protocol: "windows",   baseRisk: "critical", note: "İnternete açıksa Windows ağına doğrudan saldırı yüzeyi",                                             cdnDowngradeable: false },
  139:   { label: "NetBIOS / SMB",    protocol: "windows",   baseRisk: "critical", note: "WannaCry/EternalBlue tipi saldırıların klasik giriş noktası",                                        cdnDowngradeable: false },
  445:   { label: "SMB",              protocol: "windows",   baseRisk: "critical", note: "İnternete asla açık olmamalı — EternalBlue/WannaCry risk vektörü",                                   cdnDowngradeable: false },
  389:   { label: "LDAP",             protocol: "windows",   baseRisk: "critical", note: "Şifresiz dizin servisi — internete açıksa AD bilgisi sızabilir",                                     cdnDowngradeable: false },
  636:   { label: "LDAPS",            protocol: "windows",   baseRisk: "high",     note: "Şifreli LDAP — yine de internete açık olması istisnai olmalı",                                       cdnDowngradeable: false },
  88:    { label: "Kerberos",         protocol: "windows",   baseRisk: "critical", note: "AD kimlik doğrulama servisi — internete açık olmamalı",                                              cdnDowngradeable: false },
  // ── VoIP ─────────────────────────────────────────────────────────────────
  5060:  { label: "SIP",              protocol: "other",     baseRisk: "medium",   note: "Şifresiz VoIP sinyalleşmesi — toll-fraud riski",                                                     cdnDowngradeable: false },
  5061:  { label: "SIPS (TLS)",       protocol: "other",     baseRisk: "low",      note: "Şifreli VoIP sinyalleşmesi",                                                                         cdnDowngradeable: false },
  // ── IoT / Mesajlaşma / İzleme ─────────────────────────────────────────────
  1883:  { label: "MQTT",             protocol: "other",     baseRisk: "high",     note: "IoT mesajlaşma — genelde kimlik doğrulamasız; internete açık olmamalı",                              cdnDowngradeable: false },
  5672:  { label: "AMQP (RabbitMQ)",  protocol: "other",     baseRisk: "high",     note: "Mesaj kuyruğu — internete açıksa veri/komut enjeksiyonu riski",                                     cdnDowngradeable: false },
  161:   { label: "SNMP",             protocol: "other",     baseRisk: "high",     note: "Varsayılan community string'lerle (public/private) sıkça istismar edilir",                           cdnDowngradeable: false },
  // ── Yönetim panelleri ─────────────────────────────────────────────────────
  10000: { label: "Webmin",           protocol: "admin",     baseRisk: "high",     note: "Webmin yönetim paneli internete açık — güvenlik duvarı önerilir",                                    cdnDowngradeable: false },
  8888:  { label: "Admin HTTP",       protocol: "admin",     baseRisk: "medium",   note: "Yönetim paneli portu internete açık",                                                                 cdnDowngradeable: false },
  9090:  { label: "Prometheus / Cockpit", protocol: "admin", baseRisk: "medium",   note: "İzleme/yönetim paneli — genelde kimlik doğrulamasız; internete açık olmamalı",                      cdnDowngradeable: false },
  // ── Container / Orkestrasyon ──────────────────────────────────────────────
  6443:  { label: "Kubernetes API",   protocol: "container", baseRisk: "critical", note: "İnternete açıksa küme tamamen ele geçirilebilir",                                                     cdnDowngradeable: false },
  2375:  { label: "Docker (HTTP)",    protocol: "container", baseRisk: "critical", note: "Docker daemon TLS olmadan açık — kimlik doğrulamasız; anında container ele geçirme riski",           cdnDowngradeable: false },
  2376:  { label: "Docker (TLS)",     protocol: "container", baseRisk: "high",     note: "Docker daemon TLS ile açık — yine de internete açık olmamalı",                                       cdnDowngradeable: false },
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
