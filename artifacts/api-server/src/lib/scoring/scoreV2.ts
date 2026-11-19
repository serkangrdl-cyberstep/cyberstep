/**
 * CyberStep Risk Skoru v2
 * ─────────────────────────────────────────────────────────────────────────────
 * Dışarıdan gözlemlenebilir sinyallerden 0–100 arası bir skor üretir
 * (yüksek = daha güvenli). Tedarikçi risk portföyü (TPRM) ve /v1 skor API'si
 * bu skoru kullanır.
 *
 * Kategoriler ve azami puanları (toplam 100):
 *   1. Bilinen zafiyetler (CVE / CISA KEV) ........ 30
 *   2. Ağ maruziyeti (internete açık portlar) ..... 20
 *   3. İtibar (kara listeler, USOM, URLhaus vb.) .. 15
 *   4. E-posta güvenliği (SPF / DMARC / DKIM / MX)  15
 *   5. Veri ihlali geçmişi (HIBP) ...................... 10
 *   6. TLS ve web yapılandırması .................. 10
 *
 * Ölçülmemiş kategoriler "temiz" sayılmaz: skor yalnızca ölçülen kategorilerin
 * azami puanları üzerinden 100'e ölçeklenir ve `coverage` ayrıca raporlanır.
 * Örn. keşif hattının hafif taramalarında sızıntı, HTTP başlıkları ve bazı
 * itibar kaynakları hiç sorgulanmaz; bu alanların varsayılan 0/false değerleri
 * "bulgu yok" anlamına gelmez.
 *
 * Ağır bulgular için tavan uygulanır (ortalamanın ağır bir riski gizlemesini önler):
 *   - CISA KEV listesindeki bir zafiyet ............ skor en fazla 49
 *   - Fidye yazılımında kullanılan KEV zafiyeti .... skor en fazla 39
 *   - USOM / URLhaus / Safe Browsing kaydı ......... skor en fazla 39
 *   - İnternete açık kritik servis (RDP, SMB vb.) .. skor en fazla 59
 *
 * Bu dosya saf fonksiyonlardan oluşur; veritabanı erişimi scoreV2Loader.ts'dedir.
 */

import { classifyPort, detectCdn } from "../../services/portRiskClassifier";

export const SCORE_V2_VERSION = "2.0";

export type ScoreV2Grade = "A" | "B" | "C" | "D" | "F";
export type ScoreV2Risk = "Düşük" | "Orta" | "Yüksek" | "Kritik";

export type ScoreV2CategoryKey =
  | "vulnerabilities"
  | "network"
  | "reputation"
  | "email"
  | "breaches"
  | "web";

export interface ScoreV2Finding {
  category: ScoreV2CategoryKey;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  deduction: number;
}

export interface ScoreV2Category {
  key: ScoreV2CategoryKey;
  label: string;
  maxPoints: number;
  points: number;
  measured: boolean;
}

export interface ScoreV2Result {
  version: string;
  score: number;
  grade: ScoreV2Grade;
  risk: ScoreV2Risk;
  /** Ölçülen kategorilerin toplam ağırlığı (0–100). 100 = tüm kategoriler ölçüldü. */
  coverage: number;
  categories: ScoreV2Category[];
  findings: ScoreV2Finding[];
  /** Uygulanan tavanlar (varsa), insan okunur. */
  caps: string[];
  /**
   * Domain hakkında anlamlı veri yok (DNS/e-posta kaydı, sertifika ve port verisi
   * yok — çoğunlukla domain çözümlenemedi). Bu durumda `score` gösterilmemeli.
   */
  insufficientData: boolean;
  scannedAt: string | null;
}

/** Skorun hesaplandığı ham tarama sinyalleri (domain_scans satırının alt kümesi). */
export interface ScoreV2Input {
  referralSource?: string | null;
  createdAt?: Date | string | null;

  // E-posta
  spfPass?: boolean | null;
  spfRecord?: string | null;
  dmarcPass?: boolean | null;
  dmarcRecord?: string | null;
  dkimPass?: boolean | null;
  mxPass?: boolean | null;

  // TLS / web
  sslPass?: boolean | null;
  sslDaysUntilExpiry?: number | null;
  /** 0-100 (5 başlıktan her biri 20 puan). */
  httpHeadersScore?: number | null;
  /** X-Powered-By başlığı değeri (yazılım bilgisi sızıntısı); puan düşürmez, düşük bulgu olarak listelenir. */
  xPoweredBy?: string | null;
  /** SSL bağlantısı ölçülemedi (zaman aşımı/ağ hatası): "sertifika yok" sayılmaz, web kategorisi skora dahil edilmez. */
  sslUnchecked?: boolean;
  /** Ölçülemeyen kaynaklar (hibp, dnsbl, urlhaus, usom, ssl, shadowit, email). Ölçülemeyen kaynak "temiz" sayılmaz; ilgili kategori skora dahil edilmez. */
  uncheckedSources?: string[] | null;

  // Zafiyet
  cveSummary?: Array<{ cveId: string; cvssScore: number; adjustedCvssScore?: number; wafMitigated?: boolean }> | null;

  /** Sayfadaki istemci kitaplığı (jQuery vb.) için sürüm aralığı doğrulanmış CVE'ler. KEV olsa da tavan uygulanmaz; sabit puan kesintisi. */
  clientLibCves?: Array<{ cveId: string; cvss: number; kev: boolean; library?: string; version?: string }> | null;

  // Ağ
  shodanOpenPorts?: Array<{ port: number; protocol: string; service: string; product: string; version: string }> | null;
  shodanIsp?: string | null;

  // İtibar
  blacklisted?: boolean | null;
  blacklistCount?: number | null;
  usomListed?: boolean | null;
  urlhausListed?: boolean | null;
  safeBrowsingFlagged?: boolean | null;
  virusTotalReputation?: number | null;
  virusTotalMalicious?: number | null;
  abuseIpdbScore?: number | null;
  /** Feodo Tracker botnet C2 listesinde eşleşen IP'ler (tüm A kayıtları). */
  feodoC2Ips?: string[] | null;
  /** ThreatFox'ta alan adı için kayıtlı IOC sayısı. */
  threatFoxIocCount?: number | null;
  /** DNS'te hedefi alınabilir (dangling) CNAME sayısı — subdomain takeover riski. */
  danglingCnames?: string[] | null;
  /** Qualys SSL Labs en kötü uç nokta notu (A+…F, T, M). Yalnızca önbellekte/tamamlanmış değerlendirme varsa dolu. */
  sslLabsGrade?: string | null;

  // Sızıntı
  hibpBreachCount?: number | null;
}

/** CVE ID → KEV bilgisi. Listede olmayan CVE'ler KEV değildir. */
export type KevLookup = Map<string, { ransomware: boolean; source?: "vulncheck" }>;

// Keşif hattının (performDomainScan) hiç sorgulamadığı ve varsayılan değerle yazdığı alanlar.
const LIGHTWEIGHT_SOURCES = new Set(["discovery_pipeline"]);

const LABELS: Record<ScoreV2CategoryKey, string> = {
  vulnerabilities: "Bilinen zafiyetler",
  network: "Ağ maruziyeti",
  reputation: "İtibar",
  email: "E-posta güvenliği",
  breaches: "Veri ihlali geçmişi",
  web: "TLS ve web yapılandırması",
};

const MAX: Record<ScoreV2CategoryKey, number> = {
  vulnerabilities: 30,
  network: 20,
  reputation: 15,
  email: 15,
  breaches: 10,
  web: 10,
};

export function scoreV2Grade(score: number): ScoreV2Grade {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

export function scoreV2Risk(score: number): ScoreV2Risk {
  if (score >= 70) return "Düşük";
  if (score >= 55) return "Orta";
  if (score >= 40) return "Yüksek";
  return "Kritik";
}

const RISK_ORDER: ScoreV2Risk[] = ["Düşük", "Orta", "Yüksek", "Kritik"];

/**
 * Risk etiketi skordan türetilir ama bulgu şiddetini gizlemez: kritik bulgu varken "Düşük",
 * yüksek bulgu varken "Düşük" risk gösterilmez (kritik → en az Yüksek, yüksek → en az Orta).
 */
export function riskWithFloor(score: number, findings: Array<{ severity: string; deduction?: number }>): ScoreV2Risk {
  const base = scoreV2Risk(score);
  const floor: ScoreV2Risk = findings.some((f) => f.severity === "critical") ? "Yüksek" : findings.some((f) => f.severity === "high") ? "Orta" : "Düşük";
  return RISK_ORDER.indexOf(floor) > RISK_ORDER.indexOf(base) ? floor : base;
}

export function parseSpfPolicy(record: string | null | undefined): "hardfail" | "softfail" | "neutral" | "pass_all" | "none" {
  if (!record) return "none";
  const r = record.toLowerCase();
  if (/(^|\s)\+?all(\s|$)/.test(r) && !/[-~?]all/.test(r)) return "pass_all";
  if (/-all/.test(r)) return "hardfail";
  if (/~all/.test(r)) return "softfail";
  if (/\?all/.test(r)) return "neutral";
  return "neutral";
}

export function parseDmarcPolicy(record: string | null | undefined): "reject" | "quarantine" | "none" | null {
  if (!record) return null;
  const m = /(?:^|;)\s*p\s*=\s*(reject|quarantine|none)/i.exec(record);
  return m ? (m[1]!.toLowerCase() as "reject" | "quarantine" | "none") : null;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** KEV'deki istemci kitaplığı zafiyeti için puan kesintisi (sunucu KEV'i 20 + tavan; bu daha hafif, tavansız). */
export const CLIENT_LIB_KEV_DEDUCTION = 8;

export function computeScoreV2(input: ScoreV2Input, kev: KevLookup = new Map()): ScoreV2Result {
  const lightweight = LIGHTWEIGHT_SOURCES.has(input.referralSource ?? "");
  const unchecked = new Set(input.uncheckedSources ?? []);
  const sslUnchecked = !!input.sslUnchecked || unchecked.has("ssl");
  const emailUnchecked = unchecked.has("email");
  const vulnUnchecked = unchecked.has("shadowit") || unchecked.has("nvd");
  // Hem DNSBL hem USOM ölçülemediyse itibar kategorisinde dayanak kalmaz.
  const reputationUnchecked = unchecked.has("dnsbl") && unchecked.has("usom");
  const findings: ScoreV2Finding[] = [];
  const caps: Array<{ max: number; reason: string }> = [];

  const add = (category: ScoreV2CategoryKey, severity: ScoreV2Finding["severity"], title: string, deduction: number) => {
    findings.push({ category, severity, title, deduction });
    return deduction;
  };

  // ── 1. Bilinen zafiyetler ────────────────────────────────────────────────
  let vulnDeduction = 0;
  const seenCves = new Set<string>();
  for (const c of input.cveSummary ?? []) {
    if (!c?.cveId || seenCves.has(c.cveId)) continue;
    seenCves.add(c.cveId);
    const cvss = c.wafMitigated && typeof c.adjustedCvssScore === "number" ? c.adjustedCvssScore : c.cvssScore ?? 0;
    const kevInfo = kev.get(c.cveId);
    if (kevInfo) {
      vulnDeduction += add("vulnerabilities", "critical",
        `${c.cveId} aktif olarak sömürülüyor (${kevInfo.source === "vulncheck" ? "VulnCheck KEV" : "CISA KEV"})${kevInfo.ransomware ? " — fidye yazılımında kullanılıyor" : ""}`, 20);
      caps.push(kevInfo.ransomware
        ? { max: 39, reason: "Fidye yazılımında kullanılan KEV zafiyeti" }
        : { max: 49, reason: kevInfo.source === "vulncheck" ? "VulnCheck KEV listesinde zafiyet" : "CISA KEV listesinde zafiyet" });
    } else if (cvss >= 9) {
      vulnDeduction += add("vulnerabilities", "critical", `${c.cveId} kritik zafiyet (CVSS ${cvss})`, 10);
    } else if (cvss >= 7) {
      vulnDeduction += add("vulnerabilities", "high", `${c.cveId} yüksek zafiyet (CVSS ${cvss})`, 4);
    } else if (cvss >= 4) {
      vulnDeduction += add("vulnerabilities", "medium", `${c.cveId} orta zafiyet (CVSS ${cvss})`, 1);
    }
  }
  // İstemci kitaplığı bulguları: sunucu zafiyeti değil (tarayıcıda çalışır); KEV olsa bile skor tavanı yok, puan kesintisi var.
  for (const c of input.clientLibCves ?? []) {
    if (!c?.cveId || seenCves.has(c.cveId)) continue;
    seenCves.add(c.cveId);
    const what = c.library && c.version ? ` (${c.library === "jquery" ? "jQuery" : c.library} ${c.version})` : "";
    if (c.kev) vulnDeduction += add("vulnerabilities", "high", `${c.cveId} istemci kitaplığında aktif sömürülen zafiyet${what}`, CLIENT_LIB_KEV_DEDUCTION);
    else if (c.cvss >= 9) vulnDeduction += add("vulnerabilities", "high", `${c.cveId} istemci kitaplığında kritik zafiyet${what}`, 6);
    else if (c.cvss >= 7) vulnDeduction += add("vulnerabilities", "medium", `${c.cveId} istemci kitaplığında yüksek zafiyet${what}`, 3);
    else if (c.cvss >= 4) vulnDeduction += add("vulnerabilities", "low", `${c.cveId} istemci kitaplığında orta zafiyet${what}`, 1);
  }
  const vulnPoints = clamp(MAX.vulnerabilities - vulnDeduction, 0, MAX.vulnerabilities);

  // ── 2. Ağ maruziyeti ─────────────────────────────────────────────────────
  const networkMeasured = Array.isArray(input.shodanOpenPorts);
  let netDeduction = 0;
  if (networkMeasured) {
    const cdn = detectCdn(input.shodanIsp ?? null);
    for (const p of input.shodanOpenPorts!) {
      const cls = classifyPort(p, cdn);
      const label = `${p.port}/${p.service || p.protocol || "tcp"} internete açık`;
      if (cls.riskLevel === "critical") {
        netDeduction += add("network", "critical", label, 10);
        caps.push({ max: 59, reason: `İnternete açık kritik servis (port ${p.port})` });
      } else if (cls.riskLevel === "high") {
        netDeduction += add("network", "high", label, 5);
      } else if (cls.riskLevel === "medium") {
        netDeduction += add("network", "medium", label, 1);
      }
    }
  }
  if ((input.danglingCnames?.length ?? 0) > 0) {
    netDeduction += add("network", "high", `${input.danglingCnames!.length} alt alan adı sahipsiz bir hizmeti gösteriyor (subdomain takeover riski): ${input.danglingCnames!.slice(0, 2).join(", ")}`, 5);
  }
  const netPoints = clamp(MAX.network - netDeduction, 0, MAX.network);

  // ── 3. İtibar ────────────────────────────────────────────────────────────
  // Kara liste ve USOM her taramada sorgulanır; diğer kaynaklar yalnızca
  // tam taramada (ve null değilse) ölçülmüş sayılır.
  let repDeduction = 0;
  if (input.blacklisted) {
    repDeduction += add("reputation", "high", `Spam/kara listede (${input.blacklistCount ?? 1} liste)`, 8);
  }
  if (input.usomListed) {
    repDeduction += add("reputation", "critical", "USOM zararlı bağlantı listesinde", 15);
    caps.push({ max: 39, reason: "USOM zararlı bağlantı listesinde" });
  }
  if (!lightweight && input.urlhausListed) {
    repDeduction += add("reputation", "critical", "URLhaus zararlı yazılım dağıtım listesinde", 15);
    caps.push({ max: 39, reason: "URLhaus listesinde" });
  }
  if (input.safeBrowsingFlagged === true) {
    repDeduction += add("reputation", "critical", "Google Safe Browsing tarafından işaretlenmiş", 15);
    caps.push({ max: 39, reason: "Google Safe Browsing kaydı" });
  }
  if ((input.feodoC2Ips?.length ?? 0) > 0) {
    caps.push({ max: 39, reason: "Botnet C2 listesinde (Feodo Tracker)" });
    repDeduction += add("reputation", "critical", `Sunucu IP'si botnet C2 listesinde (${input.feodoC2Ips!.slice(0, 3).join(", ")})`, 15);
  }
  if ((input.threatFoxIocCount ?? 0) > 0) {
    caps.push({ max: 49, reason: "ThreatFox zararlı IOC kaydı" });
    repDeduction += add("reputation", "high", `Alan adı ThreatFox zararlı göstergeleri (IOC) arasında (${input.threatFoxIocCount})`, 10);
  }
  if (input.virusTotalReputation != null && (input.virusTotalMalicious ?? 0) > 0) {
    repDeduction += add("reputation", "high", `VirusTotal'da ${input.virusTotalMalicious} motor zararlı olarak işaretliyor`, 10);
  }
  if (input.abuseIpdbScore != null) {
    if (input.abuseIpdbScore >= 50) repDeduction += add("reputation", "high", `AbuseIPDB kötüye kullanım skoru ${input.abuseIpdbScore}`, 8);
    else if (input.abuseIpdbScore >= 25) repDeduction += add("reputation", "medium", `AbuseIPDB kötüye kullanım skoru ${input.abuseIpdbScore}`, 4);
  }
  const repPoints = clamp(MAX.reputation - repDeduction, 0, MAX.reputation);

  // ── 4. E-posta güvenliği ─────────────────────────────────────────────────
  // SPF 5 · DMARC 6 · DKIM 3 · MX 1. MX yoksa domain e-posta almıyor demektir:
  // DKIM/MX tam puan, ancak sahte gönderime karşı SPF/DMARC yine önemlidir.
  const spf = parseSpfPolicy(input.spfRecord);
  const spfPoints = spf === "hardfail" ? 5 : spf === "softfail" ? 3.5 : spf === "neutral" ? 2 : 0;
  if (spf === "none") add("email", "high", "SPF kaydı yok — alan adınız adına sahte e-posta gönderilebilir", 5);
  else if (spf === "pass_all") add("email", "high", "SPF kaydı '+all' — her sunucuya izin veriyor", 5);
  else if (spf !== "hardfail") add("email", "low", `SPF politikası zayıf (${spf})`, 5 - spfPoints);

  const dmarc = parseDmarcPolicy(input.dmarcRecord) ?? (input.dmarcPass ? "none" : null);
  const dmarcPoints = dmarc === "reject" ? 6 : dmarc === "quarantine" ? 5 : dmarc === "none" ? 2 : 0;
  if (!dmarc) add("email", "high", "DMARC kaydı yok", 6);
  else if (dmarc === "none") add("email", "medium", "DMARC yalnızca izleme modunda (p=none)", 4);
  else if (dmarc === "quarantine") add("email", "low", "DMARC p=quarantine (p=reject önerilir)", 1);

  const hasMx = !!input.mxPass;
  const dkimPoints = !hasMx || input.dkimPass ? 3 : 0;
  if (hasMx && !input.dkimPass) add("email", "low", "DKIM imzası tespit edilemedi", 3);
  const mxPoints = 1;
  const emailPoints = clamp(spfPoints + dmarcPoints + dkimPoints + mxPoints, 0, MAX.email);

  // ── 5. Veri sızıntısı ────────────────────────────────────────────────────
  const breachesMeasured = !lightweight && input.hibpBreachCount != null && !unchecked.has("hibp");
  const breaches = input.hibpBreachCount ?? 0;
  const breachPoints = breaches === 0 ? 10 : breaches === 1 ? 6 : breaches <= 3 ? 3 : 0;
  if (breachesMeasured && breaches > 0) {
    add("breaches", breaches >= 4 ? "high" : "medium", `Alan adına ait hizmet ${breaches} bilinen veri ihlalinde yer alıyor (HIBP)`, 10 - breachPoints);
  }

  // ── 6. TLS ve web ────────────────────────────────────────────────────────
  // SSL 7 · HTTP güvenlik başlıkları 3 (başlıklar yalnızca tam taramada ölçülür).
  const days = input.sslDaysUntilExpiry;
  const baseSslPoints = days == null || days <= 0 ? 0 : days <= 13 ? 3 : days <= 29 ? 5 : 7;
  // SSL Labs notu protokol/şifre zayıflığını ölçer: C −2, D/E −4, F/T/M (güvenilmez/zayıf) −7.
  const tlsGrade = (input.sslLabsGrade ?? "").toUpperCase();
  const tlsPenalty = tlsGrade === "C" ? 2 : tlsGrade === "D" || tlsGrade === "E" ? 4 : ["F", "T", "M"].includes(tlsGrade) ? 7 : 0;
  const sslPoints = Math.max(0, baseSslPoints - tlsPenalty);
  if (tlsPenalty > 0 && baseSslPoints > 0) {
    add("web", tlsPenalty >= 7 ? "high" : "medium", `TLS yapılandırması zayıf (SSL Labs notu ${tlsGrade})`, Math.min(tlsPenalty, baseSslPoints));
  }
  if (days == null && sslUnchecked) { /* ölçülemedi — bulgu üretme */ }
  else if (days == null) add("web", "high", "Geçerli SSL/TLS sertifikasına ulaşılamadı", 7);
  else if (days <= 0) add("web", "high", "SSL sertifikasının süresi dolmuş", 7);
  else if (days <= 29) add("web", "medium", `SSL sertifikası ${days} gün içinde sona eriyor`, 7 - sslPoints);

  const headersMeasured = !lightweight && input.httpHeadersScore != null;
  const headersPoints = headersMeasured ? Math.round((clamp(input.httpHeadersScore ?? 0, 0, 100) / 100) * 3 * 10) / 10 : 0;
  if (headersMeasured && headersPoints < 2) add("web", "low", "HTTP güvenlik başlıkları eksik (HSTS, CSP vb.)", 3 - headersPoints);
  if (headersMeasured && input.xPoweredBy) add("web", "low", `X-Powered-By başlığı yazılım bilgisini açığa vuruyor (${input.xPoweredBy.slice(0, 60)})`, 0);
  // Başlıklar ölçülmediyse web kategorisi yalnızca SSL üzerinden (7 puan) değerlendirilir.
  const webMax = headersMeasured ? MAX.web : 7;
  const webPoints = clamp(sslPoints + headersPoints, 0, webMax);

  // ── Toplam ───────────────────────────────────────────────────────────────
  const categories: ScoreV2Category[] = [
    { key: "vulnerabilities", label: LABELS.vulnerabilities, maxPoints: MAX.vulnerabilities, points: vulnPoints, measured: !vulnUnchecked },
    { key: "network", label: LABELS.network, maxPoints: MAX.network, points: netPoints, measured: networkMeasured },
    { key: "reputation", label: LABELS.reputation, maxPoints: MAX.reputation, points: repPoints, measured: !reputationUnchecked },
    { key: "email", label: LABELS.email, maxPoints: MAX.email, points: emailPoints, measured: !emailUnchecked },
    { key: "breaches", label: LABELS.breaches, maxPoints: MAX.breaches, points: breachPoints, measured: breachesMeasured },
    { key: "web", label: LABELS.web, maxPoints: webMax, points: webPoints, measured: !sslUnchecked },
  ];

  const measured = categories.filter((c) => c.measured);
  const earned = measured.reduce((s, c) => s + c.points, 0);
  const possible = measured.reduce((s, c) => s + c.maxPoints, 0);
  let score = possible > 0 ? Math.round((earned / possible) * 100) : 0;

  const appliedCaps: string[] = [];
  if (caps.length > 0) {
    const tightest = caps.reduce((a, b) => (b.max < a.max ? b : a));
    if (score > tightest.max) {
      score = tightest.max;
      appliedCaps.push(`${tightest.reason} — skor en fazla ${tightest.max}`);
    }
  }

  const coverage = Math.round(
    (possible / Object.values(MAX).reduce((a, b) => a + b, 0)) * 100,
  );

  const createdAt = input.createdAt ? new Date(input.createdAt) : null;

  const hasAnySignal =
    !!input.spfRecord || !!input.dmarcRecord || !!input.mxPass || !!input.dkimPass ||
    input.sslDaysUntilExpiry != null ||
    (Array.isArray(input.shodanOpenPorts) && input.shodanOpenPorts.length > 0) ||
    (input.cveSummary?.length ?? 0) > 0 ||
    !!input.blacklisted || !!input.usomListed;

  return {
    version: SCORE_V2_VERSION,
    score,
    grade: scoreV2Grade(score),
    risk: riskWithFloor(score, findings.filter((f) => f.deduction > 0)),
    coverage,
    // Ölçülmeyen kategoriler 0 puan ve measured:false ile döner (skora dahil edilmedi).
    categories: categories.map((c) => ({ ...c, points: c.measured ? Math.round(c.points * 10) / 10 : 0 })),
    findings: findings
      .filter((f) => f.deduction > 0)
      // Ölçülemeyen kategorinin bulguları üretilmez (ör. DNS zaman aşımı "SPF yok" demek değildir).
      .filter((f) => !((f.category === "email" && emailUnchecked) || (f.category === "reputation" && reputationUnchecked) || (f.category === "vulnerabilities" && vulnUnchecked)))
      .sort((a, b) => b.deduction - a.deduction)
      .map((f) => ({ ...f, deduction: Math.round(f.deduction * 10) / 10 })),
    caps: appliedCaps,
    insufficientData: !hasAnySignal,
    scannedAt: createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.toISOString() : null,
  };
}

/** Skorun içinde CVE ID'leri — KEV sorgusu için. */
export function cveIdsOf(input: ScoreV2Input): string[] {
  return [...new Set((input.cveSummary ?? []).map((c) => c?.cveId).filter((id): id is string => !!id))];
}
