/**
 * Web contact scraper.
 * Fetches common contact/about pages and extracts email addresses using regex.
 * Prioritises domain-specific emails over generic info@/iletisim@ etc.
 */
import { logger } from "../lib/logger";

const CONTACT_PATHS = [
  "/iletisim", "/contact", "/hakkimizda", "/about",
  "/bize-ulasin", "/bize-ulasin.html", "/iletisim.html",
  "/contact.html", "/contact-us", "/tr/iletisim",
];

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/gi;

const SKIP_PATTERNS = [
  "noreply", "no-reply", "example", "sentry", "wordpress",
  "schema", "wpcf7", "jquery", "test@", "email@", "user@",
  "your@", "name@", "domain@", ".png", ".jpg", ".gif", ".svg",
];

function filterEmails(emails: string[], domain: string): string[] {
  const domainBase = domain.replace(/^www\./, "").split(".")[0]!.toLowerCase();
  return emails.filter((e) => {
    const lo = e.toLowerCase();
    if (SKIP_PATTERNS.some((p) => lo.includes(p))) return false;
    return true;
  }).sort((a, b) => {
    // domain-specific emails first
    const aMatch = a.toLowerCase().includes(domainBase) ? 0 : 1;
    const bMatch = b.toLowerCase().includes(domainBase) ? 0 : 1;
    return aMatch - bMatch;
  });
}

async function fetchPage(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CyberStep-Enrichment/1.0)",
        "Accept": "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const text = await res.text();
    return text;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

export interface WebContact {
  email: string;
  sourcePath: string;
}

export async function scrapeContactEmail(domain: string): Promise<WebContact | null> {
  // Try homepage first (sometimes email is in footer)
  const allPaths = ["/", ...CONTACT_PATHS];

  for (const path of allPaths) {
    const url = `https://${domain}${path}`;
    try {
      const html = await fetchPage(url);
      if (!html) continue;

      // Also check mailto: links which are very reliable
      const mailtoRe = /mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi;
      const mailtoEmails: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = mailtoRe.exec(html)) !== null) {
        if (m[1]) mailtoEmails.push(m[1]);
      }

      const rawEmails = html.match(EMAIL_RE) ?? [];
      const combined = [...new Set([...mailtoEmails, ...rawEmails])];
      const filtered = filterEmails(combined, domain);

      if (filtered.length > 0) {
        logger.info({ domain, path, email: filtered[0] }, "Web contact scraper found email");
        return { email: filtered[0]!, sourcePath: path };
      }
    } catch (err) {
      logger.warn({ domain, path, err: String(err) }, "Web scrape error");
    }
  }

  return null;
}
