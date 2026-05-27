import { Router } from "express";
import dns from "dns/promises";
import https from "https";
import { db } from "@workspace/db";
import { domainScansTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { logger } from "../../lib/logger";

const router = Router();

const DKIM_SELECTORS = [
  "default", "google", "mail", "dkim", "selector1", "selector2",
  "protonmail", "zoho", "k1", "smtp", "email", "mandrill",
  "sendgrid", "mailchimp", "mimecast", "pm", "s1", "s2",
];

// ─── DNS helpers ─────────────────────────────────────────────────────────────

async function checkSPF(domain: string): Promise<{ pass: boolean; record: string | null }> {
  try {
    const records = await dns.resolveTxt(domain);
    for (const r of records) {
      const joined = r.join("");
      if (joined.startsWith("v=spf1")) return { pass: true, record: joined };
    }
    return { pass: false, record: null };
  } catch {
    return { pass: false, record: null };
  }
}

async function checkDMARC(domain: string): Promise<{ pass: boolean; record: string | null }> {
  try {
    const records = await dns.resolveTxt(`_dmarc.${domain}`);
    for (const r of records) {
      const joined = r.join("");
      if (joined.startsWith("v=DMARC1")) return { pass: true, record: joined };
    }
    return { pass: false, record: null };
  } catch {
    return { pass: false, record: null };
  }
}

async function checkDKIM(domain: string): Promise<{ pass: boolean; selectors: string[] }> {
  const found: string[] = [];
  await Promise.all(
    DKIM_SELECTORS.map(async (selector) => {
      try {
        const records = await dns.resolveTxt(`${selector}._domainkey.${domain}`);
        for (const r of records) {
          if (r.join("").includes("v=DKIM1")) {
            found.push(selector);
            break;
          }
        }
      } catch {
        // selector not found — expected
      }
    })
  );
  return { pass: found.length > 0, selectors: found };
}

async function checkMX(domain: string): Promise<{ pass: boolean; records: Array<{ exchange: string; priority: number }> }> {
  try {
    const records = await dns.resolveMx(domain);
    return {
      pass: records.length > 0,
      records: records.map((r) => ({ exchange: r.exchange, priority: r.priority })),
    };
  } catch {
    return { pass: false, records: [] };
  }
}

async function checkSSL(domain: string): Promise<{
  pass: boolean;
  expiryDate: string | null;
  issuer: string | null;
  daysUntilExpiry: number | null;
}> {
  return new Promise((resolve) => {
    const req = https.request(
      { hostname: domain, port: 443, method: "HEAD", timeout: 8000, rejectUnauthorized: true },
      (res) => {
        try {
          const cert = (res.socket as any).getPeerCertificate?.();
          if (cert?.valid_to) {
            const expiry = new Date(cert.valid_to);
            const daysUntilExpiry = Math.floor((expiry.getTime() - Date.now()) / 86400000);
            resolve({
              pass: daysUntilExpiry > 14,
              expiryDate: expiry.toISOString(),
              issuer: cert.issuer?.O ?? cert.issuer?.CN ?? null,
              daysUntilExpiry,
            });
          } else {
            resolve({ pass: false, expiryDate: null, issuer: null, daysUntilExpiry: null });
          }
        } catch {
          resolve({ pass: false, expiryDate: null, issuer: null, daysUntilExpiry: null });
        }
      }
    );
    req.on("error", () => resolve({ pass: false, expiryDate: null, issuer: null, daysUntilExpiry: null }));
    req.on("timeout", () => { req.destroy(); resolve({ pass: false, expiryDate: null, issuer: null, daysUntilExpiry: null }); });
    req.end();
  });
}

function calcScore(spf: boolean, dmarc: boolean, dkim: boolean, mx: boolean, ssl: boolean): number {
  return (spf ? 20 : 0) + (dmarc ? 25 : 0) + (dkim ? 20 : 0) + (mx ? 10 : 0) + (ssl ? 25 : 0);
}

// ─── HIBP domain breach check ─────────────────────────────────────────────────
async function checkHIBP(domain: string): Promise<{
  breachCount: number;
  breaches: Array<{ name: string; breachDate: string; pwnCount: number; dataClasses: string[] }>;
}> {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: "haveibeenpwned.com",
        path: `/api/v3/breaches?domain=${encodeURIComponent(domain)}`,
        method: "GET",
        timeout: 8000,
        headers: {
          "User-Agent": "CyberStep.io Security Scanner",
          "Accept": "application/json",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            if (res.statusCode === 200) {
              const raw = JSON.parse(data) as Array<{ Name: string; BreachDate: string; PwnCount: number; DataClasses: string[] }>;
              resolve({
                breachCount: raw.length,
                breaches: raw.slice(0, 10).map((b) => ({
                  name: b.Name,
                  breachDate: b.BreachDate,
                  pwnCount: b.PwnCount,
                  dataClasses: (b.DataClasses ?? []).slice(0, 4),
                })),
              });
            } else {
              resolve({ breachCount: 0, breaches: [] });
            }
          } catch {
            resolve({ breachCount: 0, breaches: [] });
          }
        });
      }
    );
    req.on("error", () => resolve({ breachCount: 0, breaches: [] }));
    req.on("timeout", () => { req.destroy(); resolve({ breachCount: 0, breaches: [] }); });
    req.end();
  });
}

// ─── DNSBL blacklist check ────────────────────────────────────────────────────
const DNSBLS = [
  "zen.spamhaus.org",
  "bl.spamcop.net",
  "dnsbl.sorbs.net",
  "b.barracudacentral.org",
  "dnsbl-1.uceprotect.net",
  "dnsbl.abuse.ch",
  "spam.dnsbl.sorbs.net",
];

async function checkBlacklists(domain: string): Promise<{
  blacklisted: boolean;
  blacklistCount: number;
  results: Array<{ list: string; listed: boolean }>;
}> {
  let ip: string | null = null;
  try {
    const addresses = await dns.resolve4(domain);
    ip = addresses[0] ?? null;
  } catch {
    return { blacklisted: false, blacklistCount: 0, results: [] };
  }
  if (!ip) return { blacklisted: false, blacklistCount: 0, results: [] };

  const reversed = ip.split(".").reverse().join(".");
  const results = await Promise.all(
    DNSBLS.map(async (dnsbl) => {
      try {
        await dns.resolve4(`${reversed}.${dnsbl}`);
        return { list: dnsbl, listed: true };
      } catch {
        return { list: dnsbl, listed: false };
      }
    })
  );
  const listedCount = results.filter((r) => r.listed).length;
  return { blacklisted: listedCount > 0, blacklistCount: listedCount, results };
}

function sanitizeDomain(raw: string): string {
  let d = raw.trim().toLowerCase();
  // strip protocol
  d = d.replace(/^https?:\/\//, "");
  // strip path, port, query
  d = d.split("/")[0]!.split("?")[0]!.split("#")[0]!;
  return d;
}

// ─── POST /api/domain-scan ───────────────────────────────────────────────────
router.post("/domain-scan", async (req, res) => {
  const rawDomain: unknown = req.body?.domain;
  const rawEmail: unknown = req.body?.email;

  if (!rawDomain || typeof rawDomain !== "string" || rawDomain.trim().length < 3) {
    res.status(400).json({ error: "Geçersiz alan adı" });
    return;
  }

  const emailStr = typeof rawEmail === "string" && rawEmail.trim().length > 0 ? rawEmail.trim() : null;
  if (emailStr && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
    res.status(400).json({ error: "Geçersiz e-posta adresi" });
    return;
  }

  const domain = sanitizeDomain(rawDomain);
  const email = emailStr;

  // basic domain pattern check
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z]{2,})+$/.test(domain)) {
    res.status(400).json({ error: "Geçersiz alan adı formatı" });
    return;
  }

  logger.info({ domain }, "Starting domain scan");

  try {
    const [spf, dmarc, dkim, mx, ssl, hibp, blacklist] = await Promise.all([
      checkSPF(domain),
      checkDMARC(domain),
      checkDKIM(domain),
      checkMX(domain),
      checkSSL(domain),
      checkHIBP(domain),
      checkBlacklists(domain),
    ]);

    const overallScore = calcScore(spf.pass, dmarc.pass, dkim.pass, mx.pass, ssl.pass);

    const [scan] = await db
      .insert(domainScansTable)
      .values({
        domain,
        email,
        spfPass: spf.pass,
        spfRecord: spf.record,
        dmarcPass: dmarc.pass,
        dmarcRecord: dmarc.record,
        dkimPass: dkim.pass,
        dkimSelectors: dkim.selectors,
        mxPass: mx.pass,
        mxRecords: mx.records,
        sslPass: ssl.pass,
        sslExpiry: ssl.expiryDate,
        sslIssuer: ssl.issuer,
        sslDaysUntilExpiry: ssl.daysUntilExpiry,
        overallScore,
        hibpBreachCount: hibp.breachCount,
        hibpBreaches: hibp.breaches,
        blacklisted: blacklist.blacklisted,
        blacklistCount: blacklist.blacklistCount,
        blacklistResults: blacklist.results,
      })
      .returning();

    logger.info({ domain, overallScore, hibpBreaches: hibp.breachCount, blacklisted: blacklist.blacklisted, scanId: scan?.id }, "Domain scan complete");
    res.json(scan);
  } catch (err) {
    logger.error({ err, domain }, "Domain scan failed");
    res.status(500).json({ error: "Tarama sırasında bir hata oluştu" });
  }
});

// ─── GET /api/domain-scan/:id ────────────────────────────────────────────────
router.get("/domain-scan/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id) || id <= 0) {
    res.status(400).json({ error: "Geçersiz ID" });
    return;
  }
  const [scan] = await db.select().from(domainScansTable).where(eq(domainScansTable.id, id));
  if (!scan) {
    res.status(404).json({ error: "Tarama bulunamadı" });
    return;
  }
  res.json(scan);
});

// ─── GET /api/domain-scan/history/:domain ────────────────────────────────────
router.get("/domain-scan/history/:domain", async (req, res) => {
  const domain = sanitizeDomain(req.params.domain);
  const scans = await db
    .select()
    .from(domainScansTable)
    .where(eq(domainScansTable.domain, domain))
    .orderBy(desc(domainScansTable.createdAt))
    .limit(10);
  res.json(scans);
});

export default router;
export { checkSPF, checkDMARC, checkDKIM, checkMX, checkSSL, calcScore, sanitizeDomain };
