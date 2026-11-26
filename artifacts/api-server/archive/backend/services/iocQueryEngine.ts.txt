/**
 * IOC Sorgu Motoru — Ana Orkestratör
 */

import { db } from "@workspace/db";
import { iocQueriesTable } from "@workspace/db";
import { eq, and, gte, desc } from "drizzle-orm";
import { getClaudeAiFn } from "./ai-client";
import { logger } from "../lib/logger";
import {
  queryShodan,
  queryShodanDomain,
  queryAbuseIPDB,
  queryVirusTotal,
  queryGreyNoise,
  queryThreatFox,
  queryURLhaus,
  queryMalwareBazaar,
  queryFeodoTracker,
  queryWHOIS,
  queryGoogleSafeBrowsing,
} from "./iocQueryAdapters";

// ─── Tip tespiti ──────────────────────────────────────────────────────────────

export function detectQueryType(
  value: string,
): "ip" | "domain" | "hash" | "url" | "email" | "unknown" {
  const v = value.trim();
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(v)) return "ip";
  if (/^[0-9a-fA-F:]{7,}$/.test(v) && v.includes(":")) return "ip";
  if (/^[0-9a-fA-F]{32}$/.test(v)) return "hash";
  if (/^[0-9a-fA-F]{40}$/.test(v)) return "hash";
  if (/^[0-9a-fA-F]{64}$/.test(v)) return "hash";
  if (v.startsWith("http://") || v.startsWith("https://")) return "url";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "email";
  if (/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/.test(v)) return "domain";
  return "unknown";
}

// ─── 24 saatlik cache kontrolü ───────────────────────────────────────────────

export async function getCachedResult(
  queryType: string,
  queryValue: string,
): Promise<typeof iocQueriesTable.$inferSelect | null> {
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const [cached] = await db
    .select()
    .from(iocQueriesTable)
    .where(
      and(
        eq(iocQueriesTable.queryType, queryType),
        eq(iocQueriesTable.queryValue, queryValue),
        eq(iocQueriesTable.status, "completed"),
        gte(iocQueriesTable.createdAt, since),
      ),
    )
    .orderBy(desc(iocQueriesTable.createdAt))
    .limit(1);
  return cached ?? null;
}

// ─── Ana sorgu orkestrasyonu ──────────────────────────────────────────────────

export async function runIOCQuery(
  queryId: number,
  queryType: string,
  queryValue: string,
): Promise<void> {
  const startTime = Date.now();

  await db.update(iocQueriesTable).set({ status: "processing" })
    .where(eq(iocQueriesTable.id, queryId));

  try {
    const results: Record<string, Record<string, unknown> | null> = {};

    if (queryType === "ip") {
      const [shodan, abuseipdb, virustotal, greynoise, threatfox, feodo] =
        await Promise.allSettled([
          queryShodan(queryValue),
          queryAbuseIPDB(queryValue),
          queryVirusTotal(queryValue, "ip"),
          queryGreyNoise(queryValue),
          queryThreatFox("ip", queryValue),
          queryFeodoTracker(queryValue),
        ]);
      results["shodan"]     = shodan.status     === "fulfilled" ? shodan.value     : null;
      results["abuseipdb"]  = abuseipdb.status  === "fulfilled" ? abuseipdb.value  : null;
      results["virustotal"] = virustotal.status  === "fulfilled" ? virustotal.value : null;
      results["greynoise"]  = greynoise.status   === "fulfilled" ? greynoise.value  : null;
      results["threatfox"]  = threatfox.status   === "fulfilled" ? threatfox.value  : null;
      results["feodo"]      = feodo.status       === "fulfilled" ? feodo.value      : null;
    }

    else if (queryType === "domain") {
      const [virustotal, urlhaus, threatfox, whois, shodan] =
        await Promise.allSettled([
          queryVirusTotal(queryValue, "domain"),
          queryURLhaus(queryValue),
          queryThreatFox("domain", queryValue),
          queryWHOIS(queryValue),
          queryShodanDomain(queryValue),
        ]);
      results["virustotal"] = virustotal.status === "fulfilled" ? virustotal.value : null;
      results["urlhaus"]    = urlhaus.status    === "fulfilled" ? urlhaus.value    : null;
      results["threatfox"]  = threatfox.status  === "fulfilled" ? threatfox.value  : null;
      results["whois"]      = whois.status      === "fulfilled" ? whois.value      : null;
      results["shodan"]     = shodan.status     === "fulfilled" ? shodan.value     : null;
    }

    else if (queryType === "hash") {
      const [virustotal, malwarebazaar, threatfox] =
        await Promise.allSettled([
          queryVirusTotal(queryValue, "hash"),
          queryMalwareBazaar(queryValue),
          queryThreatFox("hash", queryValue),
        ]);
      results["virustotal"]    = virustotal.status    === "fulfilled" ? virustotal.value    : null;
      results["malwarebazaar"] = malwarebazaar.status === "fulfilled" ? malwarebazaar.value : null;
      results["threatfox"]     = threatfox.status     === "fulfilled" ? threatfox.value     : null;
    }

    else if (queryType === "url") {
      let domain = queryValue;
      try { domain = new URL(queryValue).hostname; } catch { /* keep as-is */ }
      const [virustotal, urlhaus, safebrowsing] =
        await Promise.allSettled([
          queryVirusTotal(queryValue, "url"),
          queryURLhaus(domain),
          queryGoogleSafeBrowsing(queryValue),
        ]);
      results["virustotal"]   = virustotal.status   === "fulfilled" ? virustotal.value   : null;
      results["urlhaus"]      = urlhaus.status      === "fulfilled" ? urlhaus.value      : null;
      results["safebrowsing"] = safebrowsing.status === "fulfilled" ? safebrowsing.value : null;
    }

    const aiAnalysis = await analyzeWithClaude(queryType, queryValue, results);

    await db.update(iocQueriesTable).set({
      shodanResult:         results["shodan"] ?? null,
      virustotalResult:     results["virustotal"] ?? null,
      abuseipdbResult:      results["abuseipdb"] ?? null,
      greynoiseResult:      results["greynoise"] ?? null,
      threatfoxResult:      results["threatfox"] ?? null,
      urlhausResult:        results["urlhaus"] ?? null,
      malwarebazaarResult:  results["malwarebazaar"] ?? null,
      whoisResult:          results["whois"] ?? null,
      feodoResult:          results["feodo"] ?? null,
      threatLevel:          aiAnalysis.threatLevel,
      threatScore:          aiAnalysis.threatScore,
      aiSummary:            aiAnalysis.summary,
      aiRecommendations:    aiAnalysis.recommendations,
      indicators:           aiAnalysis.indicators,
      status:               "completed",
      processingTimeMs:     Date.now() - startTime,
      completedAt:          new Date(),
    }).where(eq(iocQueriesTable.id, queryId));

    logger.info({ queryId, queryType, processingMs: Date.now() - startTime }, "IOC sorgusu tamamlandı");

  } catch (err) {
    logger.error({ err, queryId }, "IOC sorgusu hatası");
    await db.update(iocQueriesTable).set({
      status:       "error",
      errorMessage: String(err),
    }).where(eq(iocQueriesTable.id, queryId));
  }
}

// ─── Claude analizi ───────────────────────────────────────────────────────────

async function analyzeWithClaude(
  queryType: string,
  queryValue: string,
  results: Record<string, unknown>,
): Promise<{
  threatLevel: string;
  threatScore: number;
  summary: string;
  recommendations: unknown[];
  indicators: unknown[];
}> {
  try {
    const ai = getClaudeAiFn("ioc-query");
    const prompt = `Sen bir siber güvenlik analistisin. Türk işletmelere danışmanlık yapıyorsun.
Aşağıdaki IOC sorgu sonuçlarını analiz et.

Sorgulanan: ${queryValue} (tip: ${queryType})

Sonuçlar:
${JSON.stringify(results, null, 2).slice(0, 5000)}

JSON formatında yanıt ver:
{
  "threat_level": "critical|high|medium|low|clean",
  "threat_score": 0-100,
  "summary": "2-3 cümle Türkçe özet. Teknik değil, yönetici dili.",
  "indicators": [{"source": "kaynak", "finding": "ne bulundu", "severity": "critical|high|medium|low"}],
  "recommendations": [{"priority": "immediate|soon|monitor", "action": "ne yapılmalı", "explanation": "neden"}]
}

Kural: Türkçe yaz. Teknik jargon kullanma. Eylem odaklı öner. Sadece JSON döndür.`;

    const response = await ai(prompt);
    const parsed = JSON.parse(response.replace(/```json|```/g, "").trim()) as {
      threat_level?: string;
      threat_score?: number;
      summary?: string;
      recommendations?: unknown[];
      indicators?: unknown[];
    };
    return {
      threatLevel:     parsed.threat_level || "unknown",
      threatScore:     parsed.threat_score || 0,
      summary:         parsed.summary || "",
      recommendations: parsed.recommendations || [],
      indicators:      parsed.indicators || [],
    };
  } catch {
    return {
      threatLevel: "unknown",
      threatScore: 0,
      summary:     "Analiz tamamlanamadı.",
      recommendations: [],
      indicators:  [],
    };
  }
}

// ─── Kaynak özeti ─────────────────────────────────────────────────────────────

export function buildSourceSummary(query: typeof iocQueriesTable.$inferSelect): Record<string, boolean> {
  return {
    shodan:      !!query.shodanResult,
    virustotal:  !!query.virustotalResult,
    abuseipdb:   !!query.abuseipdbResult,
    greynoise:   !!query.greynoiseResult,
    threatfox:   !!query.threatfoxResult,
    urlhaus:     !!query.urlhausResult,
    malwarebazaar: !!query.malwarebazaarResult,
    whois:       !!query.whoisResult,
    feodo:       !!query.feodoResult,
  };
}
