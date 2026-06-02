import { db } from "@workspace/db";
import { customerTechStackTable, customerSecurityMaturityTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { analyzeHeaders } from "./headerAnalyzer";
import { analyzeDNS } from "./dnsAnalyzer";
import { analyzeHTML } from "./htmlAnalyzer";
import { analyzeSSL } from "./sslAnalyzer";
import { analyzeShodan } from "./shodanAnalyzer";
import { calculateMaturity } from "./maturityCalculator";
import type { TechStack, MaturityResult } from "./types";
import { logger } from "../../lib/logger";

interface FingerprintOptions {
  useShodan?: boolean;
  deepScan?: boolean;
  customerId?: number;
  leadCandidateId?: number;
}

function mergeAndScore(results: TechStack[]): TechStack[] {
  const map = new Map<string, TechStack>();
  for (const item of results) {
    const key = `${item.category}:${item.vendor}:${item.product}`;
    const existing = map.get(key);
    if (existing) {
      existing.confidence = Math.min(100, existing.confidence + Math.round(item.confidence * 0.3));
    } else {
      map.set(key, { ...item });
    }
  }
  return Array.from(map.values());
}

export async function fingerprintDomain(
  domain: string,
  options: FingerprintOptions = {}
): Promise<{ stack: TechStack[]; maturity: MaturityResult }> {
  const [headerResult, dnsResult, htmlResult, sslResult, shodanResult] = await Promise.allSettled([
    analyzeHeaders(domain),
    analyzeDNS(domain),
    analyzeHTML(domain, options.deepScan),
    analyzeSSL(domain),
    options.useShodan ? analyzeShodan(domain) : Promise.resolve([]),
  ]);

  const allResults: TechStack[] = [];
  for (const result of [headerResult, dnsResult, htmlResult, sslResult, shodanResult]) {
    if (result.status === "fulfilled") allResults.push(...result.value);
  }

  const stack = mergeAndScore(allResults);
  const maturity = calculateMaturity(stack);

  await saveTechStack(domain, stack, maturity, options);
  return { stack, maturity };
}

async function saveTechStack(
  domain: string,
  stack: TechStack[],
  maturity: MaturityResult,
  options: FingerprintOptions
): Promise<void> {
  try {
    for (const item of stack) {
      await db
        .insert(customerTechStackTable)
        .values({
          domain,
          customerId: options.customerId,
          leadCandidateId: options.leadCandidateId,
          category: item.category,
          vendor: item.vendor || "unknown",
          product: item.product || "unknown",
          version: item.version,
          confidence: item.confidence,
          detectedVia: item.detectedVia,
          evidence: item.evidence as any,
          securityRisk: item.securityRisk,
          securityNote: item.securityNote,
          salesSignal: item.salesSignal,
          lastVerifiedAt: new Date(),
          isActive: true,
        })
        .onConflictDoUpdate({
          target: [customerTechStackTable.domain, customerTechStackTable.category, customerTechStackTable.vendor, customerTechStackTable.product],
          set: {
            confidence: item.confidence,
            version: item.version,
            lastVerifiedAt: new Date(),
            isActive: true,
          },
        });
    }

    await db
      .insert(customerSecurityMaturityTable)
      .values({
        domain,
        customerId: options.customerId,
        leadCandidateId: options.leadCandidateId,
        maturityScore: maturity.maturityScore,
        maturityLevel: maturity.maturityLevel,
        scoreEmailSecurity: maturity.scoreEmail,
        scoreWebSecurity: maturity.scoreWeb,
        scoreInfrastructure: maturity.scoreInfra,
        scoreVisibility: maturity.scoreVisibility,
        recommendedService: maturity.recommendedService,
        recommendationReason: maturity.recommendationReason,
        companySegment: maturity.companySegment,
        segmentSignals: maturity.segmentSignals,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [customerSecurityMaturityTable.domain],
        set: {
          maturityScore: maturity.maturityScore,
          maturityLevel: maturity.maturityLevel,
          scoreEmailSecurity: maturity.scoreEmail,
          scoreWebSecurity: maturity.scoreWeb,
          scoreInfrastructure: maturity.scoreInfra,
          scoreVisibility: maturity.scoreVisibility,
          recommendedService: maturity.recommendedService,
          recommendationReason: maturity.recommendationReason,
          companySegment: maturity.companySegment,
          segmentSignals: maturity.segmentSignals,
          updatedAt: new Date(),
        },
      });
  } catch (e) {
    logger.error({ domain, err: e }, "Tech stack kaydetme hatası");
  }
}
