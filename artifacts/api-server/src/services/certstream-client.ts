/**
 * Certstream WebSocket client — listens to wss://certstream.calidog.io
 * and matches incoming certificate SANs against customer watched domains.
 * Suspicious domain detection: SAN contains the watched domain string but
 * is NOT the domain itself or a valid subdomain → phishing signal.
 */

import WebSocket from "ws";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { createCaseWithNumber } from "./soc/soc-cases";

const CERTSTREAM_URL = "wss://certstream.calidog.io";
const DOMAIN_CACHE_TTL_MS = 60_000; // 1 minute

interface WatchedDomainRow {
  id: number;
  customer_id: number;
  domain: string;
}

interface CertstreamMessage {
  message_type: string;
  data: {
    leaf_cert: {
      subject: { CN?: string };
      all_domains: string[];
      not_before: number | null;
      not_after: number | null;
      fingerprint: string | null;
      issuer: { O?: string; CN?: string };
    };
  };
}

let cachedDomains: WatchedDomainRow[] = [];
let cacheExpiry = 0;

async function fetchWatchedDomains(): Promise<WatchedDomainRow[]> {
  const now = Date.now();
  if (now < cacheExpiry && cachedDomains.length > 0) return cachedDomains;
  try {
    const rows = await db.execute(sql`
      SELECT d.id, d.customer_id, d.domain
      FROM dns_watched_domains d
      WHERE d.is_active = true
    `);
    cachedDomains = rows.rows as unknown as WatchedDomainRow[];
    cacheExpiry = now + DOMAIN_CACHE_TTL_MS;
    return cachedDomains;
  } catch (err) {
    logger.error({ err }, "certstream: failed to fetch watched domains");
    return cachedDomains;
  }
}

function isSuspicious(san: string, watchedDomain: string): boolean {
  const s = san.toLowerCase();
  const d = watchedDomain.toLowerCase();
  const isExact = s === d;
  const isSubdomain = s.endsWith(`.${d}`);
  const contains = s.includes(d) || s.replace(/[^a-z0-9]/g, "").includes(d.replace(/[^a-z0-9]/g, ""));
  return !isExact && !isSubdomain && contains;
}

function matchesDomain(san: string, watchedDomain: string): boolean {
  const s = san.toLowerCase().replace(/^\*\./, "");
  const d = watchedDomain.toLowerCase();
  return s === d || s.endsWith(`.${d}`) || d.endsWith(`.${s}`);
}

async function processCertificate(cert: CertstreamMessage["data"]["leaf_cert"]): Promise<void> {
  const sans: string[] = Array.isArray(cert.all_domains) ? cert.all_domains : [];
  if (sans.length === 0) return;

  const watched = await fetchWatchedDomains();
  if (watched.length === 0) return;

  const fingerprint = cert.fingerprint ?? null;
  const issuer = cert.issuer?.O ?? cert.issuer?.CN ?? null;
  const notBefore = cert.not_before ? new Date(cert.not_before * 1000) : null;
  const notAfter = cert.not_after ? new Date(cert.not_after * 1000) : null;

  for (const row of watched) {
    const matchingSans = sans.filter(san => matchesDomain(san, row.domain) || isSuspicious(san, row.domain));
    if (matchingSans.length === 0) continue;

    for (const san of matchingSans) {
      const suspicious = isSuspicious(san, row.domain);

      try {
        await db.execute(sql`
          INSERT INTO ct_certificate_events
            (customer_id, domain, cert_domain, issuer, sans, not_before, not_after, cert_fingerprint, detected_at, is_suspicious)
          VALUES
            (${row.customer_id}, ${row.domain}, ${san}, ${issuer}, ${JSON.stringify(sans)}::jsonb,
             ${notBefore?.toISOString() ?? null}, ${notAfter?.toISOString() ?? null},
             ${fingerprint}, NOW(), ${suspicious})
          ON CONFLICT (cert_fingerprint, domain) DO NOTHING
        `);
      } catch (err) {
        logger.warn({ err, domain: row.domain, san }, "certstream: insert skipped");
        continue;
      }

      if (suspicious) {
        const validUntil = notAfter
          ? `Sertifika geçerliliği: ${notAfter.toLocaleDateString("tr-TR")}`
          : "";
        const sanList = sans.slice(0, 8).join(", ");
        await createCaseWithNumber({
          customerId: row.customer_id,
          title: `Şüpheli CT Olayı: ${san} (izlenen: ${row.domain})`,
          description:
            `Certstream CT Log akışında izlenen domain'inizi içeren şüpheli bir sertifika tespit edildi.\n\n` +
            `İzlenen domain: ${row.domain}\n` +
            `Sertifikadaki domain: ${san}\n` +
            `Sertifika yayıncısı: ${issuer ?? "Bilinmiyor"}\n` +
            `SANs: ${sanList}\n` +
            `${validUntil}\n\n` +
            `Bu sertifika phishing saldırısına hazırlık amacıyla alınmış olabilir. ` +
            `Doğrulamak için sertifika yayıncısını ve domain sahibini kontrol edin.`,
          severity: "high",
          category: "ct-log",
          attackNarrative:
            `Domain'inizi (${row.domain}) içeren "${san}" adına SSL sertifikası kesilmesi, ` +
            `phishing altyapısı hazırlığının en erken sinyalidir. Saldırgan HTTPS bağlantısıyla ` +
            `müşterilerinizi kandırabilir. Let's Encrypt gibi CA'lar otomatik sertifika verir — ` +
            `bu nedenle phishing siteleri artık HTTPS kullanıyor.`,
          triggerEventIds: [],
        }).catch(err => logger.error({ err }, "certstream: SOC case creation failed"));
        logger.info({ domain: row.domain, san, issuer }, "certstream: suspicious cert → SOC case created");
      } else {
        logger.info({ domain: row.domain, san, issuer, suspicious: false }, "certstream: cert event recorded");
      }
    }
  }
}

let ws: WebSocket | null = null;
let reconnectDelay = 5_000;
let stopped = false;

function connect(): void {
  if (stopped) return;
  logger.info({ url: CERTSTREAM_URL }, "certstream: connecting");

  ws = new WebSocket(CERTSTREAM_URL);

  ws.on("open", () => {
    reconnectDelay = 5_000;
    logger.info("certstream: connected to certstream.calidog.io");
  });

  ws.on("message", (data: WebSocket.RawData) => {
    let msg: CertstreamMessage;
    try {
      msg = JSON.parse(data.toString()) as CertstreamMessage;
    } catch {
      return;
    }
    if (msg.message_type !== "certificate_update" || !msg.data?.leaf_cert) return;
    processCertificate(msg.data.leaf_cert).catch(err =>
      logger.warn({ err }, "certstream: processCertificate error"),
    );
  });

  ws.on("error", (err) => {
    logger.warn({ err: String(err) }, "certstream: WebSocket error");
  });

  ws.on("close", () => {
    if (stopped) return;
    logger.warn({ delayMs: reconnectDelay }, "certstream: connection closed, reconnecting");
    setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 2, 120_000);
      connect();
    }, reconnectDelay);
  });
}

export function startCertstreamClient(): void {
  stopped = false;
  connect();
}

export function stopCertstreamClient(): void {
  stopped = true;
  ws?.close();
  ws = null;
}
