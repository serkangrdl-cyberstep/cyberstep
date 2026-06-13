/**
 * RIPE stat tabanlı Türk domain keşfi — API key gerektirmez.
 *
 * Yaklaşım:
 *   1. stat.ripe.net/country-resource-list?resource=TR → Türkiye ASN listesi
 *   2. Her ASN için stat.ripe.net/announced-prefixes → IPv4 prefix listesi
 *   3. Her ASN'den max 3 prefix, toplam max 60 prefix
 *   4. Her prefix'ten IP örneklemesi (/24 → 4 IP; daha geniş → 2 IP)
 *   5. HackerTarget reverse DNS → .tr hostname tespiti
 *   6. Root domain çıkar → lead_candidates'e ekle
 *
 * Kapasite: ~200 IP / çalışma → 40-80 yeni TR domain / gün
 * Rate limit: HackerTarget ~100 istek/gün → toplam IP sayısı buna göre sınırlanır
 * NOT: bgp.tools REST API'si 404 döndüğünden RIPE stat'a geçildi (2026-06-13).
 */
import axios from "axios";
import { db } from "@workspace/db";
import { discoveryRunsTable, leadCandidatesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { shouldExcludeFromPipeline } from "../leadScoringService";

// RIPE stat API — bgp.tools 404/403 döndüğünden geçildi
const RIPE_COUNTRY_URL = "https://stat.ripe.net/data/country-resource-list/data.json";
const RIPE_PREFIXES_URL = (asn: number) =>
  `https://stat.ripe.net/data/announced-prefixes/data.json?resource=AS${asn}&starttime=-1w`;
const HT_REVERSE_URL = "https://api.hackertarget.com/reverseiplookup/";
const BGP_UA = "CyberStep-Research/1.0 contact@cyberstep.io";

const MAX_ASNS = 20;
const MAX_PREFIXES_PER_ASN = 3;
const MAX_TOTAL_IPS = 200;

interface AsnEntry {
  asn: number;
  name?: string;
  country?: string;
}


function extractRootDomain(hostname: string): string {
  const clean = hostname.replace(/^\*\./, "").toLowerCase();
  const parts = clean.split(".");
  if (parts[parts.length - 1] === "tr" && parts.length >= 3) return parts.slice(-3).join(".");
  return parts.slice(-2).join(".");
}

function sampleIpsFromPrefix(cidr: string): string[] {
  const [base, bitsStr] = cidr.split("/");
  const prefixLen = parseInt(bitsStr ?? "32", 10);
  if (!base || isNaN(prefixLen)) return [];
  const parts = base.split(".").map(Number);
  if (parts.length !== 4) return [];

  const hostBits = 32 - prefixLen;
  const totalHosts = Math.pow(2, hostBits);

  // /24 (256 hosts) → 4 sample IPs; wider → 2
  const sampleCount = prefixLen >= 24 ? 4 : 2;
  const ips: string[] = [];
  const baseNum = ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;

  const offsets =
    prefixLen >= 24
      ? [1, 10, 50, 100]
      : [1, Math.floor(totalHosts / 2)];

  for (const offset of offsets.slice(0, sampleCount)) {
    if (offset >= totalHosts) continue;
    const ipNum = (baseNum + offset) >>> 0;
    ips.push([
      (ipNum >>> 24) & 0xff,
      (ipNum >>> 16) & 0xff,
      (ipNum >>> 8) & 0xff,
      ipNum & 0xff,
    ].join("."));
  }
  return ips;
}

async function fetchTrAsns(): Promise<AsnEntry[]> {
  const resp = await axios.get(RIPE_COUNTRY_URL, {
    params: { resource: "TR" },
    timeout: 20_000,
    headers: { "User-Agent": BGP_UA },
  });
  // RIPE stat response: { data: { resources: { asn: ["1234", "5678-5680", ...] } } }
  const asnRanges: string[] = resp.data?.data?.resources?.asn ?? [];
  const result: AsnEntry[] = [];
  for (const range of asnRanges) {
    const parts = range.split("-");
    const start = parseInt(parts[0] ?? "", 10);
    if (isNaN(start)) continue;
    result.push({ asn: start });
    if (result.length >= MAX_ASNS) break;
  }
  return result;
}

async function fetchAsnPrefixes(asn: number): Promise<string[]> {
  try {
    const resp = await axios.get(RIPE_PREFIXES_URL(asn), {
      timeout: 10_000,
      headers: { "User-Agent": BGP_UA },
    });
    // RIPE stat response: { data: { prefixes: [{ prefix: "1.2.3.0/24", ... }] } }
    const prefixes: Array<{ prefix?: string }> = resp.data?.data?.prefixes ?? [];
    return prefixes
      .map((p) => p.prefix ?? "")
      .filter((p) => {
        if (!p || p.includes(":")) return false; // IPv6 atla
        const bits = parseInt(p.split("/")[1] ?? "0", 10);
        return bits >= 8 && bits <= 28;
      });
  } catch {
    return [];
  }
}

async function reverseDns(ip: string): Promise<string[]> {
  try {
    const resp = await axios.get(HT_REVERSE_URL, {
      params: { q: ip },
      timeout: 8_000,
      headers: { "User-Agent": BGP_UA },
    });
    const text: string = typeof resp.data === "string" ? resp.data : "";
    if (!text || text.includes("error") || text.toLowerCase().includes("no dns")) return [];
    return text.split("\n").map((l) => l.trim()).filter((l) => l.includes("."));
  } catch {
    return [];
  }
}

export interface BgpToolsDiscoveryResult {
  runId: number;
  asnsScanned: number;
  prefixesScanned: number;
  ipsQueried: number;
  domainsFound: number;
  addedToLeads: number;
}

export async function runBgpToolsDiscovery(): Promise<BgpToolsDiscoveryResult> {
  const [run] = await db.insert(discoveryRunsTable).values({
    source: "bgptools",
    runParams: { maxAsns: MAX_ASNS, maxPrefixesPerAsn: MAX_PREFIXES_PER_ASN, maxTotalIps: MAX_TOTAL_IPS },
    status: "running",
  }).returning();
  const runId = run!.id;

  try {
    const trAsns = await fetchTrAsns();
    logger.info({ count: trAsns.length }, "BGP.tools TR ASN listesi alındı");

    const collectedDomains = new Map<string, { ip: string; asn: number }>();
    let prefixesScanned = 0;
    let ipsQueried = 0;
    let asnsScanned = 0;

    for (const asnEntry of trAsns) {
      if (ipsQueried >= MAX_TOTAL_IPS) break;

      const prefixes = await fetchAsnPrefixes(asnEntry.asn);
      await new Promise((r) => setTimeout(r, 1_000)); // bgp.tools rate limit

      const selectedPrefixes = prefixes.slice(0, MAX_PREFIXES_PER_ASN);
      for (const prefix of selectedPrefixes) {
        if (ipsQueried >= MAX_TOTAL_IPS) break;

        const ips = sampleIpsFromPrefix(prefix);
        for (const ip of ips) {
          if (ipsQueried >= MAX_TOTAL_IPS) break;

          const hostnames = await reverseDns(ip);
          ipsQueried++;

          for (const h of hostnames) {
            const hl = h.toLowerCase();
            if (!hl.endsWith(".tr")) continue;
            const root = extractRootDomain(hl);
            if (!root || root.length < 5) continue;
            if (shouldExcludeFromPipeline(root, null).exclude) continue;
            if (!collectedDomains.has(root)) {
              collectedDomains.set(root, { ip, asn: asnEntry.asn });
            }
          }

          await new Promise((r) => setTimeout(r, 1_200)); // HackerTarget budget: 100 req/day
        }
        prefixesScanned++;
      }
      asnsScanned++;
    }

    let added = 0;
    const domainArr = [...collectedDomains.entries()];
    const CHUNK = 50;
    for (let i = 0; i < domainArr.length; i += CHUNK) {
      const chunk = domainArr.slice(i, i + CHUNK);
      const inserted = await db.insert(leadCandidatesTable)
        .values(chunk.map(([domain, meta]) => ({
          domain,
          source: "bgptools",
          scanStatus: "pending" as const,
          sourceData: {
            ip: meta.ip,
            asn: meta.asn,
            discoveryMethod: "bgptools_reverse_dns",
          },
        })))
        .onConflictDoUpdate({
          target: leadCandidatesTable.domain,
          set: { sourceData: sql`COALESCE(lead_candidates.source_data, excluded.source_data)` },
        })
        .returning({ id: leadCandidatesTable.id })
        .catch(() => [] as { id: number }[]);
      added += inserted.length;
    }

    await db.update(discoveryRunsTable)
      .set({
        status: "completed",
        totalFound: collectedDomains.size,
        totalAdded: added,
        completedAt: new Date(),
        runParams: { maxAsns: MAX_ASNS, maxPrefixesPerAsn: MAX_PREFIXES_PER_ASN, maxTotalIps: MAX_TOTAL_IPS, asnsScanned, prefixesScanned, ipsQueried },
      })
      .where(eq(discoveryRunsTable.id, runId));

    logger.info({ runId, asnsScanned, prefixesScanned, ipsQueried, domainsFound: collectedDomains.size, added }, "BGP.tools discovery tamamlandı");
    return { runId, asnsScanned, prefixesScanned, ipsQueried, domainsFound: collectedDomains.size, addedToLeads: added };

  } catch (err) {
    await db.update(discoveryRunsTable)
      .set({ status: "failed", errorMessage: String(err) })
      .where(eq(discoveryRunsTable.id, runId));
    logger.error({ err, runId }, "BGP.tools discovery başarısız");
    throw err;
  }
}
