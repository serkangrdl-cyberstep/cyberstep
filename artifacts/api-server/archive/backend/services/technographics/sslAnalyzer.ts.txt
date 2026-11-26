import axios from "axios";
import https from "https";
import type { TechStack } from "./types";

export async function analyzeSSL(domain: string): Promise<TechStack[]> {
  const found: TechStack[] = [];
  try {
    const resp = await axios.get(`https://${domain}`, {
      timeout: 8000,
      validateStatus: null,
      httpsAgent: new https.Agent({ rejectUnauthorized: false, checkServerIdentity: () => undefined }),
    });

    const cert = (resp.request as any)?.socket?.getPeerCertificate?.(true);
    if (!cert) return found;

    const issuer = (cert.issuer?.O || "").toLowerCase();
    const caMap: Record<string, { vendor: string; product: string; signal: string; note: string }> = {
      "let's encrypt": { vendor: "letsencrypt", product: "Let's Encrypt (DV)", signal: "budget_indicator_low", note: "Ücretsiz sertifika — maliyet odaklı" },
      zerossl: { vendor: "zerossl", product: "ZeroSSL (DV)", signal: "budget_indicator_low", note: "Ücretsiz/düşük maliyetli sertifika" },
      digicert: { vendor: "digicert", product: "DigiCert (OV/EV)", signal: "budget_indicator_high", note: "Kurumsal sertifika — bütçe var" },
      comodo: { vendor: "comodo", product: "Comodo/Sectigo", signal: "budget_indicator_medium", note: "Orta ölçekli sertifika" },
      globalsign: { vendor: "globalsign", product: "GlobalSign (EV)", signal: "budget_indicator_high", note: "Kurumsal EV sertifika" },
      entrust: { vendor: "entrust", product: "Entrust (EV)", signal: "budget_indicator_enterprise", note: "Enterprise sertifika" },
    };
    for (const [pattern, info] of Object.entries(caMap)) {
      if (issuer.includes(pattern)) {
        found.push({ category: "ssl_ca", vendor: info.vendor, product: info.product, confidence: 100, detectedVia: "ssl_cert", salesSignal: info.signal, securityNote: info.note, evidence: { issuer: cert.issuer?.O, subject: cert.subject?.O } });
        break;
      }
    }

    const certOrg = cert.subject?.O;
    if (certOrg && certOrg.length > 2) {
      found.push({ category: "company_name_from_cert", vendor: "ssl", product: certOrg, confidence: 85, detectedVia: "ssl_cert", evidence: { certSubject: cert.subject } });
    }

    const certCN = cert.subject?.CN || "";
    if (certCN.includes("cloudflare") || issuer.includes("cloudflare")) {
      found.push({ category: "cdn", vendor: "cloudflare", product: "Cloudflare CDN", confidence: 95, detectedVia: "ssl_cert" });
    }

    const tlsVersion = (resp.request as any)?.socket?.getProtocol?.();
    if (tlsVersion && ["TLSv1", "TLSv1.1"].includes(tlsVersion)) {
      found.push({ category: "tls_version", vendor: "tls", product: `TLS Eski Versiyon (${tlsVersion})`, confidence: 95, detectedVia: "ssl_cert", securityRisk: "high", securityNote: `${tlsVersion} destekleniyor — güncel değil` });
    }
  } catch {
    // SSL analizi başarısız
  }
  return found;
}
