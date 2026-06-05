/**
 * VulnCheck KEV Entegrasyonu
 *
 * CISA KEV'in göremediği ~%75 blind spot'u kapatır.
 * Network edge cihazları (Fortinet, Cisco, Palo Alto, vb.) için özel veri.
 *
 * Ücretsiz kayıt: https://vulncheck.com/auth/register
 * API key: VULNCHECK_API_KEY
 */

import axios from "axios";
import { db } from "@workspace/db";
import { vulncheckKevTable } from "@workspace/db";
import { eq, and, gte, desc } from "drizzle-orm";
import { logger } from "../../lib/logger";

const VULNCHECK_BASE = "https://api.vulncheck.com/v3";

const NETWORK_EDGE_VENDORS = [
  "fortinet", "fortigate", "fortiweb", "fortimanager",
  "cisco", "palo alto", "palo alto networks",
  "checkpoint", "check point",
  "juniper", "juniper networks",
  "zyxel", "netgear", "d-link", "dlink",
  "sonicwall", "barracuda",
  "ivanti", "pulse secure",
  "f5", "big-ip",
  "citrix", "netscaler",
];

function isNetworkEdgeDevice(products: unknown[]): boolean {
  if (!products?.length) return false;
  return products.some((p) => {
    const prod = p as Record<string, unknown>;
    const vendor = ((prod.vendor ?? prod.name ?? "") as string).toLowerCase();
    return NETWORK_EDGE_VENDORS.some((e) => vendor.includes(e));
  });
}

export interface VulnCheckResult {
  total: number;
  upserted: number;
  edgeCount: number;
  ransomwareCount: number;
}

export async function fetchVulnCheckKEV(): Promise<VulnCheckResult> {
  const apiKey = process.env["VULNCHECK_API_KEY"];
  if (!apiKey) {
    logger.warn("VULNCHECK_API_KEY eksik — VulnCheck KEV atlandı. vulncheck.com/auth/register adresinden ücretsiz kayıt ol.");
    return { total: 0, upserted: 0, edgeCount: 0, ransomwareCount: 0 };
  }

  const response = await axios.get(`${VULNCHECK_BASE}/index/vulncheck-kev`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    params: { limit: 500 },
    timeout: 30_000,
  });

  const vulnerabilities = (response.data?.data as unknown[]) ?? [];
  let upserted = 0;
  let edgeCount = 0;
  let ransomwareCount = 0;

  for (const raw of vulnerabilities) {
    const vuln = raw as Record<string, unknown>;
    const cveArr = vuln.cve as string[] | undefined;
    const cveId = cveArr?.[0] ?? (vuln.id as string | undefined);
    if (!cveId) continue;

    const products = (vuln.affected_products ?? vuln.packages ?? []) as unknown[];
    const isEdge = isNetworkEdgeDevice(products);
    const isRansomware = vuln.ransomware_use === true;
    if (isEdge) edgeCount++;
    if (isRansomware) ransomwareCount++;

    const cvss3 = vuln.cvss3 as Record<string, unknown> | undefined;
    const cvss2 = vuln.cvss2 as Record<string, unknown> | undefined;
    const cvssRaw = cvss3?.base_score ?? cvss2?.base_score;
    const epss = vuln.epss as Record<string, unknown> | undefined;

    await db.insert(vulncheckKevTable).values({
      cveId,
      vulnCheckId: vuln.id as string | undefined,
      description: vuln.description as string | undefined,
      cvssScore: cvssRaw != null ? String(cvssRaw) : undefined,
      cvssVersion: cvss3 ? "3.x" : cvss2 ? "2.0" : undefined,
      epssScore: epss?.score != null ? String(epss.score) : undefined,
      epssPercentile: epss?.percentile != null ? String(epss.percentile) : undefined,
      dateAdded: vuln.date_added ? String(vuln.date_added) : undefined,
      dateFirstExploited: vuln.date_first_reported ? String(vuln.date_first_reported) : undefined,
      ransomwareUse: isRansomware,
      affectedProducts: products as Record<string, unknown>[],
      isNetworkEdge: isEdge,
      isEndOfLife: vuln.end_of_life === true,
      inCisaKev: vuln.cisa_kev === true,
      cisaDueDate: vuln.due_date ? String(vuln.due_date) : undefined,
      lastFetchedAt: new Date(),
    }).onConflictDoUpdate({
      target: vulncheckKevTable.cveId,
      set: {
        epssScore: epss?.score != null ? String(epss.score) : undefined,
        ransomwareUse: isRansomware,
        isNetworkEdge: isEdge,
        inCisaKev: vuln.cisa_kev === true,
        lastFetchedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    upserted++;
  }

  logger.info({ upserted, edgeCount, ransomwareCount, total: vulnerabilities.length }, "VulnCheck KEV güncellendi");
  return { total: vulnerabilities.length, upserted, edgeCount, ransomwareCount };
}

export async function enrichCVEWithVulnCheck(cveId: string): Promise<{
  epssScore: number | null;
  isNetworkEdge: boolean;
  ransomwareUse: boolean;
  inCisaKev: boolean;
  isEndOfLife: boolean;
  priorityLevel: "critical" | "high" | "medium" | "low";
}> {
  const [entry] = await db.select()
    .from(vulncheckKevTable)
    .where(eq(vulncheckKevTable.cveId, cveId))
    .limit(1);

  if (!entry) {
    return { epssScore: null, isNetworkEdge: false, ransomwareUse: false, inCisaKev: false, isEndOfLife: false, priorityLevel: "low" };
  }

  const epss = entry.epssScore != null ? Number(entry.epssScore) : null;
  let priorityLevel: "critical" | "high" | "medium" | "low" = "low";

  if (entry.ransomwareUse || (epss != null && epss > 0.5)) {
    priorityLevel = "critical";
  } else if (entry.isNetworkEdge || (epss != null && epss > 0.1)) {
    priorityLevel = "high";
  } else if (epss != null && epss > 0.01) {
    priorityLevel = "medium";
  }

  return {
    epssScore: epss,
    isNetworkEdge: entry.isNetworkEdge ?? false,
    ransomwareUse: entry.ransomwareUse ?? false,
    inCisaKev: entry.inCisaKev ?? false,
    isEndOfLife: entry.isEndOfLife ?? false,
    priorityLevel,
  };
}

export async function getNetworkEdgeCVEsForCustomer(
  _customerId: number,
  daysBack = 90,
): Promise<VulncheckKev[]> {
  const since = new Date(Date.now() - daysBack * 86_400_000);
  return db.select()
    .from(vulncheckKevTable)
    .where(
      and(
        eq(vulncheckKevTable.isNetworkEdge, true),
        gte(vulncheckKevTable.dateAdded, since.toISOString().slice(0, 10)),
      ),
    )
    .orderBy(desc(vulncheckKevTable.epssScore))
    .limit(10);
}

export type VulncheckKev = typeof vulncheckKevTable.$inferSelect;
