import { logger } from "../lib/logger";

export interface CodeSecretResult {
  customerId: number;
  platform: "github";
  repoUrl: string;
  repoName: string;
  repoVisibility: "public";
  filePath: string;
  secretType: string;
  secretPreview: string;
  severity: string;
}

interface SecretPattern {
  type: string;
  pattern: RegExp;
  severity: string;
}

const SECRET_PATTERNS: SecretPattern[] = [
  { type: "aws_access_key",  pattern: /AKIA[0-9A-Z]{16}/,                         severity: "critical" },
  { type: "github_token",    pattern: /ghp_[0-9a-zA-Z]{36}/,                       severity: "critical" },
  { type: "stripe_live_key", pattern: /sk_live_[0-9a-zA-Z]{24}/,                   severity: "critical" },
  { type: "private_key",     pattern: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/,     severity: "critical" },
  { type: "sendgrid_key",    pattern: /SG\.[0-9A-Za-z\-_]{22}\.[0-9A-Za-z\-_]{43}/, severity: "high" },
  { type: "jwt_secret",      pattern: /jwt[_-]?secret\s*[=:]\s*["']([^"']{8,})/i, severity: "high" },
  { type: "db_connection",   pattern: /mongodb(\+srv)?:\/\/[^:]+:[^@]+@/,           severity: "high" },
  { type: "db_connection_pg",pattern: /postgresql:\/\/[^:]+:[^@]+@/,               severity: "high" },
  { type: "generic_api_key", pattern: /api[_-]?key\s*[=:]\s*["']([a-zA-Z0-9_\-]{20,})/i, severity: "medium" },
];

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function makePreview(secret: string): string {
  if (secret.length > 8) return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
  return "****";
}

interface GithubRepo {
  html_url: string;
  full_name: string;
}

interface GithubSearchItem {
  path: string;
  url: string;
}

interface GithubFileResponse {
  content: string;
}

async function githubFetch<T>(url: string, params?: Record<string, string>): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "CyberStep-SecurityScanner/1.0",
  };
  const token = process.env["GITHUB_TOKEN"];
  if (token) headers["Authorization"] = `token ${token}`;

  const u = new URL(url);
  if (params) Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));

  const res = await fetch(u.toString(), { headers, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${url}`);
  return res.json() as Promise<T>;
}

export async function scanGitHubOrg(orgOrUser: string, customerId: number): Promise<CodeSecretResult[]> {
  const findings: CodeSecretResult[] = [];

  let repos: GithubRepo[];
  try {
    repos = await githubFetch<GithubRepo[]>(
      `https://api.github.com/users/${orgOrUser}/repos`,
      { type: "public", per_page: "100" }
    );
  } catch (err) {
    logger.warn({ err, orgOrUser }, "githubScanner: could not fetch repos");
    return findings;
  }

  for (const repo of repos) {
    for (const pattern of SECRET_PATTERNS) {
      try {
        const searchData = await githubFetch<{ items: GithubSearchItem[] }>(
          "https://api.github.com/search/code",
          {
            q: `${pattern.type.replace("_", " ")} repo:${repo.full_name}`,
            per_page: "10",
          }
        );

        for (const item of searchData.items ?? []) {
          try {
            const fileData = await githubFetch<GithubFileResponse>(item.url);
            const content = Buffer.from(fileData.content, "base64").toString("utf8");
            const match = pattern.pattern.exec(content);
            if (match) {
              const secret = match[0];
              findings.push({
                customerId,
                platform: "github",
                repoUrl: repo.html_url,
                repoName: repo.full_name,
                repoVisibility: "public",
                filePath: item.path,
                secretType: pattern.type,
                secretPreview: makePreview(secret),
                severity: pattern.severity,
              });
            }
          } catch { /* file fetch error */ }
          await sleep(500);
        }
        await sleep(2000);
      } catch { /* search error, rate limit */ }
    }
  }

  return findings;
}

export async function getCustomersWithGitHub() {
  const { db } = await import("@workspace/db");
  const { customersTable } = await import("@workspace/db");
  const { isNotNull } = await import("drizzle-orm");
  return db.select({ id: customersTable.id, githubOrg: customersTable.githubOrg })
    .from(customersTable)
    .where(isNotNull(customersTable.githubOrg));
}
