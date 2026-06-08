import axios from "axios";
import { logger } from "../lib/logger";

export interface OSINTData {
  websiteTitle: string;
  metaDescription: string;
  technologyStack: string[];
  emailPatterns: string[];
  namedExecutives: string[];
  linkedinUrl: string;
  domainAge: number | null;
  sslIssuer: string;
  mxProvider: string;
  haveIBeenPwnedCount: number;
  spfConfigured: boolean;
  dmarcConfigured: boolean;
  jobKeywords: string[];
}

export async function collectOSINT(domain: string): Promise<OSINTData> {
  const result: OSINTData = {
    websiteTitle: "",
    metaDescription: "",
    technologyStack: [],
    emailPatterns: [],
    namedExecutives: [],
    linkedinUrl: "",
    domainAge: null,
    sslIssuer: "",
    mxProvider: "",
    haveIBeenPwnedCount: 0,
    spfConfigured: false,
    dmarcConfigured: false,
    jobKeywords: [],
  };

  // 1. Website scraping
  try {
    const resp = await axios.get(`https://${domain}`, {
      timeout: 8000,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CyberStepBot/1.0 +https://cyberstep.io)" },
      maxRedirects: 3,
    });
    const html: string = resp.data;
    const headers = resp.headers as Record<string, string>;

    result.websiteTitle = html.match(/<title[^>]*>(.*?)<\/title>/i)?.[1]?.trim().substring(0, 100) ?? "";
    result.metaDescription = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i)?.[1]?.trim().substring(0, 300) ?? "";
    result.technologyStack = detectTechStack(html, headers);

    const emailMatches = (html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? []) as string[];
    result.emailPatterns = [...new Set(emailMatches.filter(e => e.includes(domain)).slice(0, 5))];
    result.namedExecutives = extractNamedPeople(html);

    // Detect LinkedIn link
    const liMatch = html.match(/linkedin\.com\/company\/([a-zA-Z0-9-]+)/);
    if (liMatch) result.linkedinUrl = `https://linkedin.com/company/${liMatch[1]}`;

    // SSL issuer from headers
    result.sslIssuer = (headers["server"] ?? "").substring(0, 50);
    result.mxProvider = detectMxProvider(headers);
  } catch (err) {
    logger.warn({ domain, err: String(err) }, "OSINT website scrape failed");
  }

  // 2. DNS checks (SPF / DMARC) via DNS lookup
  try {
    const { Resolver } = await import("node:dns/promises");
    const resolver = new Resolver();
    resolver.setServers(["8.8.8.8"]);

    // SPF
    try {
      const txtRecords = await resolver.resolveTxt(domain);
      result.spfConfigured = txtRecords.some(r => r.join("").toLowerCase().startsWith("v=spf1"));
    } catch { /* ignore */ }

    // DMARC
    try {
      const dmarcRecords = await resolver.resolveTxt(`_dmarc.${domain}`);
      result.dmarcConfigured = dmarcRecords.some(r => r.join("").toLowerCase().startsWith("v=dmarc1"));
    } catch { /* ignore */ }

    // MX
    try {
      const mxRecords = await resolver.resolveMx(domain);
      if (mxRecords.length > 0) {
        const mx = mxRecords[0]!.exchange.toLowerCase();
        if (mx.includes("google")) result.mxProvider = "Google Workspace";
        else if (mx.includes("outlook") || mx.includes("microsoft")) result.mxProvider = "Microsoft 365";
        else result.mxProvider = mxRecords[0]!.exchange;
      }
    } catch { /* ignore */ }
  } catch { /* ignore */ }

  // 3. HIBP domain check
  try {
    if (process.env["HIBP_API_KEY"]) {
      const hibpResp = await axios.get(`https://haveibeenpwned.com/api/v3/breacheddomain/${domain}`, {
        headers: { "hibp-api-key": process.env["HIBP_API_KEY"], "User-Agent": "CyberStep/1.0" },
        timeout: 5000,
      });
      result.haveIBeenPwnedCount = Array.isArray(hibpResp.data) ? hibpResp.data.length : 0;
    }
  } catch { /* ignore */ }

  return result;
}

function detectTechStack(html: string, headers: Record<string, string>): string[] {
  const stack: string[] = [];
  if (html.includes("wp-content")) stack.push("WordPress");
  if (html.includes("shopify")) stack.push("Shopify");
  if (html.includes("woocommerce")) stack.push("WooCommerce");
  if (/\breact\b/i.test(html)) stack.push("React");
  if (html.includes("gtm.js") || html.includes("googletagmanager")) stack.push("Google Tag Manager");
  if (html.includes("fbq(") || html.includes("facebook.net")) stack.push("Facebook Pixel");
  const server = headers["server"] ?? "";
  if (server.includes("Apache")) stack.push("Apache");
  if (server.includes("nginx")) stack.push("Nginx");
  if (server.includes("Microsoft-IIS")) stack.push("IIS");
  const powered = headers["x-powered-by"] ?? "";
  if (powered.includes("PHP")) stack.push(`PHP${powered.includes("/") ? " " + powered.split("/")[1]!.substring(0, 5) : ""}`);
  if (powered.includes("ASP.NET")) stack.push("ASP.NET");
  return [...new Set(stack)];
}

function extractNamedPeople(html: string): string[] {
  const names: string[] = [];
  const keywords = ["Genel Müdür", "CEO", "Kurucu", "Yönetim Kurulu", "Direktör", "Müdür"];
  for (const kw of keywords) {
    const pattern = new RegExp(`([A-ZÇĞİÖŞÜ][a-zçğışöüA-ZÇĞİÖŞÜ]+ [A-ZÇĞİÖŞÜ][a-zçğışöüA-ZÇĞİÖŞÜ]+)`, "g");
    const nearStart = html.indexOf(kw);
    if (nearStart > 0) {
      const chunk = html.substring(Math.max(0, nearStart - 100), nearStart + 100);
      const m = chunk.match(pattern);
      if (m) names.push(...m.slice(0, 2));
    }
  }
  return [...new Set(names)].slice(0, 5);
}

function detectMxProvider(headers: Record<string, string>): string {
  const via = (headers["via"] ?? "").toLowerCase();
  if (via.includes("google")) return "Google Workspace";
  return "";
}
