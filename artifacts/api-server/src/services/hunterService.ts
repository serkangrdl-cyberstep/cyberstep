import { logger } from "../lib/logger";

export interface HunterEmail {
  email: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  confidence: number;
  source: "hunter";
}

export interface HunterResult {
  domain: string;
  emails: HunterEmail[];
}

function getApiKey(): string | null {
  return process.env["HUNTER_API_KEY"] ?? null;
}

export async function domainSearch(domain: string): Promise<HunterResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    logger.warn("HUNTER_API_KEY not set — returning empty email list");
    return { domain, emails: [] };
  }

  try {
    const url = new URL("https://api.hunter.io/v2/domain-search");
    url.searchParams.set("domain", domain);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("type", "professional");
    url.searchParams.set("limit", "10");

    const res = await fetch(url.toString());

    if (!res.ok) {
      logger.warn({ domain, status: res.status }, "Hunter domain search failed");
      return { domain, emails: [] };
    }

    const data = await res.json() as {
      data?: {
        emails?: Array<{
          value: string;
          first_name?: string;
          last_name?: string;
          position?: string;
          confidence?: number;
        }>;
      };
    };

    const emails: HunterEmail[] = (data.data?.emails ?? []).map(e => ({
      email: e.value,
      firstName: e.first_name,
      lastName: e.last_name,
      position: e.position,
      confidence: e.confidence ?? 50,
      source: "hunter" as const,
    }));

    return { domain, emails };
  } catch (err) {
    logger.error({ err, domain }, "Hunter domainSearch error");
    return { domain, emails: [] };
  }
}

export async function verifyEmail(email: string): Promise<{ deliverable: boolean; confidence: number }> {
  const apiKey = getApiKey();
  if (!apiKey) return { deliverable: false, confidence: 0 };

  try {
    const url = new URL("https://api.hunter.io/v2/email-verifier");
    url.searchParams.set("email", email);
    url.searchParams.set("api_key", apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) return { deliverable: false, confidence: 0 };

    const data = await res.json() as {
      data?: { result?: string; score?: number };
    };

    return {
      deliverable: data.data?.result === "deliverable",
      confidence: data.data?.score ?? 0,
    };
  } catch (err) {
    logger.error({ err, email }, "Hunter verifyEmail error");
    return { deliverable: false, confidence: 0 };
  }
}
