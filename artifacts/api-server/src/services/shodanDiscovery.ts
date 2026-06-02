/**
 * Shodan Free tier lead discovery.
 * Free API key: account.shodan.io → Register → API Key (2 min)
 * Rate: 100 results/search, unlimited searches.
 */
import axios from "axios";
import { db } from "@workspace/db";
import { discoveryRunsTable, leadCandidatesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

export const SHODAN_FREE_QUERIES = [
  { q: "ssl.cert.subject.cn:*.com.tr country:TR", label: "TR .com.tr SSL Sertifikaları", priority: 1 },
  { q: "ssl.cert.subject.cn:*.net.tr country:TR", label: "TR .net.tr SSL Sertifikaları", priority: 2 },
  { q: 'country:TR "ERP" http.title port:443', label: "TR ERP Sistemleri (Yüksek değer)", priority: 1 },
  { q: 'country:TR "Outlook Web" http.title', label: "TR Microsoft Exchange", priority: 2 },
  { q: 'country:TR "Fortinet" OR "FortiGate" port:443', label: "TR Fortinet Cihazları", priority: 1 },
  { q: 'country:TR product:"VMware vSphere"', label: "TR VMware Altyapısı", priority: 2 },
  { q: 'country:TR http.title:"Giriş" port:443 ssl', label: "TR Giriş Sayfaları (Kurumsal)", priority: 3 },
  { q: "ssl.cert.subject.o:* country:TR port:443", label: "TR Kurumsal SSL (Organizasyonlu)", priority: 2 },
];

function extractRootDomain(hostname: string): string {
  const parts = hostname.split(".");
  if (parts[parts.length - 1] === "tr" && parts.length >= 3) return parts.slice(-3).join(".");
  return parts.slice(-2).join(".");
}

function extractDomainFromShodan(match: Record<string, unknown>): string | null {
  const ssl = match.ssl as { cert?: { subject?: { cn?: string } } } | undefined;
  const cn = ssl?.cert?.subject?.cn;
  if (cn && typeof cn === "string" && cn.endsWith(".tr")) return extractRootDomain(cn.replace(/^\*\./, ""));

  const hostnames = match.hostnames as string[] | undefined;
  for (const h of hostnames ?? []) {
    if (h.endsWith(".tr")) return extractRootDomain(h);
  }

  const domains = match.domains as string[] | undefined;
  for (const d of domains ?? []) {
    if (d.endsWith(".tr")) return d;
  }
  return null;
}

function inferSector(match: Record<string, unknown>): string {
  const http = match.http as { title?: string } | undefined;
  const text = [http?.title, match.product, match.org, (match.tags as string[] ?? []).join(" ")].join(" ").toLowerCase();
  if (text.includes("bank") || text.includes("finans")) return "finans";
  if (text.includes("hastane") || text.includes("saglik")) return "saglik";
  if (text.includes("fabrika") || text.includes("uretim") || text.includes("scada")) return "uretim";
  if (text.includes("lojistik") || text.includes("kargo")) return "lojistik";
  if (text.includes("shop") || text.includes("magaza")) return "eticaret";
  return "teknoloji";
}

function cleanCompanyName(name: string | null | undefined): string | null {
  if (!name) return null;
  return name.replace(/\b(AS|A\.S\.|Ltd\.|Inc\.|Corp\.?|LLC)\b/gi, "").trim() || null;
}

export interface ShodanScanResult {
  runId: number;
  label: string;
  totalOnShodan: number;
  processed: number;
  addedToLeads: number;
}

export async function scanShodanFree(queryIndex: number = 0, maxResults: number = 100): Promise<ShodanScanResult> {
  const apiKey = process.env["SHODAN_API_KEY"];
  if (!apiKey) {
    throw new Error("SHODAN_API_KEY bulunamadı. account.shodan.io → Register → API Key → Replit Secrets'e ekle.");
  }

  const qConfig = SHODAN_FREE_QUERIES[queryIndex];
  if (!qConfig) throw new Error(`Shodan query ${queryIndex} bulunamadı`);

  const [run] = await db.insert(discoveryRunsTable).values({
    source: "shodan_free",
    runParams: { queryIndex, query: qConfig.q, label: qConfig.label },
    status: "running",
  }).returning();

  try {
    logger.info({ queryIndex, label: qConfig.label }, "Shodan scan starting");
    const response = await axios.get("https://api.shodan.io/shodan/host/search", {
      params: { key: apiKey, query: qConfig.q },
      timeout: 20_000,
    });

    const matches = ((response.data.matches as unknown[]) ?? []).slice(0, maxResults) as Array<Record<string, unknown>>;
    let added = 0;

    for (const match of matches) {
      const domain = extractDomainFromShodan(match);
      if (!domain) continue;

      const ssl = match.ssl as { cert?: { subject?: { o?: string } } } | undefined;
      const companyName = ssl?.cert?.subject?.o || (match.org as string | undefined) || null;
      const sector = inferSector(match);
      const http = match.http as { title?: string } | undefined;
      const isFortigate = ((match.product as string ?? "") + (http?.title ?? "")).toLowerCase().includes("forti");

      await db.insert(leadCandidatesTable).values({
        domain,
        companyName: cleanCompanyName(companyName),
        sector,
        city: (match.location as { city?: string } | undefined)?.city ?? null,
        source: "shodan_free",
        sourceData: {
          ip: match.ip_str,
          org: match.org,
          port: match.port,
          product: match.product,
          httpTitle: http?.title,
          shodanQuery: qConfig.label,
        },
        hasFortigate: isFortigate,
        scanStatus: "pending",
      }).onConflictDoUpdate({
        target: leadCandidatesTable.domain,
        set: {
          companyName: sql`COALESCE(lead_candidates.company_name, excluded.company_name)`,
          city: sql`COALESCE(lead_candidates.city, excluded.city)`,
          hasFortigate: sql`lead_candidates.has_fortigate OR excluded.has_fortigate`,
        },
      }).returning().then((r) => { if (r.length > 0) added++; });
    }

    await db.update(discoveryRunsTable).set({
      status: "completed",
      totalFound: response.data.total as number ?? matches.length,
      totalAdded: added,
      completedAt: new Date(),
    }).where(eq(discoveryRunsTable.id, run.id));

    logger.info({ runId: run.id, added }, "Shodan scan done");
    return { runId: run.id, label: qConfig.label, totalOnShodan: (response.data.total as number) ?? 0, processed: matches.length, addedToLeads: added };
  } catch (err) {
    await db.update(discoveryRunsTable).set({ status: "failed", errorMessage: String(err) })
      .where(eq(discoveryRunsTable.id, run.id));
    throw err;
  }
}
