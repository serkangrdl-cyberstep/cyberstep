/**
 * Lead discovery hook for the existing Certstream WebSocket client.
 * Filters incoming certs for Turkish corporate domains, buffers them,
 * and batch-inserts into certstream_queue every 30s or 50 entries.
 *
 * Called from certstream-client.ts processCertificate().
 */
import { db } from "@workspace/db";
import { certstreamQueueTable, certstreamStatusTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import {
  analyzeSubdomain,
  isTurkishDomain,
  isExcluded,
  extractRootDomain,
  loadScoringRules,
} from "./crtshScanner";

const BATCH_SIZE = 50;
const FLUSH_INTERVAL_MS = 30_000;
const MIN_CORPORATE_SCORE = 60;
const STATUS_ID = 1;
// Every ~1000 certs, update stats (probabilistic)
const STATS_SAMPLE_RATE = 0.001;

interface PendingEntry {
  rootDomain: string;
  triggerSubdomain: string;
  subdomainType: string;
  corporateScore: number;
  certOrg: string;
  certIssuer: string;
  rawDomains: string[];
}

let pendingDomains: PendingEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let rulesLoaded = false;
let totalReceivedLocal = 0;
let trFoundLocal = 0;

async function ensureRulesLoaded(): Promise<void> {
  if (!rulesLoaded) {
    await loadScoringRules();
    rulesLoaded = true;
  }
}

async function flushBuffer(): Promise<void> {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  if (pendingDomains.length === 0) return;

  const toInsert = [...pendingDomains];
  pendingDomains = [];

  try {
    await db.insert(certstreamQueueTable).values(
      toInsert.map((d) => ({
        rootDomain: d.rootDomain,
        triggerSubdomain: d.triggerSubdomain,
        subdomainType: d.subdomainType,
        corporateScore: d.corporateScore,
        certOrg: d.certOrg.slice(0, 500),
        certIssuer: d.certIssuer.slice(0, 255),
        rawDomains: d.rawDomains.slice(0, 10),
      })),
    ).onConflictDoNothing();

    logger.debug({ count: toInsert.length }, "certstream-lead: queue flushed");
  } catch (e) {
    logger.error({ err: String(e) }, "certstream-lead: flush error");
  }
}

/**
 * Called from the existing certstream-client.ts for each processed certificate.
 * Fire-and-forget; must not throw.
 */
export async function handleCertForLeadDiscovery(cert: {
  all_domains: string[];
  subject?: { O?: string; CN?: string };
  issuer?: { O?: string; CN?: string };
}): Promise<void> {
  try {
    await ensureRulesLoaded();

    const allDomains: string[] = cert.all_domains ?? [];
    const certOrg = cert.subject?.O ?? "";
    const certIssuer = cert.issuer?.O ?? cert.issuer?.CN ?? "";

    const hasTROrg = /türk|türkiye|istanbul|ankara|izmir/i.test(certOrg);
    let foundTR = false;

    for (const domain of allDomains) {
      if (domain.startsWith("*")) continue;
      if (!domain.endsWith(".tr") && !hasTROrg) continue;

      const clean = domain.toLowerCase().trim();
      if (isExcluded(clean)) continue;
      if (!isTurkishDomain(clean) && !hasTROrg) continue;

      const analysis = analyzeSubdomain(clean);
      if (!analysis.rootDomain) continue;
      if (analysis.corporateScore < MIN_CORPORATE_SCORE) continue;

      // Deduplicate within pending buffer
      const alreadyPending = pendingDomains.some((p) => p.rootDomain === analysis.rootDomain);
      if (!alreadyPending) {
        pendingDomains.push({
          rootDomain: analysis.rootDomain,
          triggerSubdomain: clean,
          subdomainType: analysis.subdomainType,
          corporateScore: analysis.corporateScore,
          certOrg,
          certIssuer,
          rawDomains: allDomains,
        });
      }
      foundTR = true;
    }

    totalReceivedLocal++;
    if (foundTR) trFoundLocal++;

    // Flush conditions
    if (pendingDomains.length >= BATCH_SIZE) {
      await flushBuffer();
    } else if (!flushTimer && pendingDomains.length > 0) {
      flushTimer = setTimeout(() => { flushBuffer().catch(() => {}); }, FLUSH_INTERVAL_MS);
    }

    // Periodic stats update (probabilistic to avoid DB pressure)
    if (Math.random() < STATS_SAMPLE_RATE && (totalReceivedLocal > 0 || trFoundLocal > 0)) {
      const localReceived = totalReceivedLocal;
      const localTr = trFoundLocal;
      totalReceivedLocal = 0;
      trFoundLocal = 0;
      db.update(certstreamStatusTable).set({
        lastCertAt: new Date(),
        totalReceived: sql`total_received + ${localReceived}`,
        totalTrFound: sql`total_tr_found + ${localTr}`,
        updatedAt: new Date(),
      }).where(eq(certstreamStatusTable.id, STATUS_ID)).catch(() => {});
    }
  } catch {
    // Never propagate — this must not affect existing phishing detection
  }
}

export async function forceFlushCertstreamBuffer(): Promise<void> {
  await flushBuffer();
}
