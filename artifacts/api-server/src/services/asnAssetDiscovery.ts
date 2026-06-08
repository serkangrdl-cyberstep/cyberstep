import dns from "dns/promises";
import https from "https";
import http from "http";
import { logger } from "../lib/logger";

export interface OrphanedAsset {
  subdomain: string;
  ip: string;
  isWafProtected: boolean;
  httpAccessible: boolean;
  httpsAccessible: boolean;
  risk: "high" | "medium" | "low";
  reason: string;
}

export interface AsnDiscoveryResult {
  asnNumber: string | null;
  asnName: string | null;
  orphanedAssets: OrphanedAsset[];
}

async function resolveA(host: string): Promise<string | null> {
  try {
    const addrs = await dns.resolve4(host);
    return addrs[0] ?? null;
  } catch {
    return null;
  }
}

async function getAsnForIp(ip: string): Promise<{ asn: string | null; org: string | null }> {
  return new Promise((resolve) => {
    const req = https.get(
      `https://ipapi.co/${ip}/json/`,
      { timeout: 6000 },
      (res) => {
        let data = "";
        res.on("data", (c: Buffer) => { data += c.toString(); });
        res.on("end", () => {
          try {
            const json = JSON.parse(data) as { asn?: string; org?: string };
            resolve({ asn: json.asn ?? null, org: json.org ?? null });
          } catch {
            resolve({ asn: null, org: null });
          }
        });
      },
    );
    req.on("error", () => resolve({ asn: null, org: null }));
    req.on("timeout", () => { req.destroy(); resolve({ asn: null, org: null }); });
  });
}

async function getRipePrefixes(asnNumber: string): Promise<string[]> {
  const asnNum = asnNumber.replace(/^AS/i, "");
  return new Promise((resolve) => {
    const req = https.get(
      `https://stat.ripe.net/data/announced-prefixes/data.json?resource=${asnNum}&starttime=-1w`,
      { timeout: 10000 },
      (res) => {
        let data = "";
        res.on("data", (c: Buffer) => { data += c.toString(); });
        res.on("end", () => {
          try {
            const json = JSON.parse(data) as { data?: { prefixes?: Array<{ prefix: string }> } };
            const prefixes = (json.data?.prefixes ?? [])
              .map((p) => p.prefix)
              .filter((p) => !p.includes(":")); // IPv4 only
            resolve(prefixes);
          } catch {
            resolve([]);
          }
        });
      },
    );
    req.on("error", () => resolve([]));
    req.on("timeout", () => { req.destroy(); resolve([]); });
  });
}

function ipToLong(ip: string): number {
  const parts = ip.split(".").map(Number);
  return (
    (((parts[0] ?? 0) << 24) |
     ((parts[1] ?? 0) << 16) |
     ((parts[2] ?? 0) << 8)  |
      (parts[3] ?? 0)) >>> 0
  );
}

function isIpInCidr(ip: string, cidr: string): boolean {
  try {
    const slash = cidr.indexOf("/");
    if (slash === -1) return false;
    const base = cidr.slice(0, slash);
    const bits = parseInt(cidr.slice(slash + 1), 10);
    const mask = (~0 << (32 - bits)) >>> 0;
    return (ipToLong(ip) & mask) === (ipToLong(base) & mask);
  } catch {
    return false;
  }
}

function isIpInPrefixes(ip: string, prefixes: string[]): boolean {
  return prefixes.some((p) => isIpInCidr(ip, p));
}

async function checkPortOpen(host: string, port: number, useHttps: boolean): Promise<boolean> {
  return new Promise((resolve) => {
    const mod = useHttps ? https : http;
    const req = mod.request(
      { hostname: host, port, path: "/", method: "HEAD", timeout: 5000, rejectUnauthorized: false },
      (res) => { resolve((res.statusCode ?? 0) < 600); },
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
    req.end();
  });
}

async function detectWafSimple(host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req = https.request(
      { hostname: host, port: 443, path: "/", method: "GET", timeout: 5000, rejectUnauthorized: false },
      (res) => {
        const h = res.headers;
        resolve(!!(
          h["x-sucuri-id"] ||
          h["x-sucuri-cache"] ||
          h["cf-ray"] ||
          (typeof h["server"] === "string" && /cloudflare/i.test(h["server"])) ||
          (typeof h["x-cache"] === "string" && /cloudfront/i.test(h["x-cache"])) ||
          h["x-amz-cf-id"] ||
          h["x-cdn"] ||
          h["x-waf-event-info"] ||
          h["x-fw-hash"]
        ));
      },
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
    req.end();
  });
}

export async function discoverAsnAssets(
  domain: string,
  ctSubdomains: string[],
): Promise<AsnDiscoveryResult> {
  try {
    const primaryIp = await resolveA(domain);
    if (!primaryIp) return { asnNumber: null, asnName: null, orphanedAssets: [] };

    const { asn: asnNumber, org: asnName } = await getAsnForIp(primaryIp);
    if (!asnNumber) return { asnNumber: null, asnName: null, orphanedAssets: [] };

    const prefixes = await getRipePrefixes(asnNumber);
    if (prefixes.length === 0) return { asnNumber, asnName, orphanedAssets: [] };

    // Resolve first 50 CT subdomains, keep only those landing in our ASN and different from primary
    const subs = ctSubdomains.slice(0, 50);
    const inAsn: Array<{ sub: string; ip: string }> = [];
    await Promise.all(
      subs.map(async (sub) => {
        const ip = await resolveA(sub).catch(() => null);
        if (ip && ip !== primaryIp && isIpInPrefixes(ip, prefixes)) {
          inAsn.push({ sub, ip });
        }
      }),
    );

    const orphanedAssets: OrphanedAsset[] = [];
    await Promise.all(
      inAsn.slice(0, 20).map(async ({ sub, ip }) => {
        const [httpOk, httpsOk, wafDetected] = await Promise.all([
          checkPortOpen(sub, 80, false),
          checkPortOpen(sub, 443, true),
          detectWafSimple(sub),
        ]);
        if (!httpOk && !httpsOk) return;

        const risk: "high" | "medium" | "low" = wafDetected ? "medium" : "high";
        const reason = wafDetected
          ? "WAF arkasında — ancak ana domain dışında ayrı yönetim/izleme gerektirir"
          : "WAF/CDN koruması yok — doğrudan internet erişimi; gölge IT riski";

        orphanedAssets.push({ subdomain: sub, ip, isWafProtected: wafDetected, httpAccessible: httpOk, httpsAccessible: httpsOk, risk, reason });
      }),
    );

    orphanedAssets.sort((a, b) =>
      a.risk === "high" && b.risk !== "high" ? -1 :
      b.risk === "high" && a.risk !== "high" ? 1 : 0,
    );

    logger.info({ domain, asnNumber, asnName, orphanedCount: orphanedAssets.length, prefixCount: prefixes.length }, "ASN asset discovery complete");
    return { asnNumber, asnName, orphanedAssets: orphanedAssets.slice(0, 15) };
  } catch (err) {
    logger.warn({ err, domain }, "ASN asset discovery failed");
    return { asnNumber: null, asnName: null, orphanedAssets: [] };
  }
}
