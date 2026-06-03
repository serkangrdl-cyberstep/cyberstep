import axios from "axios";
import dns from "dns";
import type { TechStack } from "./types";
import { detectCdn, classifyPort } from "../portRiskClassifier";

export async function analyzeShodan(domain: string): Promise<TechStack[]> {
  if (!process.env.SHODAN_API_KEY) return [];
  const found: TechStack[] = [];
  try {
    const ips = await dns.promises.resolve4(domain).catch(() => []);
    if (!ips.length) return found;

    const resp = await axios.get(`https://api.shodan.io/shodan/host/${ips[0]}`, { params: { key: process.env.SHODAN_API_KEY }, timeout: 10000 });
    const data = resp.data;

    // ─── HOSTİNG SAĞLAYICI (ASN/ISP) ───────────────────────
    const org = (data.org || "").toLowerCase();
    const isp = (data.isp || "").toLowerCase();
    const hostingMap: Record<string, [string, string, string]> = {
      amazon:          ["aws",          "Amazon AWS",        "budget_indicator_high"],
      microsoft:       ["azure",        "Microsoft Azure",   "budget_indicator_high"],
      google:          ["gcp",          "Google Cloud",      "budget_indicator_high"],
      hetzner:         ["hetzner",      "Hetzner",           "budget_indicator_medium"],
      digitalocean:    ["digitalocean", "DigitalOcean",      "budget_indicator_medium"],
      turkcell:        ["turkcell",     "Turkcell Bulut",    "budget_indicator_high"],
      "türk telekom":  ["tt",           "Türk Telekom",      "budget_indicator_medium"],
      superonline:     ["superonline",  "Superonline",       "budget_indicator_medium"],
      natro:           ["natro",        "Natro Hosting",     "budget_indicator_low"],
      hostinger:       ["hostinger",    "Hostinger",         "budget_indicator_low"],
    };
    for (const [pattern, [vendor, product, signal]] of Object.entries(hostingMap)) {
      if (org.includes(pattern) || isp.includes(pattern)) {
        found.push({ category: "hosting", vendor, product, confidence: 88, detectedVia: "shodan", salesSignal: signal, evidence: { org: data.org, isp: data.isp, asn: data.asn } });
        break;
      }
    }

    // ─── CDN tespiti ────────────────────────────────────────
    const cdnInfo = detectCdn(data.org ?? null);
    if (cdnInfo.detected) {
      found.push({
        category: "cdn",
        vendor: cdnInfo.provider?.toLowerCase().replace(/\s+/g, "_") ?? "cdn",
        product: cdnInfo.provider ?? "CDN",
        confidence: 95,
        detectedVia: "shodan",
        salesSignal: undefined,
        evidence: { org: data.org, cdn: cdnInfo.provider },
      });
    }

    // ─── AÇIK PORTLAR — bağlama duyarlı risk ───────────────
    for (const portNum of data.ports || []) {
      const classified = classifyPort(
        { port: portNum, protocol: "tcp", service: "", product: "", version: "" },
        cdnInfo,
      );
      if (classified.riskLevel === "none") continue; // CDN/beklenen — teknografik değer yok

      const riskMap: Record<string, "critical" | "high" | "medium" | "low"> = {
        critical: "critical", high: "high", medium: "medium", low: "low",
      };
      const techRisk = riskMap[classified.riskLevel] ?? "low";
      found.push({
        category: "open_port",
        vendor: "network",
        product: `Port ${portNum} Açık`,
        confidence: 100,
        detectedVia: "shodan",
        securityRisk: techRisk,
        securityNote: classified.riskContext,
        salesSignal: techRisk === "critical" ? "urgent_risk" : undefined,
        evidence: { port: portNum, ip: ips[0], riskLevel: classified.riskLevel },
      });
    }

    // ─── AĞ ÜRÜNÜ TESPİTİ (FortiGate, Cisco vb.) ──────────
    for (const service of data.data || []) {
      const product = (service.product || "").toLowerCase();
      const banner = (service.data || "").toLowerCase();
      const networkProducts = [
        { pattern: "fortinet|fortigate",  vendor: "fortinet",   product: "FortiGate" },
        { pattern: "palo alto|pan-os",    vendor: "paloalto",   product: "Palo Alto" },
        { pattern: "cisco asa|cisco ios", vendor: "cisco",      product: "Cisco" },
        { pattern: "juniper|junos",       vendor: "juniper",    product: "Juniper" },
        { pattern: "checkpoint",          vendor: "checkpoint", product: "Check Point" },
        { pattern: "sophos xg",           vendor: "sophos",     product: "Sophos XG" },
        { pattern: "mikrotik|routeros",   vendor: "mikrotik",   product: "MikroTik" },
      ];
      for (const np of networkProducts) {
        const regex = new RegExp(np.pattern, "i");
        if (regex.test(product) || regex.test(banner)) {
          found.push({ category: "firewall", vendor: np.vendor, product: np.product, version: service.version, confidence: 90, detectedVia: "shodan", salesSignal: np.vendor === "fortinet" ? "has_fortinet" : "has_network_device", evidence: { port: service.port, product: service.product } });
          break;
        }
      }
    }
  } catch {
    // Shodan analizi başarısız — kritik değil
  }
  return found;
}
