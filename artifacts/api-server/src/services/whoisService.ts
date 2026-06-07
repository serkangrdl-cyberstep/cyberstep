/**
 * WHOIS email enrichment.
 * For .com.tr / .tr domains uses whois.nic.tr directly over TCP (port 43).
 * For other TLDs falls back to whois.iana.org to discover the authoritative
 * server, then queries that server.
 */
import * as net from "net";
import { logger } from "../lib/logger";

const SKIP_EMAILS = [
  "abuse", "noreply", "no-reply", "hostmaster", "postmaster",
  "webmaster", "admin", "dnsadmin", "whois", "noc", "nic", "registry",
  "support@nic", "info@nic", "domain@nic",
];

function extractEmails(text: string): string[] {
  const re = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const all: string[] = text.match(re) ?? [];
  return all.filter((e) => {
    const lo = e.toLowerCase();
    return !SKIP_EMAILS.some((s) => lo.includes(s));
  });
}

function tcpWhois(domain: string, server: string, port = 43, timeout = 8000): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    const socket = net.createConnection(port, server);
    socket.setTimeout(timeout);

    socket.on("connect", () => socket.write(domain + "\r\n"));
    socket.on("data", (chunk: Buffer) => { data += chunk.toString(); });
    socket.on("end", () => resolve(data));
    socket.on("timeout", () => { socket.destroy(); resolve(data); });
    socket.on("error", () => resolve(data));
  });
}

export async function whoisLookup(domain: string): Promise<string | null> {
  try {
    let server = "whois.iana.org";

    const tld = domain.split(".").slice(-2).join(".");
    if (tld.endsWith(".tr") || domain.endsWith(".com.tr") || domain.endsWith(".net.tr") ||
        domain.endsWith(".org.tr") || domain.endsWith(".bel.tr") || domain.endsWith(".edu.tr")) {
      server = "whois.nic.tr";
    }

    const raw = await tcpWhois(domain, server);
    if (!raw) return null;

    // If IANA returned a referral, follow it once
    if (server === "whois.iana.org") {
      const refMatch = raw.match(/whois:\s+([^\s\r\n]+)/i);
      if (refMatch?.[1] && refMatch[1] !== "whois.iana.org") {
        const refRaw = await tcpWhois(domain, refMatch[1]);
        const emails = extractEmails(refRaw);
        return emails[0] ?? null;
      }
    }

    const emails = extractEmails(raw);
    return emails[0] ?? null;
  } catch (err) {
    logger.warn({ domain, err: String(err) }, "WHOIS lookup failed");
    return null;
  }
}
