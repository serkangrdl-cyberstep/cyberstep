/**
 * Shodan lead discovery.
 *
 * NOT: /shodan/host/search endpoint'i ÜCRETLI plan gerektirir (ücretsiz API key 401 döner).
 * Hesap planını kontrol et: https://account.shodan.io
 *
 * Ücretsiz plan için tek çalışan endpoint: /shodan/host/{ip}  (domain-scan/index.ts'de kullanılıyor)
 */
import axios from "axios";
import { db } from "@workspace/db";
import { discoveryRunsTable, leadCandidatesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { shouldExcludeFromPipeline } from "./leadScoringService";

export const SHODAN_FREE_QUERIES = [
  { q: "ssl.cert.subject.cn:.com.tr country:TR", label: "TR .com.tr SSL Sertifikaları", priority: 1 },
  { q: "ssl.cert.subject.cn:.net.tr country:TR", label: "TR .net.tr SSL Sertifikaları", priority: 2 },
  { q: "ssl.cert.subject.cn:.bel.tr country:TR", label: "TR .bel.tr Belediyeleri", priority: 2 },
  { q: 'country:TR http.title:"ERP" port:443', label: "TR ERP Sistemleri (Yüksek değer)", priority: 1 },
  { q: 'country:TR http.title:"Outlook Web App"', label: "TR Microsoft Exchange", priority: 2 },
  { q: 'country:TR product:"Fortinet" port:443', label: "TR Fortinet Cihazları", priority: 1 },
  { q: 'country:TR product:"VMware vSphere"', label: "TR VMware Altyapısı", priority: 2 },
  { q: 'country:TR http.title:"Giriş" port:443', label: "TR Giriş Sayfaları (Kurumsal)", priority: 3 },
  { q: "country:TR port:443 ssl org:.com.tr", label: "TR Kurumsal SSL (.com.tr org)", priority: 2 },
  // Türk ISP/ASN bazlı taramalar — Shodan paid plan gerektirir
  { q: "asn:AS9121 port:443 ssl", label: "Türk Telekom (AS9121) HTTPS", priority: 2 },
  { q: "asn:AS47331 port:443 ssl", label: "Turkcell (AS47331) HTTPS", priority: 2 },
  { q: "asn:AS34984 port:443 ssl", label: "Superonline (AS34984) HTTPS", priority: 2 },
  { q: "asn:AS43260 port:443 ssl", label: "Radore/DGN (AS43260) HTTPS", priority: 3 },
  { q: "asn:AS197328 port:443 ssl", label: "Vodafone TR (AS197328) HTTPS", priority: 3 },
  { q: "asn:AS201252 port:443 ssl", label: "Netdirekt (AS201252) HTTPS", priority: 3 },
  { q: "asn:AS8386 port:443 ssl",   label: "TTNet (AS8386) HTTPS", priority: 3 },
  { q: "asn:AS15924 port:443 ssl",  label: "Biznet/Hosting (AS15924) HTTPS", priority: 3 },
  { q: "asn:AS44565 port:443 ssl",  label: "Çözüm Park (AS44565) HTTPS", priority: 3 },
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

/**
 * Shodan plan seviyesini kontrol eder.
 * Free plan → "oss" veya "dev" planId döner.
 * Paid plan → "edu", "small-business", "corporate" vb.
 */
async function checkShodanPlan(apiKey: string): Promise<{ plan: string; queryCredits: number }> {
  const resp = await axios.get("https://api.shodan.io/api-info", {
    params: { key: apiKey },
    timeout: 10_000,
  });
  const data = resp.data as { plan?: string; query_credits?: number };
  return { plan: data.plan ?? "unknown", queryCredits: data.query_credits ?? 0 };
}

export async function scanShodanFree(queryIndex: number = 0, maxResults: number = 100): Promise<ShodanScanResult> {
  const apiKey = process.env["SHODAN_API_KEY"];
  if (!apiKey) {
    throw new Error("SHODAN_API_KEY bulunamadı. account.shodan.io → API Key → Replit Secrets'e ekle.");
  }

  const qConfig = SHODAN_FREE_QUERIES[queryIndex];
  if (!qConfig) throw new Error(`Shodan query ${queryIndex} bulunamadı`);

  // ── Plan kontrolü: ücretsiz hesaplar search endpoint'ini kullanamaz ──────────
  let planInfo: { plan: string; queryCredits: number };
  try {
    planInfo = await checkShodanPlan(apiKey);
  } catch (planErr: unknown) {
    const status = axios.isAxiosError(planErr) ? planErr.response?.status : null;
    if (status === 401) {
      throw new Error(
        "Shodan API key geçersiz veya süresi dolmuş (401). " +
        "account.shodan.io adresinden API key'i kontrol edin ve Replit Secrets'teki SHODAN_API_KEY değerini güncelleyin."
      );
    }
    throw new Error(`Shodan plan bilgisi alınamadı: ${String(planErr)}`);
  }

  // "oss" = Shodan ücretsiz/açık kaynak planı (Search API yok)
  // "dev" = Shodan Developer ücretli planı (Search API var) — buraya dahil ETMEYİN
  if (planInfo.plan.toLowerCase() === "oss") {
    logger.warn(
      { plan: planInfo.plan },
      "Shodan OSS (ücretsiz) plan — Search API kullanılamıyor, tarama atlanıyor. " +
      "account.shodan.io → Upgrade Plan ile ücretli plana geçin.",
    );
    return { runId: 0, label: qConfig.label, totalOnShodan: 0, processed: 0, addedToLeads: 0 };
  }

  if (planInfo.queryCredits <= 0) {
    logger.warn(
      { plan: planInfo.plan, queryCredits: planInfo.queryCredits },
      "Shodan sorgu kredisi tükenmiş — tarama atlanıyor. account.shodan.io → Usage üzerinden kontrol edin.",
    );
    return { runId: 0, label: qConfig.label, totalOnShodan: 0, processed: 0, addedToLeads: 0 };
  }

  const [run] = await db.insert(discoveryRunsTable).values({
    source: "shodan_free",
    runParams: { queryIndex, query: qConfig.q, label: qConfig.label, plan: planInfo.plan },
    status: "running",
  }).returning();

  try {
    logger.info({ queryIndex, label: qConfig.label, plan: planInfo.plan }, "Shodan scan starting");
    const response = await axios.get("https://api.shodan.io/shodan/host/search", {
      params: { key: apiKey, query: qConfig.q },
      timeout: 20_000,
    });

    const matches = ((response.data.matches as unknown[]) ?? []).slice(0, maxResults) as Array<Record<string, unknown>>;
    let added = 0;

    for (const match of matches) {
      const domain = extractDomainFromShodan(match);
      if (!domain) continue;

      const orgStr = (match.org as string | undefined) ?? null;
      const exclusion = shouldExcludeFromPipeline(domain, orgStr);
      if (exclusion.exclude) {
        logger.debug({ domain, reason: exclusion.reason }, "Shodan: domain eleme listesinde, atlanıyor");
        continue;
      }

      const ssl = match.ssl as { cert?: { subject?: { o?: string } } } | undefined;
      const companyName = ssl?.cert?.subject?.o || orgStr || null;
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
        isMunicipality: domain.endsWith(".bel.tr"),
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
  } catch (err: unknown) {
    const isAxios = axios.isAxiosError(err);
    const status = isAxios ? err.response?.status : null;
    const responseBody = isAxios ? err.response?.data : undefined;
    let errorMessage = String(err);

    logger.error(
      { queryIndex, query: qConfig.q, status, responseBody },
      "Shodan API error — tam hata detayi",
    );

    if (status === 401) {
      errorMessage = "Shodan 401: API key bu endpoint için yetkisiz.";
    } else if (status === 402) {
      errorMessage = "Shodan 402: Sorgu kredisi yetersiz.";
    } else if (status === 429) {
      errorMessage = "Shodan 429: Rate limit aşıldı.";
    } else if (status === 400) {
      const detail = typeof responseBody === "object" && responseBody !== null
        ? JSON.stringify(responseBody)
        : String(responseBody ?? "");
      errorMessage = `Shodan 400: Geçersiz sorgu sözdizimi — ${detail}`;
    } else if (status != null && status >= 500) {
      const detail = typeof responseBody === "object" && responseBody !== null
        ? JSON.stringify(responseBody)
        : String(responseBody ?? "geçici sunucu hatası");
      errorMessage = `Shodan ${status}: Shodan sunucu hatası — ${detail}`;
      await db.update(discoveryRunsTable).set({ status: "failed", errorMessage })
        .where(eq(discoveryRunsTable.id, run.id));
      return { runId: run.id, label: qConfig.label, totalOnShodan: 0, processed: 0, addedToLeads: 0 };
    }

    await db.update(discoveryRunsTable).set({ status: "failed", errorMessage })
      .where(eq(discoveryRunsTable.id, run.id));
    throw new Error(errorMessage);
  }
}
