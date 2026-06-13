/**
 * Subdomain HTTP probe ve varlık sınıflandırması.
 * certTrans.subdomains → paralel probe → assetClassification + priorityScore
 */
import axios from "axios";
import { db } from "@workspace/db";
import { domainScanSubdomainsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const PROBE_TIMEOUT_MS = 5_000;
const MAX_CONCURRENT = 8;

export function classifyAsset(
  httpStatus: number | null,
  contentType: string | null,
  url: string,
): string {
  if (httpStatus === null) return "unreachable";
  if (httpStatus >= 500) return "error_5xx";
  if (httpStatus >= 400) return "error_4xx";
  if (httpStatus >= 300) return "redirect";
  if (
    contentType?.includes("application/json") ||
    contentType?.includes("application/xml") ||
    /\/api\/|\/v[0-9]+\//.test(url)
  ) return "api";
  if (httpStatus >= 200) return "web_app";
  return "unknown";
}

export function calculatePriorityScore(
  classification: string,
  subdomain: string,
): { score: number; reason: string } {
  let score = 0;
  const reasons: string[] = [];

  if (classification === "api") {
    score += 30;
    reasons.push("API endpoint");
  }
  if (classification === "error_5xx") {
    score += 10;
    reasons.push("Sunucu hatası — yanlış yapılandırma olabilir");
  }
  const HIGH_VALUE = /^(admin|panel|dashboard|login|portal|cpanel|webmail|mail|vpn|remote|owa|app|manage|intranet|staff|hr|crm|erp)\./i;
  if (HIGH_VALUE.test(subdomain)) {
    score += 20;
    reasons.push("Yüksek değerli alt domain");
  }
  if (classification === "web_app") {
    score += 5;
    reasons.push("Web uygulaması");
  }

  return { score, reason: reasons.join(", ") || "Standart" };
}

async function probeSubdomain(subdomain: string): Promise<{ httpStatus: number | null; contentType: string | null }> {
  for (const scheme of ["https", "http"] as const) {
    try {
      const resp = await axios.get(`${scheme}://${subdomain}`, {
        timeout: PROBE_TIMEOUT_MS,
        maxRedirects: 3,
        validateStatus: () => true,
        headers: { "User-Agent": "CyberStep-SecurityResearch/1.0" },
      });
      const ct = (resp.headers["content-type"] as string | undefined) ?? null;
      return {
        httpStatus: resp.status,
        contentType: ct?.split(";")[0]?.trim() ?? null,
      };
    } catch {
      if (scheme === "https") continue;
    }
  }
  return { httpStatus: null, contentType: null };
}

export async function probeAndClassifySubdomains(scanId: number, subdomains: string[]): Promise<void> {
  if (subdomains.length === 0) return;

  for (let i = 0; i < subdomains.length; i += MAX_CONCURRENT) {
    const batch = subdomains.slice(i, i + MAX_CONCURRENT);
    await Promise.all(batch.map(async (subdomain) => {
      try {
        const { httpStatus, contentType } = await probeSubdomain(subdomain);
        const classification = classifyAsset(httpStatus, contentType, subdomain);
        const { score, reason } = calculatePriorityScore(classification, subdomain);

        await db.insert(domainScanSubdomainsTable).values({
          scanId,
          domain: subdomain,
          httpStatus,
          contentType,
          assetClassification: classification,
          priorityScore: score,
          priorityReason: reason,
        }).onConflictDoNothing();
      } catch (e) {
        logger.warn({ subdomain, scanId, err: String(e) }, "Subdomain probe hatası");
      }
    }));
  }

  logger.info({ scanId, count: subdomains.length }, "Subdomain sınıflandırması tamamlandı");
}
