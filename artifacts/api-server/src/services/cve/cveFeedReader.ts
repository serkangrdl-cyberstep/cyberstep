import { db, cveTrackerTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger";

export interface CVEEntry {
  cveId: string;
  cvssScore: number | null;
  cvssVector?: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  affectedProducts: Array<{
    vendor: string;
    product: string;
    versionStartIncluding?: string;
    versionEndExcluding?: string;
  }>;
  nvdPublishedAt?: Date;
  patchAvailable: boolean;
  patchUrl?: string;
  exploitPublic: boolean;
  cisaKev: boolean;
}

const CISA_KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
const NVD_BASE = "https://services.nvd.nist.gov/rest/json/cves/2.0";

async function isAlreadyTracked(cveId: string): Promise<boolean> {
  const [row] = await db.select({ id: cveTrackerTable.id })
    .from(cveTrackerTable)
    .where(eq(cveTrackerTable.cveId, cveId));
  return !!row;
}

export async function checkNewCVEs(): Promise<CVEEntry[]> {
  const newCVEs: CVEEntry[] = [];
  const sinceDate = new Date(Date.now() - 6 * 60 * 60 * 1000);

  // ── CISA KEV feed (exploited-in-the-wild) ────────────────────────────────────
  try {
    const resp = await fetch(CISA_KEV_URL, { signal: AbortSignal.timeout(15000) });
    if (resp.ok) {
      const data = await resp.json() as { vulnerabilities?: Array<{ cveID: string; vulnerabilityName: string; shortDescription: string; vendorProject: string; product: string; dateAdded?: string }> };
      const kevList = data.vulnerabilities ?? [];
      for (const kev of kevList) {
        if (await isAlreadyTracked(kev.cveID)) continue;
        newCVEs.push({
          cveId: kev.cveID,
          cvssScore: null,
          severity: "critical",
          title: kev.vulnerabilityName,
          description: kev.shortDescription,
          affectedProducts: [{ vendor: kev.vendorProject, product: kev.product }],
          patchAvailable: false,
          exploitPublic: true,
          cisaKev: true,
        });
      }
    }
  } catch (e) {
    logger.warn({ err: e }, "CISA KEV feed hatası");
  }

  // ── NVD Critical + High CVEs (son 6 saat) ────────────────────────────────────
  for (const severity of ["CRITICAL", "HIGH"] as const) {
    try {
      const dateStr = sinceDate.toISOString().replace(/\.\d{3}Z$/, "+00:00");
      const url = `${NVD_BASE}?pubStartDate=${encodeURIComponent(dateStr)}&cvssV3Severity=${severity}`;
      const headers: Record<string, string> = { Accept: "application/json" };
      if (process.env["NVD_API_KEY"]) headers["apiKey"] = process.env["NVD_API_KEY"];

      const resp = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
      if (!resp.ok) continue;
      const data = await resp.json() as {
        vulnerabilities?: Array<{ cve: {
          id: string;
          published: string;
          descriptions?: Array<{ lang: string; value: string }>;
          metrics?: {
            cvssMetricV31?: Array<{ cvssData: { baseScore: number; vectorString: string } }>;
            cvssMetricV30?: Array<{ cvssData: { baseScore: number; vectorString: string } }>;
          };
          configurations?: Array<{ nodes: Array<{ cpeMatch?: Array<{ criteria: string; versionStartIncluding?: string; versionEndExcluding?: string }> }> }>;
          references?: Array<{ url: string; tags?: string[] }>;
        } }>;
      };

      for (const vuln of data.vulnerabilities ?? []) {
        const cve = vuln.cve;
        if (await isAlreadyTracked(cve.id)) continue;

        const metric = cve.metrics?.cvssMetricV31?.[0] ?? cve.metrics?.cvssMetricV30?.[0];
        const cvssScore = metric?.cvssData.baseScore ?? 0;
        if (cvssScore < 8.0) continue;

        const enDesc = cve.descriptions?.find(d => d.lang === "en")?.value ?? cve.id;
        const affected = (cve.configurations?.[0]?.nodes?.[0]?.cpeMatch ?? []).map(cpe => {
          const parts = cpe.criteria.split(":");
          return {
            vendor: parts[3] ?? "",
            product: parts[4] ?? "",
            versionStartIncluding: cpe.versionStartIncluding,
            versionEndExcluding: cpe.versionEndExcluding,
          };
        });

        const patchRef = cve.references?.find(r => r.tags?.includes("Patch"));

        newCVEs.push({
          cveId: cve.id,
          cvssScore,
          cvssVector: metric?.cvssData.vectorString,
          severity: cvssScore >= 9.0 ? "critical" : "high",
          title: enDesc.slice(0, 499),
          description: enDesc,
          affectedProducts: affected.length > 0 ? affected : [],
          nvdPublishedAt: new Date(cve.published),
          patchAvailable: !!patchRef,
          patchUrl: patchRef?.url,
          exploitPublic: !!cve.references?.find(r => r.tags?.includes("Exploit")),
          cisaKev: false,
        });
      }

      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      logger.warn({ err: e, severity }, "NVD feed hatası");
    }
  }

  // Dedup by cveId (KEV + NVD can overlap)
  const seen = new Set<string>();
  return newCVEs.filter(c => {
    if (seen.has(c.cveId)) return false;
    seen.add(c.cveId);
    return true;
  });
}

export async function enrichWithNVD(cveId: string): Promise<Partial<CVEEntry>> {
  try {
    const url = `${NVD_BASE}?cveId=${encodeURIComponent(cveId)}`;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (process.env["NVD_API_KEY"]) headers["apiKey"] = process.env["NVD_API_KEY"];
    const resp = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return {};
    const data = await resp.json() as { vulnerabilities?: Array<{ cve: { metrics?: { cvssMetricV31?: Array<{ cvssData: { baseScore: number; vectorString: string } }>; cvssMetricV30?: Array<{ cvssData: { baseScore: number; vectorString: string } }> }; references?: Array<{ url: string; tags?: string[] }> } }> };
    const cve = data.vulnerabilities?.[0]?.cve;
    if (!cve) return {};
    const metric = cve.metrics?.cvssMetricV31?.[0] ?? cve.metrics?.cvssMetricV30?.[0];
    const patchRef = cve.references?.find(r => r.tags?.includes("Patch"));
    return {
      cvssScore: metric?.cvssData.baseScore ?? null,
      cvssVector: metric?.cvssData.vectorString,
      patchAvailable: !!patchRef,
      patchUrl: patchRef?.url,
    };
  } catch {
    return {};
  }
}
