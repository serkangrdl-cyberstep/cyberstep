/**
 * IOC Sorgu Adaptörleri — Harici API çağrıları
 * Her fonksiyon null döndürür (API key yoksa veya hata varsa)
 */

import dns from "dns/promises";
import { logger } from "../lib/logger";

// ─── SHODAN IP ─────────────────────────────────────────────────────────────────

export async function queryShodan(ip: string): Promise<Record<string, unknown> | null> {
  const key = process.env["SHODAN_API_KEY"];
  if (!key) return null;
  try {
    const { default: axios } = await import("axios");
    const res = await axios.get(`https://api.shodan.io/shodan/host/${encodeURIComponent(ip)}`, {
      params: { key }, timeout: 12000,
    });
    return {
      ports:       res.data.ports || [],
      hostnames:   res.data.hostnames || [],
      org:         res.data.org,
      country:     res.data.country_name,
      isp:         res.data.isp,
      last_update: res.data.last_update,
      vulns:       res.data.vulns ? Object.keys(res.data.vulns) : [],
      tags:        res.data.tags || [],
    };
  } catch (err: unknown) {
    if ((err as { response?: { status?: number } }).response?.status !== 404) {
      logger.warn({ err }, "Shodan query error");
    }
    return null;
  }
}

// ─── SHODAN DOMAIN (DNS → IP) ──────────────────────────────────────────────────

export async function queryShodanDomain(domain: string): Promise<Record<string, unknown> | null> {
  try {
    const ips = await dns.resolve4(domain);
    if (!ips[0]) return null;
    return await queryShodan(ips[0]);
  } catch {
    return null;
  }
}

// ─── ABUSEIPDB ────────────────────────────────────────────────────────────────

export async function queryAbuseIPDB(ip: string): Promise<Record<string, unknown> | null> {
  const key = process.env["ABUSEIPDB_API_KEY"];
  if (!key) return null;
  try {
    const { default: axios } = await import("axios");
    const res = await axios.get("https://api.abuseipdb.com/api/v2/check", {
      headers: { Key: key, Accept: "application/json" },
      params:  { ipAddress: ip, maxAgeInDays: 90, verbose: true },
      timeout: 10000,
    });
    const d = res.data.data;
    return {
      abuse_confidence_score: d.abuseConfidenceScore,
      total_reports:          d.totalReports,
      last_reported_at:       d.lastReportedAt,
      country:                d.countryCode,
      isp:                    d.isp,
      usage_type:             d.usageType,
      is_tor:                 d.isTor,
      reports: (d.reports || []).slice(0, 5).map((r: Record<string, unknown>) => ({
        categories:  r["categories"],
        reported_at: r["reportedAt"],
        comment:     typeof r["comment"] === "string" ? r["comment"].slice(0, 200) : null,
      })),
    };
  } catch (err) {
    logger.warn({ err }, "AbuseIPDB query error");
    return null;
  }
}

// ─── VIRUSTOTAL ───────────────────────────────────────────────────────────────

export async function queryVirusTotal(
  value: string,
  type: "ip" | "domain" | "url" | "hash",
): Promise<Record<string, unknown> | null> {
  const key = process.env["VIRUSTOTAL_API_KEY"];
  if (!key) return null;
  try {
    const { default: axios } = await import("axios");
    const endpoints: Record<string, string> = {
      ip:     `https://www.virustotal.com/api/v3/ip_addresses/${encodeURIComponent(value)}`,
      domain: `https://www.virustotal.com/api/v3/domains/${encodeURIComponent(value)}`,
      hash:   `https://www.virustotal.com/api/v3/files/${value}`,
      url:    `https://www.virustotal.com/api/v3/urls/${Buffer.from(value).toString("base64url")}`,
    };
    const res = await axios.get(endpoints[type], {
      headers: { "x-apikey": key },
      timeout: 15000,
    });
    const stats = (res.data.data?.attributes?.last_analysis_stats as Record<string, number>) || {};
    return {
      malicious:     stats["malicious"] || 0,
      suspicious:    stats["suspicious"] || 0,
      clean:         stats["undetected"] || 0,
      total_engines: Object.values(stats).reduce((a, b) => a + b, 0),
      reputation:    res.data.data?.attributes?.reputation,
      categories:    res.data.data?.attributes?.categories,
      tags:          res.data.data?.attributes?.tags || [],
      last_analysis_date: res.data.data?.attributes?.last_analysis_date,
    };
  } catch (err) {
    logger.warn({ err, type, value: value.slice(0, 30) }, "VirusTotal query error");
    return null;
  }
}

// ─── GREYNOISE ────────────────────────────────────────────────────────────────

export async function queryGreyNoise(ip: string): Promise<Record<string, unknown> | null> {
  const key = process.env["GREYNOISE_API_KEY"];
  if (!key) return null;
  try {
    const { default: axios } = await import("axios");
    const res = await axios.get(`https://api.greynoise.io/v3/community/${encodeURIComponent(ip)}`, {
      headers: { key }, timeout: 8000,
    });
    return {
      noise:          res.data.noise,
      riot:           res.data.riot,
      classification: res.data.classification,
      name:           res.data.name,
      link:           res.data.link,
      last_seen:      res.data.last_seen,
      message:        res.data.message,
    };
  } catch (err: unknown) {
    if ((err as { response?: { status?: number } }).response?.status === 404) {
      return { noise: false, riot: false, classification: "unknown" };
    }
    logger.warn({ err }, "GreyNoise query error");
    return null;
  }
}

// ─── THREATFOX ────────────────────────────────────────────────────────────────

export async function queryThreatFox(
  iocType: "ip" | "domain" | "hash" | "url",
  value: string,
): Promise<Record<string, unknown> | null> {
  try {
    const { default: axios } = await import("axios");
    const res = await axios.post(
      "https://threatfox-api.abuse.ch/api/v1/",
      { query: "search_ioc", search_term: value },
      { timeout: 10000 },
    );
    if (res.data.query_status !== "ok") return { found: false };
    const data: Record<string, unknown>[] = (res.data.data || []).slice(0, 5);
    return {
      found: data.length > 0,
      iocs: data.map((d) => ({
        threat_type: d["threat_type"],
        malware:     d["malware"],
        confidence:  d["confidence_level"],
        first_seen:  d["first_seen"],
        last_seen:   d["last_seen"],
        reporter:    d["reporter"],
      })),
    };
  } catch (err) {
    logger.warn({ err, iocType }, "ThreatFox query error");
    return null;
  }
}

// ─── URLHAUS ──────────────────────────────────────────────────────────────────

export async function queryURLhaus(value: string): Promise<Record<string, unknown> | null> {
  try {
    const { default: axios } = await import("axios");
    const res = await axios.post(
      "https://urlhaus-api.abuse.ch/v1/host/",
      `host=${encodeURIComponent(value)}`,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 10000 },
    );
    return {
      found:      res.data.query_status === "is_host",
      urls_count: res.data.urls?.length || 0,
      urls: (res.data.urls || []).slice(0, 3).map((u: Record<string, unknown>) => ({
        url:        u["url"],
        status:     u["url_status"],
        threat:     u["threat"],
        date_added: u["date_added"],
      })),
    };
  } catch (err) {
    logger.warn({ err }, "URLhaus query error");
    return null;
  }
}

// ─── MALWAREBAZAAR ────────────────────────────────────────────────────────────

export async function queryMalwareBazaar(hash: string): Promise<Record<string, unknown> | null> {
  try {
    const { default: axios } = await import("axios");
    const res = await axios.post(
      "https://mb-api.abuse.ch/api/v1/",
      `query=get_info&hash=${hash}`,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 10000 },
    );
    if (res.data.query_status !== "ok") return { found: false };
    const data = (res.data.data as Record<string, unknown>[])?.[0];
    if (!data) return { found: false };
    return {
      found:           true,
      file_type:       data["file_type"],
      file_size:       data["file_size"],
      signature:       data["signature"],
      tags:            data["tags"] || [],
      first_seen:      data["first_seen"],
      last_seen:       data["last_seen"],
      vendor_intel:    data["vendor_intel"],
      delivery_method: data["delivery_method"],
    };
  } catch (err) {
    logger.warn({ err }, "MalwareBazaar query error");
    return null;
  }
}

// ─── FEODO TRACKER ────────────────────────────────────────────────────────────

export async function queryFeodoTracker(ip: string): Promise<Record<string, unknown>> {
  try {
    const { default: axios } = await import("axios");
    const res = await axios.get(
      "https://feodotracker.abuse.ch/downloads/ipblocklist.json",
      { timeout: 10000 },
    );
    const list: Array<Record<string, unknown>> = Array.isArray(res.data) ? res.data : [];
    const match = list.find((e) => e["ip_address"] === ip);
    if (!match) return { is_c2: false };
    return {
      is_c2:       true,
      malware:     match["malware"],
      status:      match["status"],
      first_seen:  match["first_seen"],
      last_online: match["last_online"],
      country:     match["country"],
    };
  } catch {
    return { is_c2: false };
  }
}

// ─── WHOIS (node built-in DNS fallback) ───────────────────────────────────────

export async function queryWHOIS(domain: string): Promise<Record<string, unknown> | null> {
  try {
    // Use WHOIS via rdap.org (no package needed)
    const { default: axios } = await import("axios");
    const res = await axios.get(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      timeout: 8000,
      headers: { Accept: "application/json" },
    });
    const events: Array<{ eventAction: string; eventDate: string }> = res.data.events || [];
    const registration = events.find((e) => e.eventAction === "registration");
    const expiration   = events.find((e) => e.eventAction === "expiration");
    const entities: Array<{ roles: string[]; vcardArray: Array<Array<unknown>> }> = res.data.entities || [];
    const registrarEntity = entities.find((e) => e.roles?.includes("registrar"));
    const vcardRow1 = registrarEntity?.vcardArray?.[1];
    const fnEntry = Array.isArray(vcardRow1) ? vcardRow1.find(
      (v: unknown) => Array.isArray(v) && (v as unknown[])[0] === "fn",
    ) as unknown[] | undefined : undefined;
    const registrar = fnEntry ? (fnEntry[3] as string | undefined) : undefined;

    const createdDate = registration?.eventDate ? new Date(registration.eventDate) : null;
    return {
      created_date:    registration?.eventDate || null,
      expiry_date:     expiration?.eventDate || null,
      registrar:       registrar || null,
      domain_age_days: createdDate
        ? Math.floor((Date.now() - createdDate.getTime()) / 86400000)
        : null,
    };
  } catch (err) {
    logger.warn({ err }, "WHOIS query error");
    return null;
  }
}

// ─── GOOGLE SAFE BROWSING ─────────────────────────────────────────────────────

export async function queryGoogleSafeBrowsing(url: string): Promise<Record<string, unknown> | null> {
  const key = process.env["GOOGLE_SAFE_BROWSING_API_KEY"];
  if (!key) return null;
  try {
    const { default: axios } = await import("axios");
    const res = await axios.post(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${key}`,
      {
        client:     { clientId: "cyberstep", clientVersion: "1.0" },
        threatInfo: {
          threatTypes:     ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
          platformTypes:   ["ANY_PLATFORM"],
          threatEntryTypes:["URL"],
          threatEntries:   [{ url }],
        },
      },
      { timeout: 8000 },
    );
    return {
      threats:  res.data.matches || [],
      is_safe:  !res.data.matches?.length,
    };
  } catch (err) {
    logger.warn({ err }, "Google Safe Browsing query error");
    return null;
  }
}
