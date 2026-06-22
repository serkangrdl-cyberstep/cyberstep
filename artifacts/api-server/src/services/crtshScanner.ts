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

// Tek bir crt.sh run'ının (8 TLD sorgusu + işleme) normal süresinden çok daha
// geniş bir üst sınır. Hem mutex'in zorla serbest bırakılmasında hem de
// run-level timeout'ta kullanılır — 12 Haziran 2026'da bir run process
// crash/restart nedeniyle hiç sonlanmadan "running"de takılı kalmıştı.
const CRTSH_RUN_TIMEOUT_MS = 20 * 60 * 1000; // 20 dakika
const CRTSH_RUN_TIMEOUT_MESSAGE = "Run-level timeout exceeded";

// Serialise concurrent crt.sh requests so we never send more than one at a time.
// Multiple simultaneous requests trigger 429 rate-limiting from crt.sh.
let _crtshRunning = false;
let _crtshAcquiredAt: number | null = null;
const _crtshQueue: Array<() => void> = [];

function _acquireCrtsh(): Promise<void> {
  // Önceki sahip mutex'i hiç bırakmamış olabilir (process crash, sonsuz hang).
  // CRTSH_RUN_TIMEOUT_MS'den uzun süre kilitli kalmışsa zorla serbest bırak.
  if (_crtshRunning && _crtshAcquiredAt !== null && Date.now() - _crtshAcquiredAt > CRTSH_RUN_TIMEOUT_MS) {
    logger.warn(
      { heldMs: Date.now() - _crtshAcquiredAt, acquiredAt: new Date(_crtshAcquiredAt).toISOString() },
      "crt.sh mutex zorla serbest bırakıldı — önceki run askıda kalmış olabilir",
    );
    _crtshRunning = false;
    _crtshAcquiredAt = null;
  }

  if (!_crtshRunning) {
    _crtshRunning = true;
    _crtshAcquiredAt = Date.now();
    return Promise.resolve();
  }
  return new Promise(resolve => _crtshQueue.push(resolve));
}

function _releaseCrtsh(): void {
  const next = _crtshQueue.shift();
  if (next) {
    _crtshAcquiredAt = Date.now();
    next();
  } else {
    _crtshRunning = false;
    _crtshAcquiredAt = null;
  }
}

// Test-only: mutex'in iç durumuna dışarıdan erişim (src/scripts/validate-crtsh-*.ts kullanır).
export const __crtshMutexTestHooks = {
  acquire: _acquireCrtsh,
  release: _releaseCrtsh,
  forceState(running: boolean, acquiredAtMs: number | null): void {
    _crtshRunning = running;
    _crtshAcquiredAt = acquiredAtMs;
  },
  getState(): { running: boolean; acquiredAt: number | null; queueLength: number } {
    return { running: _crtshRunning, acquiredAt: _crtshAcquiredAt, queueLength: _crtshQueue.length };
  },
};

const EXCLUDED_DOMAINS = new Set([
  "cloudflare.com", "amazonaws.com", "azure.com",
  "google.com", "microsoft.com", "github.io",
  "netlify.app", "vercel.app", "letsencrypt.org",
  "fastly.net", "akamai.net", "akamaitechnologies.com",
]);

// In-memory cache of scoring rules (populated on first scan)
let SCORING_CACHE: Record<string, { corporate_score: number; subdomain_type: string }> = {};

export async function loadScoringRules(): Promise<void> {
  const rows = await db.select().from(subdomainScoringRulesTable).where(eq(subdomainScoringRulesTable.isActive, true));
  SCORING_CACHE = {};
  for (const r of rows) {
    SCORING_CACHE[r.pattern] = { corporate_score: r.corporateScore, subdomain_type: r.subdomainType ?? "generic" };
  }
}

export function extractRootDomain(hostname: string): string {
  const parts = hostname.split(".");
  if (parts[parts.length - 1] === "tr" && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }
  return parts.slice(-2).join(".");
}

export function isTurkishDomain(d: string): boolean {
  return d.endsWith(".tr");
}

const EXCLUDED_TLDS_CRTSH = [
  ".gov.tr", ".mil.tr", ".bel.tr", ".pol.tr",
  // .edu.tr ve .k12.tr: pipeline'a girer, sector=education olarak işaretlenir
];

export function inferSectorFromDomain(domain: string): string {
  const d = domain.toLowerCase();
  if (d.endsWith(".edu.tr")) return "education";
  if (d.endsWith(".k12.tr")) return "education";
  if (d.endsWith(".org.tr")) return "ngo";
  if (d.endsWith(".biz.tr")) return "commercial";
  if (d.endsWith(".net.tr")) return "technology";
  if (d.endsWith(".com.tr")) return "commercial";
  if (d.endsWith(".web.tr")) return "commercial";
  if (d.endsWith(".gen.tr")) return "commercial";
  if (d.endsWith(".info.tr")) return "commercial";
  return "unknown";
}

export function isExcluded(domain: string): boolean {
  const d = domain.toLowerCase();
  for (const tld of EXCLUDED_TLDS_CRTSH) {
    if (d.endsWith(tld)) return true;
  }
  for (const ex of EXCLUDED_DOMAINS) {
    if (domain.includes(ex)) return true;
  }
  return false;
}

export function analyzeSubdomain(domain: string): {
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

/**
 * crt.sh'e HTTP GET atar; 503/429/502 durumunda üstel geri çekilme ile yeniden dener.
 * Diğer HTTP hatalarında veya maxAttempts dolduğunda exception fırlatır.
 */
async function fetchCrtsh(query: string, timeout: number): Promise<unknown[]> {
  const maxAttempts = 4;
  const baseDelay = 3_000; // 3s, 6s, 12s

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await axios.get(`${CRTSH_BASE}/`, {
        params: { q: query, output: "json" },
        timeout,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; CyberStep-SecurityResearch/1.0)",
          "Accept": "application/json",
        },
      });
      return (response.data ?? []) as unknown[];
    } catch (err: unknown) {
      const status = axios.isAxiosError(err) ? err.response?.status : null;
      // 404 = no matching certs for this query — not an error, just empty
      if (status === 404) return [];
      const isRetryable = !status || status === 503 || status === 502 || status === 429;

      if (!isRetryable || attempt === maxAttempts) {
        const detail = status ? `HTTP ${status}` : (axios.isAxiosError(err) ? `AxiosError: ${err.message}` : String(err));
        throw new Error(`crt.sh erişilemiyor (${detail}). Lütfen birkaç dakika sonra tekrar deneyin.`);
      }

      const delay = baseDelay * Math.pow(2, attempt - 1);
      logger.warn({ query, attempt, status, delay }, `crt.sh ${status ?? "ağ hatası"} — ${delay}ms sonra yeniden deneniyor`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  // unreachable
  throw new Error("crt.sh: maksimum deneme sayısına ulaşıldı");
}

export interface CRTSHScanResult {
  runId: number;
  certsScanned: number;
  domainsFound: number;
  addedToLeads: number;
  skipped: number;
}

export async function scanCRTSH(
  query: string = "%.com.tr",
  options: { daysBack?: number; minCorporateScore?: number; limit?: number } = {},
): Promise<CRTSHScanResult> {
  const { daysBack = 30, minCorporateScore = 10, limit = 300 } = options;

  // Serialize: wait for any ongoing crt.sh scan to finish before starting
  await _acquireCrtsh();
  try {
    return await _scanCRTSHInner(query, { daysBack, minCorporateScore, limit });
  } finally {
    _releaseCrtsh();
  }
}

// Verilen işi runTimeoutMs içinde tamamlanmaya zorlar. Süre dolarsa veya iş
// kendisi hata fırlatırsa discovery_runs satırını 'failed' yapar — ama satır
// hâlâ 'running' ise (yani gecikmeli tamamlanan asıl iş üzerine yazmıyor).
// Test-only export'u (__crtshRunTimeoutTestHooks) bu fonksiyonu doğrudan
// kısaltılmış bir timeoutMs ile sürmek için kullanılır.
async function _raceWithRunTimeout<T>(
  runId: number,
  workFn: () => Promise<T>,
  runTimeoutMs: number,
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(CRTSH_RUN_TIMEOUT_MESSAGE)), runTimeoutMs);
  });

  try {
    return await Promise.race([workFn(), timeout]);
  } catch (err) {
    const isTimeout = err instanceof Error && err.message === CRTSH_RUN_TIMEOUT_MESSAGE;
    const errorMessage = isTimeout ? CRTSH_RUN_TIMEOUT_MESSAGE : String(err);
    await db.update(discoveryRunsTable)
      .set({ status: "failed", errorMessage, completedAt: new Date() })
      .where(and(eq(discoveryRunsTable.id, runId), eq(discoveryRunsTable.status, "running")));
    if (isTimeout) {
      logger.error({ runId, runTimeoutMs }, "crt.sh run-level timeout aşıldı — run 'failed' olarak işaretlendi");
    }
    throw err;
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

// Test-only: run-level timeout race'ini gerçek bir discovery_runs satırına
// karşı kısaltılmış sürelerle tetiklemek için (src/scripts/validate-crtsh-*.ts).
export const __crtshRunTimeoutTestHooks = {
  raceWithRunTimeout: _raceWithRunTimeout,
  timeoutMessage: CRTSH_RUN_TIMEOUT_MESSAGE,
};

async function _scanCRTSHInner(
  query: string,
  opts: { daysBack: number; minCorporateScore: number; limit: number },
): Promise<CRTSHScanResult> {
  await loadScoringRules();

  const [run] = await db.insert(discoveryRunsTable).values({
    source: "crtsh",
    runParams: { query, ...opts },
    status: "running",
  }).returning();

  return _raceWithRunTimeout(run.id, () => _runCRTSHScanWork(run.id, query, opts), CRTSH_RUN_TIMEOUT_MS);
}

async function _runCRTSHScanWork(
  runId: number,
  query: string,
  { daysBack, minCorporateScore, limit }: { daysBack: number; minCorporateScore: number; limit: number },
): Promise<CRTSHScanResult> {
  logger.info({ query }, "crt.sh scan starting");
  const certs = await fetchCrtsh(query, 60_000) as Array<{
    common_name?: string;
    name_value?: string;
    entry_timestamp?: string;
    issuer_name?: string;
    not_before?: string;
    not_after?: string;
  }>;

  const cutoff = new Date(Date.now() - daysBack * 86_400_000);
  const qualifiedDomains = new Map<string, { triggerSubdomain: string; subdomainType: string; score: number; certIssuer: string }>();
  let skipped = 0;

  for (const cert of certs) {
    if (qualifiedDomains.size >= limit) break;
    if (cert.entry_timestamp && new Date(cert.entry_timestamp) < cutoff) { skipped++; continue; }

    // Skip short-lived certs (< 30 days) — test/staging certs, low value for lead discovery
    if (cert.not_before && cert.not_after) {
      const validityDays = (new Date(cert.not_after).getTime() - new Date(cert.not_before).getTime()) / 86_400_000;
      if (validityDays < 30) { skipped++; continue; }
    }

    const domains = extractDomainsFromCert(cert);
    if (domains.length === 0) { skipped++; continue; }

    for (const domain of domains) {
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

  await db.update(discoveryRunsTable)
    .set({ status: "completed", totalFound: qualifiedDomains.size, totalAdded: added, completedAt: new Date() })
    .where(and(eq(discoveryRunsTable.id, runId), eq(discoveryRunsTable.status, "running")));

  logger.info({ runId, certsScanned: certs.length, domainsFound: qualifiedDomains.size, added, skipped }, "crt.sh scan done");
  return { runId, certsScanned: certs.length, domainsFound: qualifiedDomains.size, addedToLeads: added, skipped };
}
