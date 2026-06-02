/**
 * crt.sh SSL Certificate Transparency lead scanner.
 * No API key required — public endpoint.
 */
import axios from "axios";
import { db } from "@workspace/db";
import { discoveryRunsTable, leadCandidatesTable, subdomainScoringRulesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger";

const CRTSH_BASE = "https://crt.sh";
const EXCLUDED_DOMAINS = new Set([
  "cloudflare.com", "amazonaws.com", "azure.com",
  "google.com", "microsoft.com", "github.io",
  "netlify.app", "vercel.app", "letsencrypt.org",
  "fastly.net", "akamai.net", "akamaitechnologies.com",
]);

// In-memory cache of scoring rules (populated on first scan)
let SCORING_CACHE: Record<string, { corporate_score: number; subdomain_type: string }> = {};

async function loadScoringRules(): Promise<void> {
  const rows = await db.select().from(subdomainScoringRulesTable).where(eq(subdomainScoringRulesTable.isActive, true));
  SCORING_CACHE = {};
  for (const r of rows) {
    SCORING_CACHE[r.pattern] = { corporate_score: r.corporateScore, subdomain_type: r.subdomainType ?? "generic" };
  }
}

function extractRootDomain(hostname: string): string {
  const parts = hostname.split(".");
  if (parts[parts.length - 1] === "tr" && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }
  return parts.slice(-2).join(".");
}

function isTurkishDomain(d: string): boolean {
  return d.endsWith(".tr");
}

function isExcluded(domain: string): boolean {
  for (const ex of EXCLUDED_DOMAINS) {
    if (domain.includes(ex)) return true;
  }
  return false;
}

function analyzeSubdomain(domain: string): {
  rootDomain: string;
  corporateScore: number;
  subdomainType: string;
} {
  const clean = domain.replace(/^\*\./, "").toLowerCase();
  const parts = clean.split(".");
  const isTR = parts[parts.length - 1] === "tr";
  const rootDomain = isTR && parts.length >= 3 ? parts.slice(-3).join(".") : parts.slice(-2).join(".");
  const prefixParts = isTR ? parts.slice(0, -3) : parts.slice(0, -2);

  if (prefixParts.length === 0) return { rootDomain, corporateScore: 10, subdomainType: "generic" };

  let maxScore = 0;
  let matchedType = "generic";
  for (const part of prefixParts) {
    const rule = SCORING_CACHE[part];
    if (rule && rule.corporate_score > maxScore) {
      maxScore = rule.corporate_score;
      matchedType = rule.subdomain_type;
    }
  }
  return { rootDomain, corporateScore: maxScore || 10, subdomainType: matchedType };
}

function extractDomainsFromCert(cert: { common_name?: string; name_value?: string }): string[] {
  const domains = new Set<string>();
  if (cert.common_name) domains.add(cert.common_name.toLowerCase());
  if (cert.name_value) {
    cert.name_value.split("\n")
      .map((d) => d.trim().toLowerCase())
      .filter((d) => d && !d.startsWith("*"))
      .forEach((d) => domains.add(d));
  }
  return Array.from(domains);
}

export interface CRTSHScanResult {
  runId: number;
  certsScanned: number;
  domainsFound: number;
  addedToLeads: number;
}

export async function scanCRTSH(
  query: string = "%.com.tr",
  options: { daysBack?: number; minCorporateScore?: number; limit?: number } = {},
): Promise<CRTSHScanResult> {
  const { daysBack = 30, minCorporateScore = 60, limit = 300 } = options;

  await loadScoringRules();

  const [run] = await db.insert(discoveryRunsTable).values({
    source: "crtsh",
    runParams: { query, daysBack, minCorporateScore, limit },
    status: "running",
  }).returning();

  try {
    logger.info({ query }, "crt.sh scan starting");
    const response = await axios.get(`${CRTSH_BASE}/`, {
      params: { q: query, output: "json" },
      timeout: 45_000,
      headers: { "User-Agent": "CyberStep-SecurityResearch/1.0" },
    });

    const certs: Array<{ common_name?: string; name_value?: string; entry_timestamp?: string; issuer_name?: string }> = response.data ?? [];
    const cutoff = new Date(Date.now() - daysBack * 86_400_000);
    const qualifiedDomains = new Map<string, { triggerSubdomain: string; subdomainType: string; score: number; certIssuer: string }>();

    for (const cert of certs) {
      if (qualifiedDomains.size >= limit) break;
      if (cert.entry_timestamp && new Date(cert.entry_timestamp) < cutoff) continue;

      for (const domain of extractDomainsFromCert(cert)) {
        if (isExcluded(domain) || !isTurkishDomain(domain)) continue;
        const analysis = analyzeSubdomain(domain);
        if (!analysis.rootDomain || analysis.corporateScore < minCorporateScore) continue;

        const existing = qualifiedDomains.get(analysis.rootDomain);
        if (!existing || analysis.corporateScore > existing.score) {
          qualifiedDomains.set(analysis.rootDomain, {
            triggerSubdomain: domain,
            subdomainType: analysis.subdomainType,
            score: analysis.corporateScore,
            certIssuer: cert.issuer_name ?? "",
          });
        }
      }
    }

    let added = 0;
    for (const [domain, data] of qualifiedDomains) {
      const inserted = await db.insert(leadCandidatesTable).values({
        domain,
        source: "crtsh",
        sourceData: {
          triggerSubdomain: data.triggerSubdomain,
          subdomainType: data.subdomainType,
          corporateScore: data.score,
          certIssuer: data.certIssuer,
        },
        scanStatus: "pending",
      }).onConflictDoNothing().returning();
      if (inserted.length > 0) added++;
    }

    await db.update(discoveryRunsTable).set({
      status: "completed",
      totalFound: qualifiedDomains.size,
      totalAdded: added,
      completedAt: new Date(),
    }).where(eq(discoveryRunsTable.id, run.id));

    logger.info({ runId: run.id, certsScanned: certs.length, domainsFound: qualifiedDomains.size, added }, "crt.sh scan done");
    return { runId: run.id, certsScanned: certs.length, domainsFound: qualifiedDomains.size, addedToLeads: added };
  } catch (err) {
    await db.update(discoveryRunsTable).set({ status: "failed", errorMessage: String(err) })
      .where(eq(discoveryRunsTable.id, run.id));
    throw err;
  }
}
