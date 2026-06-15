/**
 * RIPE NCC tabanlı Türk domain keşfi — API key gerektirmez.
 *
 * Yaklaşım:
 *   1. stat.ripe.net → Türkiye IPv4 prefix listesi (~2000 prefix)
 *   2. Her prefix'ten örneklem IP seç
 *   3. HackerTarget reverse DNS → IP'den hostname
 *   4. .tr uzantılı root domain'leri lead_candidates'e ekle
 *   5. Bulunan root domain'ler için HackerTarget subdomain lookup
 *
 * Rate limit: HackerTarget ücretsiz ~100 istek/gün → maxPrefixes=60 güvenli.
 */
import axios from "axios";
import { db } from "@workspace/db";
import { discoveryRunsTable, leadCandidatesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { shouldExcludeFromPipeline } from "./leadScoringService";

const RIPE_URL = "https://stat.ripe.net/data/country-resource-list/data.json";
const HT_REVERSE_URL = "https://api.hackertarget.com/reverseiplookup/";
const HT_SUBDOMAIN_URL = "https://api.hackertarget.com/hostsearch/";

const EXCLUDED_TLDS = [".gov.tr", ".k12.tr", ".mil.tr", ".bel.tr", ".pol.tr"];
const EXCLUDED_DOMAINS = new Set([
  "cloudflare.com", "amazonaws.com", "azure.com", "google.com",
  "microsoft.com", "github.io", "netlify.app", "vercel.app",
  "fastly.net", "akamai.net",
]);

function isTurkishDomain(d: string): boolean { return d.endsWith(".tr"); }

function isExcluded(d: string): boolean {
  const dl = d.toLowerCase();
  if (EXCLUDED_TLDS.some(t => dl.endsWith(t))) return true;
  if ([...EXCLUDED_DOMAINS].some(e => dl.includes(e))) return true;
  return false;
}

function extractRootDomain(hostname: string): string {
  const clean = hostname.replace(/^\*\./, "").toLowerCase();
  const parts = clean.split(".");
  if (parts[parts.length - 1] === "tr" && parts.length >= 3) return parts.slice(-3).join(".");
  return parts.slice(-2).join(".");
}

function sampleIpsFromPrefix(cidr: string, count = 3): string[] {
  const [base, bitsStr] = cidr.split("/");
  const prefixLen = parseInt(bitsStr ?? "32", 10);
  if (!base || isNaN(prefixLen)) return [];
  const parts = base.split(".").map(Number);
  if (parts.length !== 4) return [];
  const hostBits = 32 - prefixLen;
  const totalHosts = Math.pow(2, hostBits);
  const n = Math.min(count, Math.max(1, totalHosts - 2));
  const baseNum = ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
  const ips: string[] = [];
  for (let i = 0; i < n; i++) {
    const offset = Math.floor(((i + 1) / (n + 1)) * totalHosts);
    const ipNum = (baseNum + offset) >>> 0;
    ips.push([(ipNum >>> 24) & 0xff, (ipNum >>> 16) & 0xff, (ipNum >>> 8) & 0xff, ipNum & 0xff].join("."));
  }
  return ips;
}

async function getRipeTRPrefixes(): Promise<string[]> {
  const resp = await axios.get(RIPE_URL, {
    params: { resource: "TR", v4_format: "prefix" },
    timeout: 15_000,
    headers: { "User-Agent": "CyberStep-SecurityResearch/1.0" },
  });
  const all = (resp.data?.data?.resources?.ipv4 ?? []) as string[];
  // Focus on /22–/28: wide enough to find hosts, narrow enough to sample efficiently
  return all.filter(p => {
    const bits = parseInt(p.split("/")[1] ?? "0", 10);
    return bits >= 22 && bits <= 28;
  });
}

async function reverseDns(ip: string): Promise<string[]> {
  try {
    const resp = await axios.get(HT_REVERSE_URL, {
      params: { q: ip }, timeout: 8_000,
      headers: { "User-Agent": "CyberStep-SecurityResearch/1.0" },
    });
    const text: string = typeof resp.data === "string" ? resp.data : "";
    if (!text || text.includes("error") || text.toLowerCase().includes("no dns")) return [];
    return text.split("\n").map(l => l.trim()).filter(l => l.includes("."));
  } catch { return []; }
}

async function subdomainLookup(domain: string): Promise<string[]> {
  try {
    const resp = await axios.get(HT_SUBDOMAIN_URL, {
      params: { q: domain }, timeout: 8_000,
      headers: { "User-Agent": "CyberStep-SecurityResearch/1.0" },
    });
    const text: string = typeof resp.data === "string" ? resp.data : "";
    if (!text || text.includes("error") || text.includes("API count exceeded")) return [];
    return text.split("\n").map(l => l.split(",")[0]?.trim() ?? "").filter(l => l.includes("."));
  } catch { return []; }
}

export interface RipeDiscoveryResult {
  runId: number;
  prefixesScanned: number;
  domainsFound: number;
  addedToLeads: number;
}

export async function runRipeDiscovery(opts: { maxPrefixes?: number } = {}): Promise<RipeDiscoveryResult> {
  const { maxPrefixes = 60 } = opts;

  const [run] = await db.insert(discoveryRunsTable).values({
    source: "ripe_dns",
    runParams: { maxPrefixes },
    status: "running",
  }).returning();

  const runId = run!.id;

  try {
    const allPrefixes = await getRipeTRPrefixes();
    // Shuffle to cover different parts of TR address space each run
    const sample = allPrefixes.sort(() => Math.random() - 0.5).slice(0, maxPrefixes);

    const discovered = new Map<string, { ip: string; triggerHost: string }>();
    let prefixesScanned = 0;

    for (const prefix of sample) {
      const ips = sampleIpsFromPrefix(prefix, 2);
      for (const ip of ips) {
        const hostnames = await reverseDns(ip);
        for (const h of hostnames) {
          const hl = h.toLowerCase();
          if (!isTurkishDomain(hl) || isExcluded(hl)) continue;
          const root = extractRootDomain(hl);
          if (!root || root.length < 5 || shouldExcludeFromPipeline(root, null).exclude) continue;
          if (!discovered.has(root)) discovered.set(root, { ip, triggerHost: h });
        }
        await new Promise(r => setTimeout(r, 1_500)); // ~100 req/day budget
      }
      prefixesScanned++;
      if (discovered.size >= 400) break;
    }

    // Subdomain enrichment for found domains
    const enriched = new Map<string, { ip: string; triggerHost: string; subdomains: string[] }>();
    for (const [root, data] of discovered) {
      const subs = await subdomainLookup(root);
      enriched.set(root, { ...data, subdomains: subs.slice(0, 8) });
      await new Promise(r => setTimeout(r, 1_500));
    }

    let added = 0;
    for (const [domain, data] of enriched) {
      const inserted = await db.insert(leadCandidatesTable).values({
        domain,
        source: "ripe_dns",
        sourceData: {
          ip: data.ip,
          triggerHost: data.triggerHost,
          subdomains: data.subdomains,
          discoveryMethod: "reverse_dns",
        },
        scanStatus: "pending",
      }).onConflictDoUpdate({
        target: leadCandidatesTable.domain,
        set: { sourceData: sql`COALESCE(lead_candidates.source_data, excluded.source_data)` },
      }).returning();
      if (inserted.length > 0) added++;
    }

    await db.update(discoveryRunsTable)
      .set({ status: "completed", totalFound: discovered.size, totalAdded: added, completedAt: new Date() })
      .where(eq(discoveryRunsTable.id, runId));

    logger.info({ runId, prefixesScanned, domainsFound: discovered.size, added }, "RIPE DNS discovery done");
    return { runId, prefixesScanned, domainsFound: discovered.size, addedToLeads: added };

  } catch (err) {
    await db.update(discoveryRunsTable)
      .set({ status: "failed", errorMessage: String(err) })
      .where(eq(discoveryRunsTable.id, runId));
    throw err;
  }
}
