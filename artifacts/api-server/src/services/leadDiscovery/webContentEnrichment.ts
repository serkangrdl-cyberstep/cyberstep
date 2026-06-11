/**
 * Web Content Enrichment
 * 1) Liveness check — HTTP status + response time
 * 2) Content scraping — phone, address, company name from homepage + contact pages
 *
 * Extends / complements webContactScraper (email).
 * Uses only built-in fetch; no extra deps.
 */
import { db } from "@workspace/db";
import { leadCandidatesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";

const CONTACT_PATHS = [
  "/",
  "/iletisim",
  "/contact",
  "/hakkimizda",
  "/about",
  "/bize-ulasin",
  "/tr/iletisim",
  "/iletisim.html",
  "/contact.html",
];

// Turkish phone: +90 5xx xxx xx xx  |  0 5xx xxx xx xx  |  (0xxx) xxx xx xx
const PHONE_RE = /(?:tel:|href="tel:|\b)(\+90[\s.\-]?[2-5]\d{2}[\s.\-]?\d{3}[\s.\-]?\d{2}[\s.\-]?\d{2}|0[\s.\-]?[2-5]\d{2}[\s.\-]?\d{3}[\s.\-]?\d{2}[\s.\-]?\d{2})/gi;
const TEL_HREF_RE = /href="tel:([^"]+)"/gi;

function cleanPhone(raw: string): string {
  return raw.replace(/[^\d+]/g, "").replace(/^00/, "+");
}

function extractPhone(html: string): string | null {
  // Prefer tel: href links — most reliable
  const telMatches: string[] = [];
  let m: RegExpExecArray | null;
  const reTel = new RegExp(TEL_HREF_RE.source, "gi");
  while ((m = reTel.exec(html)) !== null) {
    if (m[1]) telMatches.push(m[1].trim());
  }
  if (telMatches.length > 0) return cleanPhone(telMatches[0]!);

  // Fallback: regex pattern match
  const rePhone = new RegExp(PHONE_RE.source, "gi");
  const phoneMatches: string[] = [];
  while ((m = rePhone.exec(html)) !== null) {
    const val = (m[1] ?? m[0]).trim();
    if (val.replace(/\D/g, "").length >= 10) phoneMatches.push(val);
  }
  if (phoneMatches.length > 0) return cleanPhone(phoneMatches[0]!);
  return null;
}

function extractCompanyName(html: string): string | null {
  // 1. og:site_name
  const ogSite = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']{2,80})["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']{2,80})["'][^>]+property=["']og:site_name["']/i);
  if (ogSite?.[1]) return ogSite[1].trim();

  // 2. <title> — take the part before first | or - separator
  const title = html.match(/<title>([^<]{2,120})<\/title>/i);
  if (title?.[1]) {
    const part = title[1].split(/[|\-–—]/)[0]?.trim();
    if (part && part.length >= 2 && part.length <= 80) return part;
  }

  // 3. og:title
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']{2,80})["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']{2,80})["'][^>]+property=["']og:title["']/i);
  if (ogTitle?.[1]) return ogTitle[1].split(/[|\-–—]/)[0]?.trim() ?? null;

  return null;
}

function extractAddress(html: string): string | null {
  // 1. schema.org PostalAddress
  const schemaMatch = html.match(/"streetAddress"\s*:\s*"([^"]{5,150})"/i);
  if (schemaMatch?.[1]) return schemaMatch[1].trim();

  // 2. <address> tag content (strip tags)
  const addrTag = html.match(/<address[^>]*>([\s\S]{10,300}?)<\/address>/i);
  if (addrTag?.[1]) {
    const clean = addrTag[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (clean.length >= 10) return clean.slice(0, 200);
  }

  // 3. Content near "adres" keyword
  const adresIdx = html.toLowerCase().indexOf("adres");
  if (adresIdx !== -1) {
    const snippet = html.slice(adresIdx, adresIdx + 300).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const lines = snippet.split(/[.\n]/)[0]?.trim();
    if (lines && lines.length >= 10 && lines.length <= 200) return lines;
  }

  return null;
}

export interface LivenessResult {
  httpStatus: number;
  isAlive: boolean;
  responseTimeMs: number;
  finalUrl?: string;
}

export async function checkLiveness(domain: string): Promise<LivenessResult> {
  const urls = [`https://${domain}`, `http://${domain}`];
  for (const url of urls) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const start = Date.now();
    try {
      const res = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
        redirect: "follow",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; CyberStep-Check/1.0)" },
      });
      clearTimeout(timer);
      const ms = Date.now() - start;
      return {
        httpStatus: res.status,
        isAlive: res.status < 400,
        responseTimeMs: ms,
        finalUrl: res.url,
      };
    } catch {
      clearTimeout(timer);
    }
  }
  return { httpStatus: 0, isAlive: false, responseTimeMs: 0 };
}

export interface WebEnrichResult {
  phone: string | null;
  address: string | null;
  companyName: string | null;
}

async function fetchPage(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CyberStep-Enrichment/1.0)",
        "Accept": "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    clearTimeout(timer);
    return null;
  }
}

export async function scrapeWebEnrich(domain: string): Promise<WebEnrichResult> {
  let phone: string | null = null;
  let address: string | null = null;
  let companyName: string | null = null;

  for (const path of CONTACT_PATHS) {
    const url = `https://${domain}${path}`;
    const html = await fetchPage(url);
    if (!html) continue;

    if (!phone) phone = extractPhone(html);
    if (!address) address = extractAddress(html);
    if (!companyName && path === "/") companyName = extractCompanyName(html);

    if (phone && address && companyName) break;
  }

  return { phone, address, companyName };
}

export async function enrichLeadFromWeb(leadId: number, domain: string): Promise<void> {
  // 1. Liveness
  const liveness = await checkLiveness(domain);

  // 2. Content scrape only if alive
  let scraped: WebEnrichResult = { phone: null, address: null, companyName: null };
  if (liveness.isAlive) {
    scraped = await scrapeWebEnrich(domain);
  }

  // 3. Persist
  await db.execute(sql`
    UPDATE lead_candidates SET
      http_status       = ${liveness.httpStatus},
      is_alive          = ${liveness.isAlive},
      response_time_ms  = ${liveness.responseTimeMs},
      scraped_phone     = ${scraped.phone},
      scraped_address   = ${scraped.address},
      scraped_company_name = ${scraped.companyName},
      web_scraped_at    = NOW(),
      updated_at        = NOW()
    WHERE id = ${leadId}
  `);

  logger.info(
    { leadId, domain, isAlive: liveness.isAlive, httpStatus: liveness.httpStatus, phone: !!scraped.phone, addr: !!scraped.address },
    "Web enrich tamamlandı",
  );
}
