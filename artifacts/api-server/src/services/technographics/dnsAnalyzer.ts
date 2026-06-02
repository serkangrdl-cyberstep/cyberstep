import dns from "dns";
import type { TechStack } from "./types";

export async function analyzeDNS(domain: string): Promise<TechStack[]> {
  const found: TechStack[] = [];
  try {
    // ─── MX KAYITLARI — E-POSTA SAĞLAYICISI ────────────────
    const mxRecords = await dns.promises.resolveMx(domain).catch(() => []);
    const mxString = mxRecords.map((m) => m.exchange).join(" ").toLowerCase();
    const mailProviders = [
      { pattern: "google",                                    vendor: "google",     product: "Google Workspace",        salesSignal: "has_google_workspace" },
      { pattern: "outlook.com|protection.outlook|mail.protection", vendor: "microsoft", product: "Microsoft 365",       salesSignal: "has_microsoft365" },
      { pattern: "yandex",                                    vendor: "yandex",     product: "Yandex Mail",             salesSignal: "budget_indicator_low" },
      { pattern: "zoho",                                      vendor: "zoho",       product: "Zoho Mail",               salesSignal: "budget_indicator_medium" },
      { pattern: "pphosted|proofpoint",                       vendor: "proofpoint", product: "Proofpoint Email Security", salesSignal: "budget_indicator_high" },
      { pattern: "mimecast",                                  vendor: "mimecast",   product: "Mimecast",                salesSignal: "budget_indicator_high" },
      { pattern: "barracudanetworks",                         vendor: "barracuda",  product: "Barracuda Email Security", salesSignal: "budget_indicator_high" },
    ];
    for (const provider of mailProviders) {
      if (new RegExp(provider.pattern, "i").test(mxString)) {
        found.push({ category: "mail", vendor: provider.vendor, product: provider.product, confidence: 98, detectedVia: "dns", salesSignal: provider.salesSignal, evidence: { mxRecords: mxRecords.map((m) => m.exchange) } });
        break;
      }
    }

    // ─── TXT KAYITLARI — SPF, DMARC, DOĞRULAMA ─────────────
    const txtRecords = await dns.promises.resolveTxt(domain).catch(() => [] as string[][]);
    const txtFlat = txtRecords.flat().join("\n").toLowerCase();

    if (txtFlat.includes("v=spf1")) {
      const spfLine = txtRecords.flat().find((t) => t.toLowerCase().startsWith("v=spf1")) || "";
      const spfLower = spfLine.toLowerCase();

      // SPF'ten e-posta servisi çapraz-doğrulama
      if (spfLower.includes("_spf.google.com")) {
        found.push({ category: "mail", vendor: "google", product: "Google Workspace (SPF)", confidence: 95, detectedVia: "dns", evidence: { spf: spfLine } });
      }
      if (spfLower.includes("spf.protection.outlook")) {
        found.push({ category: "mail", vendor: "microsoft", product: "Microsoft 365 (SPF)", confidence: 95, detectedVia: "dns", evidence: { spf: spfLine } });
      }
      // E-posta pazarlama servisleri
      if (spfLower.includes("sendgrid") || spfLower.includes("em.amazonaws")) {
        found.push({ category: "mail_marketing", vendor: "sendgrid", product: "SendGrid / Transactional Email", confidence: 85, detectedVia: "dns", evidence: { spf: spfLine } });
      }

      found.push({ category: "mail_security", vendor: "spf", product: "SPF Kaydı", confidence: 100, detectedVia: "dns", evidence: { spf: spfLine } });
    }

    // ─── DMARC ─────────────────────────────────────────────
    const dmarcRecords = await dns.promises.resolveTxt(`_dmarc.${domain}`).catch(() => [] as string[][]);
    const dmarcFlat = dmarcRecords.flat().join("").toLowerCase();
    if (dmarcFlat.includes("v=dmarc1")) {
      const policy = dmarcFlat.match(/p=(none|quarantine|reject)/)?.[1];
      found.push({
        category: "mail_security", vendor: "dmarc",
        product: `DMARC (p=${policy || "unknown"})`, confidence: 100, detectedVia: "dns",
        securityNote: policy === "reject" ? "Tam koruma" : policy === "quarantine" ? "Kısmi koruma" : "Koruma yok (none)",
        securityRisk: policy === "none" ? "high" : "low",
        evidence: { dmarc: dmarcFlat },
      });
    }

    // ─── NS KAYITLARI — DNS SAĞLAYICISI ────────────────────
    const nsRecords = await dns.promises.resolveNs(domain).catch(() => [] as string[]);
    const nsString = nsRecords.join(" ").toLowerCase();
    const dnsProviders: Record<string, [string, string]> = {
      cloudflare:  ["cloudflare",  "Cloudflare DNS"],
      awsdns:      ["aws",         "AWS Route53"],
      "azure-dns": ["microsoft",   "Azure DNS"],
      dnsmadeeasy: ["dnsmadeeasy", "DNS Made Easy"],
      natro:       ["natro",       "Natro DNS"],
      isimtescil:  ["isimtescil",  "İsimtescil DNS"],
    };
    for (const [pattern, [vendor, product]] of Object.entries(dnsProviders)) {
      if (nsString.includes(pattern)) {
        found.push({ category: "dns_provider", vendor, product, confidence: 95, detectedVia: "dns", evidence: { nsRecords } });
        break;
      }
    }
  } catch {
    // DNS analizi başarısız
  }
  return found;
}
