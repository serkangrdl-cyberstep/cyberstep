import axios from "axios";
import dns from "dns";
import type { TechStack } from "./types";

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

    // ─── AÇIK PORTLAR → GÜVENLİK AÇIĞI ────────────────────
    const dangerousPorts: Record<number, { product: string; risk: "critical" | "high" | "medium" | "low"; note: string }> = {
      23:    { product: "Telnet Açık",        risk: "critical", note: "Telnet şifresiz protokol — kritik risk" },
      3389:  { product: "RDP Açık",           risk: "critical", note: "RDP internete açık — ransomware giriş noktası" },
      3306:  { product: "MySQL Açık",         risk: "critical", note: "MySQL dışarıdan erişilebilir — veri sızıntısı riski" },
      5432:  { product: "PostgreSQL Açık",    risk: "critical", note: "PostgreSQL dışarıdan erişilebilir" },
      27017: { product: "MongoDB Açık",       risk: "critical", note: "MongoDB şifresiz erişilebilir" },
      6379:  { product: "Redis Açık",         risk: "critical", note: "Redis şifresiz erişilebilir" },
      9200:  { product: "Elasticsearch Açık", risk: "critical", note: "Elasticsearch herkese açık — veri sızıntısı" },
      445:   { product: "SMB Açık",           risk: "critical", note: "SMB internete açık — WannaCry risk vektörü" },
      1433:  { product: "MSSQL Açık",         risk: "critical", note: "MSSQL dışarıdan erişilebilir" },
      22:    { product: "SSH Açık",           risk: "medium",   note: "SSH dışarıdan erişilebilir — brute force riski" },
      8080:  { product: "HTTP Alt Port",      risk: "medium",   note: "Alternatif HTTP portu açık" },
      8443:  { product: "HTTPS Alt Port",     risk: "low",      note: "Alternatif HTTPS portu" },
    };
    for (const portData of data.ports || []) {
      const danger = dangerousPorts[portData];
      if (danger) {
        found.push({ category: "open_port", vendor: "network", product: danger.product, confidence: 100, detectedVia: "shodan", securityRisk: danger.risk, securityNote: danger.note, salesSignal: danger.risk === "critical" ? "urgent_risk" : undefined, evidence: { port: portData, ip: ips[0] } });
      }
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
