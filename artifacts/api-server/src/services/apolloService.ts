import { logger } from "../lib/logger";

export interface ApolloCompany {
  name: string;
  domain: string;
  city?: string;
  employeeCount?: number;
  sector?: string;
}

export interface ApolloContact {
  name: string;
  title: string;
  email?: string;
  linkedinUrl?: string;
  confidence?: "high" | "medium" | "low";
  source: "apollo";
}

function getApiKey(): string | null {
  return process.env["APOLLO_API_KEY"] ?? null;
}

export async function searchCompanies(params: {
  sector: string;
  minEmployees?: number;
  maxEmployees?: number;
  cities?: string[];
}): Promise<ApolloCompany[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    logger.warn("APOLLO_API_KEY not set — returning empty company list");
    return [];
  }

  try {
    const body: Record<string, unknown> = {
      page: 1,
      per_page: 25,
      organization_num_employees_ranges: [`${params.minEmployees ?? 10},${params.maxEmployees ?? 500}`],
      organization_industry_tag_ids: [],
    };

    if (params.cities?.length) {
      body["organization_locations"] = params.cities;
    }

    const res = await fetch("https://api.apollo.io/v1/mixed_companies/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, "Apollo company search failed");
      return [];
    }

    const data = await res.json() as {
      organizations: Array<{
        name: string;
        primary_domain?: string;
        city?: string;
        estimated_num_employees?: number;
        industry?: string;
      }>;
    };

    return (data.organizations ?? [])
      .filter(o => !!o.primary_domain)
      .map(o => ({
        name: o.name,
        domain: o.primary_domain!,
        city: o.city,
        employeeCount: o.estimated_num_employees,
        sector: o.industry,
      }));
  } catch (err) {
    logger.error({ err }, "Apollo searchCompanies error");
    return [];
  }
}

export async function findDecisionMakers(domain: string): Promise<ApolloContact[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    logger.warn("APOLLO_API_KEY not set — returning empty contact list");
    return [];
  }

  try {
    const res = await fetch("https://api.apollo.io/v1/mixed_people/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify({
        page: 1,
        per_page: 10,
        q_organization_domains: [domain],
        person_titles: [
          "CIO", "CISO", "IT Manager", "IT Director",
          "Bilgi Teknolojileri Müdürü", "IT Müdürü",
          "Sistem Yöneticisi", "Güvenlik Müdürü",
          "Genel Müdür", "CFO", "COO",
        ],
      }),
    });

    if (!res.ok) {
      logger.warn({ domain, status: res.status }, "Apollo people search failed");
      return [];
    }

    const data = await res.json() as {
      people: Array<{
        name: string;
        title?: string;
        email?: string;
        linkedin_url?: string;
        email_status?: string;
      }>;
    };

    return (data.people ?? []).map(p => ({
      name: p.name,
      title: p.title ?? "",
      email: p.email,
      linkedinUrl: p.linkedin_url,
      confidence: p.email_status === "verified" ? "high" : "medium",
      source: "apollo" as const,
    }));
  } catch (err) {
    logger.error({ err, domain }, "Apollo findDecisionMakers error");
    return [];
  }
}
