/**
 * CT Log phishing monitor — polls crt.sh every 4 hours per watched domain.
 * Replaces the defunct Certstream WebSocket connection (non-functional in Replit).
 */
import axios from "axios";
import { db } from "@workspace/db";
import { ctCertificateEventsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { sendMail } from "./email";
import { createCaseWithNumber } from "./soc/soc-cases";

interface WatchedDomainRow {
  id: number;
  customer_id: number;
  domain: string;
  contact_email: string | null;
}

interface CrtShCert {
  id?: number;
  issuer_name?: string;
  common_name?: string;
  name_value?: string;
  entry_timestamp?: string;
  not_before?: string;
  not_after?: string;
}

/** Simple Levenshtein distance — suitable for short domain name comparisons. */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] = a[i - 1] === b[j - 1]
        ? dp[i - 1]![j - 1]!
        : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
    }
  }
  return dp[m]![n]!;
}

const SUSPICIOUS_KEYWORDS = [
  "login", "secure", "account", "bank", "verify", "update",
  "signin", "support", "webmail", "portal", "billing",
  "güvenlik", "giris", "giriş", "odeme", "ödeme",
];

/**
 * Returns a reason string if certDomain looks like a typosquat/phishing
 * of watchedDomain, or null if the domain is legitimate.
 */
function getSuspiciousReason(certDomain: string, watchedDomain: string): string | null {
  const cert = certDomain.toLowerCase().replace(/^\*\./, "");
  const watched = watchedDomain.toLowerCase();

  if (cert === watched || cert.endsWith(`.${watched}`)) return null;

  const watchedBase = watched.split(".")[0] ?? watched;
  const certWithoutTLD = cert.replace(/\.[a-z.]+$/, "");

  if (certWithoutTLD.includes(watchedBase) && cert !== watched) {
    return "typosquatting:substring";
  }

  const dist = levenshtein(certWithoutTLD, watchedBase);
  if (dist <= 2 && dist > 0) {
    return `typosquatting:levenshtein:${dist}`;
  }

  for (const kw of SUSPICIOUS_KEYWORDS) {
    if (cert.includes(kw) && cert.includes(watchedBase)) {
      return `keyword:${kw}`;
    }
  }

  return null;
}

async function fetchCrtshForDomain(domain: string): Promise<CrtShCert[]> {
  try {
    const response = await axios.get("https://crt.sh/", {
      params: { q: `%.${domain}`, output: "json" },
      timeout: 20_000,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CyberStep-SecurityResearch/1.0)",
        "Accept": "application/json",
      },
    });
    return (response.data ?? []) as CrtShCert[];
  } catch (err) {
    logger.warn({ domain, err: String(err) }, "ctPhishingMonitor: crt.sh isteği başarısız");
    return [];
  }
}

export async function checkPhishingCertificates(): Promise<number> {
  const rows = await db.execute(sql`
    SELECT d.id, d.customer_id, d.domain, c.contact_email
    FROM dns_watched_domains d
    JOIN customers c ON c.id = d.customer_id
    WHERE d.is_active = true
  `);
  const watchedDomains = rows.rows as unknown as WatchedDomainRow[];

  if (watchedDomains.length === 0) return 0;

  const cutoff = new Date(Date.now() - 4 * 3600 * 1000);
  let totalSuspicious = 0;

  for (const row of watchedDomains) {
    try {
      const certs = await fetchCrtshForDomain(row.domain);

      for (const cert of certs) {
        if (cert.entry_timestamp && new Date(cert.entry_timestamp) < cutoff) continue;

        const certDomains: string[] = [];
        if (cert.common_name) certDomains.push(cert.common_name);
        if (cert.name_value) {
          cert.name_value.split("\n").map(d => d.trim()).filter(Boolean).forEach(d => certDomains.push(d));
        }

        for (const certDomain of certDomains) {
          const reason = getSuspiciousReason(certDomain, row.domain);
          if (!reason) continue;

          const issuer = cert.issuer_name ?? null;
          const notBefore = cert.not_before ? new Date(cert.not_before) : null;
          const notAfter = cert.not_after ? new Date(cert.not_after) : null;
          const fingerprint = cert.id != null ? `crtsh:${cert.id}` : null;

          try {
            const inserted = await db.insert(ctCertificateEventsTable).values({
              customerId: row.customer_id,
              domain: row.domain,
              certDomain,
              issuer,
              sans: certDomains,
              notBefore,
              notAfter,
              certFingerprint: fingerprint,
              isSuspicious: true,
            }).onConflictDoNothing().returning({ id: ctCertificateEventsTable.id });

            if (inserted.length === 0) continue;
          } catch {
            continue;
          }

          totalSuspicious++;
          logger.info({ domain: row.domain, certDomain, reason }, "ctPhishingMonitor: şüpheli sertifika tespit edildi");

          if (row.contact_email) {
            const validUntil = notAfter ? notAfter.toLocaleDateString("tr-TR") : "Bilinmiyor";
            await sendMail({
              to: row.contact_email,
              subject: `Uyari: Supheli SSL Sertifikasi Tespit Edildi — ${row.domain}`,
              html: `
                <p>Merhaba,</p>
                <p>Izlediginiz <strong>${row.domain}</strong> alan adini taklit eden supheli bir SSL sertifikasi tespit edildi.</p>
                <table style="border-collapse:collapse;margin:16px 0;font-family:sans-serif">
                  <tr><td style="padding:4px 12px;font-weight:bold;background:#f5f5f5">Izlenen Domain</td><td style="padding:4px 12px">${row.domain}</td></tr>
                  <tr><td style="padding:4px 12px;font-weight:bold;background:#f5f5f5">Supheli Domain</td><td style="padding:4px 12px;color:#c0392b"><strong>${certDomain}</strong></td></tr>
                  <tr><td style="padding:4px 12px;font-weight:bold;background:#f5f5f5">Sertifika Yayincisi</td><td style="padding:4px 12px">${issuer ?? "Bilinmiyor"}</td></tr>
                  <tr><td style="padding:4px 12px;font-weight:bold;background:#f5f5f5">Gecerlilik Bitis</td><td style="padding:4px 12px">${validUntil}</td></tr>
                  <tr><td style="padding:4px 12px;font-weight:bold;background:#f5f5f5">Tespit Nedeni</td><td style="padding:4px 12px">${reason}</td></tr>
                </table>
                <p>Bu sertifika, musterilerinizi hedef alan bir phishing saldirisi icin hazirlanmis olabilir.
                Sertifika sahibini ve alan adi kaydini kontrol etmenizi oneririz.</p>
                <p>Detaylar icin <a href="https://crt.sh/?q=${encodeURIComponent(certDomain)}">crt.sh</a> uzerinden sertifikaya ulasabilirsiniz.</p>
                <p>CyberStep.io Guvenlik Ekibi</p>
              `,
            }).catch(err => logger.warn({ err: String(err) }, "ctPhishingMonitor: e-posta gonderilemedi"));
          }

          await createCaseWithNumber({
            customerId: row.customer_id,
            title: `Supheli CT Olayi: ${certDomain} (izlenen: ${row.domain})`,
            description:
              `crt.sh CT Log taramasinda izlenen domain'inizi taklit eden supheli bir sertifika tespit edildi.\n\n` +
              `Izlenen domain: ${row.domain}\n` +
              `Sertifikadaki domain: ${certDomain}\n` +
              `Sertifika yayincisi: ${issuer ?? "Bilinmiyor"}\n` +
              `Tespit nedeni: ${reason}\n\n` +
              `Bu sertifika phishing altyapisi hazirliginin erken sinyali olabilir. ` +
              `Sertifika sahibini ve alan adi sahibini kontrol edin.`,
            severity: "high",
            category: "ct-log",
            attackNarrative:
              `"${certDomain}" adina kesilen sertifika, ${row.domain} domain'inizi taklit ederek ` +
              `HTTPS phishing saldirisi hazirliginin gostergesidir. Let's Encrypt gibi CA'lar ucretsiz ` +
              `sertifika verdiginden saldirganlarin artik HTTPS ile guvenilir gorundugu unutulmamalidir.`,
            triggerEventIds: [],
          }).catch(err => logger.error({ err }, "ctPhishingMonitor: SOC vakasi olusturulamadi"));
        }
      }

      await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      logger.error({ err, domain: row.domain }, "ctPhishingMonitor: domain kontrolu basarisiz");
    }
  }

  return totalSuspicious;
}
