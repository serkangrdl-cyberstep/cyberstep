import { db } from "@workspace/db";
import { domainScansTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

// ─── Sektör tespiti ─────────────────────────────────────────────────────────
export function guessSector(domain: string, shodanOrg?: string | null): string {
  const d = (domain + " " + (shodanOrg ?? "")).toLowerCase();
  if (/banka|finans|kredi|sigorta|yatirim|borsa|leasing|faktoring/.test(d)) return "finans";
  if (/hastane|klinik|saglik|doktor|eczane|medikal|tip|dental/.test(d)) return "saglik";
  if (/insaat|yapi|bina|konut|emlak|gayrimenkul|taahhut/.test(d)) return "insaat";
  if (/market|magaza|shop|ticaret|satis|toptan|perakende/.test(d)) return "perakende";
  if (/fabrika|imalat|sanayi|uretim|metal|tekstil|plastik|kimya/.test(d)) return "uretim";
  if (/otel|hotel|turizm|tatil|resort|pansiyon|hostel/.test(d)) return "turizm";
  if (/egitim|kurs|okul|akademi|dershane/.test(d)) return "egitim";
  if (/lojistik|nakliye|kargo|tasima|depo|gumruk/.test(d)) return "lojistik";
  if (/yazilim|teknoloji|bilisim|software|dijital|web/.test(d)) return "teknoloji";
  return "diger";
}

// ─── Hosting provider tespiti ────────────────────────────────────────────────
export function detectHostingProvider(shodanIsp: string | null): string {
  if (!shodanIsp) return "bilinmiyor";
  const isp = shodanIsp.toLowerCase();
  if (isp.includes("turkcell")) return "Turkcell";
  if (isp.includes("vodafone")) return "Vodafone";
  if (isp.includes("turk telekom") || isp.includes("turktelekom")) return "TurkTelekom";
  if (isp.includes("superonline") || isp.includes("bthaber")) return "Superonline";
  if (isp.includes("hizlinet") || isp.includes("hızlınet")) return "HizliNet";
  if (isp.includes("netbudur")) return "Netbudur";
  if (isp.includes("yalinhost")) return "YalinHost";
  if (isp.includes("cloudflare")) return "Cloudflare";
  if (isp.includes("amazon")) return "AWS";
  if (isp.includes("microsoft") || isp.includes("azure")) return "Azure";
  if (isp.includes("google")) return "Google Cloud";
  return shodanIsp.slice(0, 50);
}

// ─── Endeks dışı domain kontrolü ────────────────────────────────────────────
function isExcludedFromIndex(domain: string): { excluded: boolean; reason?: string } {
  const d = domain.toLowerCase().replace(/^www\./, "");
  const publicSuffixes = [".edu.tr", ".gov.tr", ".mil.tr", ".pol.tr"];
  for (const suffix of publicSuffixes) {
    if (d.endsWith(suffix)) return { excluded: true, reason: "kamu_tld" };
  }
  if (d.endsWith(".edu") || d.endsWith(".gov") || d.endsWith(".mil")) {
    return { excluded: true, reason: "kamu_tld" };
  }
  return { excluded: false };
}

// ─── enrichScanRecord: tarama sonrası endeks alanlarını doldur ───────────────
export async function enrichScanRecord(scanId: number): Promise<void> {
  try {
    const scan = await db.select().from(domainScansTable).where(eq(domainScansTable.id, scanId)).limit(1).then(r => r[0]);
    if (!scan) return;

    const exclusion = isExcludedFromIndex(scan.domain);
    const sector = guessSector(scan.domain, scan.shodanIsp);
    const hostingProvider = detectHostingProvider(scan.shodanIsp);

    const shadowIt = (scan.shadowItServices as Array<{ name: string; category: string; risk: string }> ?? []);
    const isWordpress = shadowIt.some(s => s.name?.toLowerCase().includes("wordpress"));

    const openPorts = (scan.shodanOpenPorts as Array<{ port: number }> ?? []);
    const openPortsCount = openPorts.length;

    const cveSummary = (scan.cveSummary as Array<{ cvssScore: number }> ?? []);
    const criticalCveCount = cveSummary.filter(c => c.cvssScore >= 9.0).length;
    const highCveCount = cveSummary.filter(c => c.cvssScore >= 7.0 && c.cvssScore < 9.0).length;

    await db.update(domainScansTable).set({
      sector,
      hostingProvider,
      city: scan.shodanCountry ?? null,
      isWordpress,
      hasCdn: scan.wafDetected ?? false,
      cdnProvider: scan.wafProvider ?? null,
      openPortsCount,
      criticalCveCount,
      highCveCount,
      includedInIndex: !exclusion.excluded,
      excludedReason: exclusion.excluded ? (exclusion.reason ?? null) : null,
    }).where(eq(domainScansTable.id, scanId));

    logger.info({ scanId, sector, hostingProvider, includedInIndex: !exclusion.excluded }, "Scan enriched for index");
  } catch (err) {
    logger.warn({ err, scanId }, "enrichScanRecord failed");
  }
}
