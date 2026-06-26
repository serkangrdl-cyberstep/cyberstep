import { logger } from "../../lib/logger";

const HIBP_BASE = "https://haveibeenpwned.com/api/v3";
const HIBP_API_KEY = process.env["HIBP_API_KEY"];

export interface HIBPBreach {
  Name: string;
  Title: string;
  Domain: string;
  BreachDate: string;
  AddedDate: string;
  PwnCount: number;
  DataClasses: string[];
  IsVerified: boolean;
  IsSensitive: boolean;
  IsFabricated: boolean;
}

export interface LeakageIncidentInput {
  customerId: number;
  customerDomain: string;
  breachSource: string;
  breachDate: string | null;
  affectedEmailCount: number;
  affectedEmails: string[];
  dataTypes: string[];
  severity: string;
  sourceApi: "hibp" | "dehashed" | "manual";
  rawResponse: Record<string, unknown>;
}

function sleep(ms: number): Promise<void> {
  return new Promise(res => setTimeout(res, ms));
}

function mockBreaches(): HIBPBreach[] {
  return [
    {
      Name: "MockBreach2023",
      Title: "Mock Breach (Test Modu)",
      Domain: "example.com",
      BreachDate: "2023-01-01",
      AddedDate: "2023-06-01",
      PwnCount: 150,
      DataClasses: ["Email addresses", "Passwords"],
      IsVerified: false,
      IsSensitive: false,
      IsFabricated: true,
    },
  ];
}

export function parseBreachSeverity(breach: HIBPBreach): string {
  const dc = breach.DataClasses.map(d => d.toLowerCase());
  if (dc.some(d => d.includes("password") || d.includes("credit card") || d.includes("bank"))) {
    return "critical";
  }
  if (dc.some(d => d.includes("phone") || d.includes("physical address") || d.includes("address"))) {
    return "high";
  }
  if (dc.some(d => d.includes("email") && dc.length === 1)) {
    return "medium";
  }
  if (dc.length === 0 || (dc.length === 1 && dc[0] === "email addresses")) {
    return "medium";
  }
  return "low";
}

export function mapBreachToIncident(
  breach: HIBPBreach,
  customerId: number,
  domain: string,
): LeakageIncidentInput {
  const raw: Record<string, unknown> = { ...breach as unknown as Record<string, unknown> };
  // KVKK — şifre hash'lerini sil
  delete raw["password"];
  delete raw["hash"];
  delete raw["password_hash"];
  delete raw["passwordHash"];

  return {
    customerId,
    customerDomain: domain,
    breachSource: breach.Title || breach.Name,
    breachDate: breach.BreachDate ?? null,
    affectedEmailCount: breach.PwnCount,
    affectedEmails: [],
    dataTypes: breach.DataClasses.map(d => d.toLowerCase()),
    severity: parseBreachSeverity(breach),
    sourceApi: "hibp",
    rawResponse: raw,
  };
}

export async function getBreachesForDomain(domain: string): Promise<LeakageIncidentInput[]> {
  if (!HIBP_API_KEY) {
    logger.warn({ domain }, "HIBP_API_KEY eksik — test modu (mock data)");
    return mockBreaches().map(b => mapBreachToIncident(b, 0, domain));
  }

  // Rate limit delay (HIBP zorunluluğu)
  await sleep(1500);

  const url = `${HIBP_BASE}/breacheddomain/${encodeURIComponent(domain)}`;

  async function fetchOnce(): Promise<Response> {
    return fetch(url, {
      headers: {
        "hibp-api-key": HIBP_API_KEY!,
        "User-Agent": "CyberStep-LeakageMonitor/1.0",
      },
    });
  }

  let resp = await fetchOnce();

  if (resp.status === 429) {
    logger.warn({ domain }, "HIBP 429 — 10s beklenip tekrar deneniyor");
    await sleep(10_000);
    resp = await fetchOnce();
  }

  if (resp.status === 404) {
    logger.info({ domain }, "HIBP: sızıntı bulunamadı");
    return [];
  }

  if (!resp.ok) {
    logger.error({ domain, status: resp.status }, "HIBP API hatası");
    return [];
  }

  let breaches: HIBPBreach[];
  try {
    // HIBP /breacheddomain returns { email: [breach1, ...] }
    // or /breachedaccount returns array directly
    const raw = await resp.json() as HIBPBreach[] | Record<string, HIBPBreach[]>;
    if (Array.isArray(raw)) {
      breaches = raw;
    } else {
      // breacheddomain response: { "user@domain.com": ["BreachName", ...] }
      // Fall back to domain-level search via /breaches?domain=
      const domainUrl = `${HIBP_BASE}/breaches?domain=${encodeURIComponent(domain)}`;
      await sleep(1500);
      const domainResp = await fetch(domainUrl, {
        headers: {
          "hibp-api-key": HIBP_API_KEY!,
          "User-Agent": "CyberStep-LeakageMonitor/1.0",
        },
      });
      if (!domainResp.ok) return [];
      breaches = await domainResp.json() as HIBPBreach[];
    }
  } catch (err) {
    logger.error({ err, domain }, "HIBP response parse hatası");
    return [];
  }

  return breaches.map(b => mapBreachToIncident(b, 0, domain));
}
