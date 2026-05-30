import https from "https";
import http from "http";
import { logger } from "../lib/logger";

// ─── Shared HTTP helper ────────────────────────────────────────────────────────

function jsonRequest(options: https.RequestOptions, body?: unknown): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...(options.headers as Record<string, string> ?? {}),
      ...(payload ? { "Content-Length": Buffer.byteLength(payload).toString() } : {}),
    };
    const mod = options.protocol === "http:" ? http : https;
    const req = (mod as typeof https).request({ ...options, headers }, (res) => {
      let raw = "";
      res.on("data", (c: Buffer) => { raw += c.toString(); });
      res.on("end", () => {
        try { resolve({ status: res.statusCode ?? 0, data: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode ?? 0, data: raw }); }
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function parseUrl(url: string) {
  try {
    const u = new URL(url);
    return { hostname: u.hostname, port: u.port || (u.protocol === "https:" ? "443" : "80"), protocol: u.protocol, pathname: u.pathname.replace(/\/$/, "") };
  } catch {
    throw new Error(`Geçersiz URL: ${url}`);
  }
}

// ─── Jira ─────────────────────────────────────────────────────────────────────

export interface JiraConfig {
  url: string;          // https://company.atlassian.net
  email: string;
  apiToken: string;
  projectKey: string;   // e.g. "SEC"
  issueType?: string;   // default: "Bug"
}

export interface JiraIssue {
  summary: string;
  description: string;
  priority: "Highest" | "High" | "Medium" | "Low" | "Lowest";
  labels?: string[];
}

export async function jiraTestConnection(cfg: JiraConfig): Promise<{ ok: boolean; message: string }> {
  try {
    const u = parseUrl(cfg.url);
    const auth = Buffer.from(`${cfg.email}:${cfg.apiToken}`).toString("base64");
    const res = await jsonRequest({
      hostname: u.hostname, port: u.port, protocol: u.protocol,
      path: `${u.pathname}/rest/api/3/project/${cfg.projectKey}`,
      method: "GET",
      headers: { "Authorization": `Basic ${auth}` },
    });
    if (res.status === 200) return { ok: true, message: `Proje "${cfg.projectKey}" bulundu` };
    if (res.status === 401) return { ok: false, message: "Kimlik doğrulama başarısız — e-posta veya API token hatalı" };
    if (res.status === 404) return { ok: false, message: `Proje bulunamadı: ${cfg.projectKey}` };
    return { ok: false, message: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, message: String(e) };
  }
}

export async function jiraCreateIssue(cfg: JiraConfig, issue: JiraIssue): Promise<{ ok: boolean; issueKey?: string; message: string }> {
  try {
    const u = parseUrl(cfg.url);
    const auth = Buffer.from(`${cfg.email}:${cfg.apiToken}`).toString("base64");
    const body = {
      fields: {
        project: { key: cfg.projectKey },
        summary: issue.summary,
        description: {
          type: "doc", version: 1,
          content: [{ type: "paragraph", content: [{ type: "text", text: issue.description }] }],
        },
        issuetype: { name: cfg.issueType ?? "Bug" },
        priority: { name: issue.priority },
        labels: ["cyberstep", ...(issue.labels ?? [])],
      },
    };
    const res = await jsonRequest({
      hostname: u.hostname, port: u.port, protocol: u.protocol,
      path: `${u.pathname}/rest/api/3/issue`,
      method: "POST",
      headers: { "Authorization": `Basic ${auth}` },
    }, body);
    if (res.status === 201) {
      const key = (res.data as { key?: string }).key;
      return { ok: true, issueKey: key, message: `Ticket oluşturuldu: ${key}` };
    }
    return { ok: false, message: `Jira hatası: HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, message: String(e) };
  }
}

export async function jiraBulkCreateFromFindings(
  cfg: JiraConfig,
  findings: Array<{ domain: string; severity: string; title: string; description: string; recommendation: string }>
): Promise<{ created: number; errors: number }> {
  let created = 0, errors = 0;
  for (const f of findings.filter(f => f.severity === "Kritik" || f.severity === "Yüksek")) {
    const priorityMap: Record<string, JiraIssue["priority"]> = { Kritik: "Highest", Yüksek: "High", Orta: "Medium", Düşük: "Low" };
    const r = await jiraCreateIssue(cfg, {
      summary: `[CyberStep] ${f.title} — ${f.domain}`,
      description: `${f.description}\n\nÖneri: ${f.recommendation}`,
      priority: priorityMap[f.severity] ?? "Medium",
      labels: ["cyberstep-auto", f.severity.toLowerCase()],
    });
    r.ok ? created++ : errors++;
  }
  return { created, errors };
}

// ─── FortiManager ─────────────────────────────────────────────────────────────

export interface FortiManagerConfig {
  url: string;        // https://fortimanager.company.com
  username: string;
  password: string;
  adom: string;       // Administrative Domain, default: "root"
  addrGroupName?: string; // Address group to update, default: "CyberStep-Blocklist"
}

export async function fortiManagerTestConnection(cfg: FortiManagerConfig): Promise<{ ok: boolean; message: string; sessionKey?: string }> {
  try {
    const u = parseUrl(cfg.url);
    const res = await jsonRequest({
      hostname: u.hostname, port: u.port, protocol: u.protocol,
      path: `${u.pathname}/jsonrpc`,
      method: "POST",
    }, {
      id: 1,
      method: "exec",
      params: [{ url: "/sys/login/user", data: { user: cfg.username, passwd: cfg.password } }],
    });
    const r = res.data as { result?: Array<{ status?: { code?: number; message?: string }; session?: string }> };
    const code = r?.result?.[0]?.status?.code;
    const session = r?.result?.[0]?.session;
    if (code === 0 && session) return { ok: true, message: "FortiManager bağlantısı başarılı", sessionKey: session };
    if (code === -6) return { ok: false, message: "Kimlik doğrulama başarısız" };
    return { ok: false, message: `Kod: ${code ?? "bilinmiyor"}` };
  } catch (e) {
    return { ok: false, message: String(e) };
  }
}

export async function fortiManagerPushBlocklist(cfg: FortiManagerConfig, ips: string[]): Promise<{ ok: boolean; pushed: number; message: string }> {
  if (ips.length === 0) return { ok: true, pushed: 0, message: "Engellenecek IP yok" };
  try {
    const u = parseUrl(cfg.url);
    const groupName = cfg.addrGroupName ?? "CyberStep-Blocklist";

    // 1. Login
    const loginRes = await jsonRequest({
      hostname: u.hostname, port: u.port, protocol: u.protocol,
      path: `${u.pathname}/jsonrpc`, method: "POST",
    }, { id: 1, method: "exec", params: [{ url: "/sys/login/user", data: { user: cfg.username, passwd: cfg.password } }] });
    const session = (loginRes.data as { result?: Array<{ session?: string }> })?.result?.[0]?.session;
    if (!session) return { ok: false, pushed: 0, message: "Oturum açılamadı" };

    const headers = { "Session-ID": session };

    // 2. Create/update address objects for each IP
    const addrs: string[] = [];
    for (const ip of ips.slice(0, 200)) {
      const name = `CS-${ip.replace(/\./g, "-")}`;
      await jsonRequest({
        hostname: u.hostname, port: u.port, protocol: u.protocol,
        path: `${u.pathname}/jsonrpc`, method: "POST", headers,
      }, { id: 2, method: "add", params: [{ url: `/pm/config/adom/${cfg.adom}/obj/firewall/address`, data: { name, subnet: `${ip}/32`, type: 0, comment: "CyberStep auto-block" } }] });
      addrs.push(name);
    }

    // 3. Create/update address group
    await jsonRequest({
      hostname: u.hostname, port: u.port, protocol: u.protocol,
      path: `${u.pathname}/jsonrpc`, method: "POST", headers,
    }, { id: 3, method: "set", params: [{ url: `/pm/config/adom/${cfg.adom}/obj/firewall/addrgrp`, data: { name: groupName, member: addrs, comment: "CyberStep threat intel auto-blocklist" } }] });

    // 4. Logout
    await jsonRequest({
      hostname: u.hostname, port: u.port, protocol: u.protocol,
      path: `${u.pathname}/jsonrpc`, method: "POST", headers,
    }, { id: 4, method: "exec", params: [{ url: "/sys/logout" }] });

    logger.info({ pushed: addrs.length, group: groupName }, "FortiManager blocklist güncellendi");
    return { ok: true, pushed: addrs.length, message: `${addrs.length} IP "${groupName}" grubuna eklendi` };
  } catch (e) {
    return { ok: false, pushed: 0, message: String(e) };
  }
}

// ─── IBM QRadar ───────────────────────────────────────────────────────────────

export interface QRadarConfig {
  url: string;      // https://qradar.company.com
  apiToken: string;
  logSourceId?: string;
}

export async function qradarTestConnection(cfg: QRadarConfig): Promise<{ ok: boolean; message: string }> {
  try {
    const u = parseUrl(cfg.url);
    const res = await jsonRequest({
      hostname: u.hostname, port: u.port, protocol: u.protocol,
      path: `${u.pathname}/api/config/about`,
      method: "GET",
      headers: { "SEC": cfg.apiToken, "Version": "17.0" },
    });
    if (res.status === 200) return { ok: true, message: "QRadar bağlantısı başarılı" };
    if (res.status === 401) return { ok: false, message: "API token geçersiz" };
    return { ok: false, message: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, message: String(e) };
  }
}

export async function qradarSendEvents(
  cfg: QRadarConfig,
  events: Array<{ source: string; severity: number; name: string; description: string; deviceTime?: string }>
): Promise<{ ok: boolean; sent: number; message: string }> {
  try {
    const u = parseUrl(cfg.url);
    // QRadar Custom Event Processor (CEP) endpoint
    const results = await Promise.allSettled(events.map(ev =>
      jsonRequest({
        hostname: u.hostname, port: u.port, protocol: u.protocol,
        path: `${u.pathname}/api/ariel/events`,
        method: "POST",
        headers: { "SEC": cfg.apiToken, "Version": "17.0" },
      }, {
        events: [{
          deviceType: 19,  // Custom Log Source
          sourceAddress: ev.source,
          severity: ev.severity,
          name: `CyberStep: ${ev.name}`,
          description: ev.description,
          deviceTime: ev.deviceTime ?? new Date().toISOString(),
          ...(cfg.logSourceId ? { logSourceId: parseInt(cfg.logSourceId) } : {}),
        }],
      })
    ));
    const sent = results.filter(r => r.status === "fulfilled" && (r.value as { status: number }).status < 300).length;
    return { ok: sent > 0, sent, message: `${sent}/${events.length} olay gönderildi` };
  } catch (e) {
    return { ok: false, sent: 0, message: String(e) };
  }
}

// ─── FortiSIEM ────────────────────────────────────────────────────────────────

export interface FortiSIEMConfig {
  url: string;          // https://fortisiem.company.com
  username: string;
  password: string;
  organization: string; // default: "Super"
}

export async function fortiSIEMTestConnection(cfg: FortiSIEMConfig): Promise<{ ok: boolean; message: string }> {
  try {
    const u = parseUrl(cfg.url);
    const auth = Buffer.from(`${cfg.username}/${cfg.organization}:${cfg.password}`).toString("base64");
    const res = await jsonRequest({
      hostname: u.hostname, port: u.port, protocol: u.protocol,
      path: `${u.pathname}/phoenix/rest/config/Domain`,
      method: "GET",
      headers: { "Authorization": `Basic ${auth}`, "Accept": "application/json" },
    });
    if (res.status === 200) return { ok: true, message: "FortiSIEM bağlantısı başarılı" };
    if (res.status === 401) return { ok: false, message: "Kimlik doğrulama başarısız" };
    return { ok: false, message: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, message: String(e) };
  }
}

export async function fortiSIEMSendIncidents(
  cfg: FortiSIEMConfig,
  incidents: Array<{ title: string; severity: "1" | "2" | "3" | "4" | "5"; description: string; source: string }>
): Promise<{ ok: boolean; sent: number; message: string }> {
  try {
    const u = parseUrl(cfg.url);
    const auth = Buffer.from(`${cfg.username}/${cfg.organization}:${cfg.password}`).toString("base64");
    const payload = incidents.map(inc => ({
      incidentTitle: `CyberStep: ${inc.title}`,
      incidentDetail: inc.description,
      incidentSrc: inc.source,
      incidentSeverity: parseInt(inc.severity),
      incidentStatus: 1,
      incidentLastSeen: Math.floor(Date.now() / 1000),
      customer: cfg.organization,
    }));
    const res = await jsonRequest({
      hostname: u.hostname, port: u.port, protocol: u.protocol,
      path: `${u.pathname}/phoenix/rest/incident/add`,
      method: "POST",
      headers: { "Authorization": `Basic ${auth}` },
    }, payload);
    if (res.status < 300) return { ok: true, sent: incidents.length, message: `${incidents.length} olay gönderildi` };
    return { ok: false, sent: 0, message: `FortiSIEM hatası: HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, sent: 0, message: String(e) };
  }
}

// ─── CrowdStrike Falcon ───────────────────────────────────────────────────────

export interface CrowdStrikeConfig {
  clientId: string;
  clientSecret: string;
  baseUrl?: string; // default: https://api.crowdstrike.com
}

async function crowdStrikeGetToken(cfg: CrowdStrikeConfig): Promise<string | null> {
  const base = cfg.baseUrl ?? "https://api.crowdstrike.com";
  const u = parseUrl(base);
  const body = `client_id=${encodeURIComponent(cfg.clientId)}&client_secret=${encodeURIComponent(cfg.clientSecret)}`;
  const res = await jsonRequest({
    hostname: u.hostname, port: u.port, protocol: u.protocol,
    path: `${u.pathname}/oauth2/token`,
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(body).toString() },
  });
  return (res.data as { access_token?: string }).access_token ?? null;
}

export async function crowdStrikeTestConnection(cfg: CrowdStrikeConfig): Promise<{ ok: boolean; message: string }> {
  try {
    const token = await crowdStrikeGetToken(cfg);
    if (token) return { ok: true, message: "CrowdStrike Falcon bağlantısı başarılı" };
    return { ok: false, message: "Token alınamadı — credentials hatalı" };
  } catch (e) {
    return { ok: false, message: String(e) };
  }
}

export async function crowdStrikePushIOCs(
  cfg: CrowdStrikeConfig,
  iocs: Array<{ type: "ipv4" | "domain" | "sha256" | "md5"; value: string; severity: "critical" | "high" | "medium" | "low"; description: string }>
): Promise<{ ok: boolean; pushed: number; message: string }> {
  try {
    const token = await crowdStrikeGetToken(cfg);
    if (!token) return { ok: false, pushed: 0, message: "Token alınamadı" };
    const base = cfg.baseUrl ?? "https://api.crowdstrike.com";
    const u = parseUrl(base);
    const indicators = iocs.map(ioc => ({
      type: ioc.type,
      value: ioc.value,
      severity: ioc.severity,
      action: "detect",
      source: "CyberStep",
      description: ioc.description,
      applied_globally: true,
      platforms: ["windows", "mac", "linux"],
      tags: ["cyberstep-auto"],
    }));
    const res = await jsonRequest({
      hostname: u.hostname, port: u.port, protocol: u.protocol,
      path: `${u.pathname}/iocs/entities/indicators/v1`,
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` },
    }, { indicators });
    if (res.status === 200) return { ok: true, pushed: iocs.length, message: `${iocs.length} IOC CrowdStrike'a yüklendi` };
    return { ok: false, pushed: 0, message: `CrowdStrike hatası: HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, pushed: 0, message: String(e) };
  }
}

// ─── Trend Micro Vision One ───────────────────────────────────────────────────

export interface TrendMicroConfig {
  apiToken: string;
  region?: string; // eu | us | ap | au | in | sg | jp  (default: eu)
}

function trendMicroBaseUrl(region: string): string {
  const map: Record<string, string> = {
    eu: "api.eu.xdr.trendmicro.com",
    us: "api.xdr.trendmicro.com",
    ap: "api.ap.xdr.trendmicro.com",
    au: "api.au.xdr.trendmicro.com",
    in: "api.in.xdr.trendmicro.com",
    sg: "api.sg.xdr.trendmicro.com",
    jp: "api.jp.xdr.trendmicro.com",
  };
  return map[region] ?? map["eu"]!;
}

export async function trendMicroTestConnection(cfg: TrendMicroConfig): Promise<{ ok: boolean; message: string }> {
  try {
    const hostname = trendMicroBaseUrl(cfg.region ?? "eu");
    const res = await jsonRequest({
      hostname, port: "443", protocol: "https:",
      path: "/v3.0/xdr/healthcheck",
      method: "GET",
      headers: { "Authorization": `Bearer ${cfg.apiToken}`, "Content-Type": "application/json;charset=utf-8" },
    });
    if (res.status === 200) return { ok: true, message: "Trend Micro Vision One bağlantısı başarılı" };
    if (res.status === 401) return { ok: false, message: "API token geçersiz" };
    return { ok: false, message: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, message: String(e) };
  }
}

export async function trendMicroPushIOCs(
  cfg: TrendMicroConfig,
  iocs: Array<{ type: "ip" | "domain" | "fileSha256" | "url"; value: string; description: string }>
): Promise<{ ok: boolean; pushed: number; message: string }> {
  try {
    const hostname = trendMicroBaseUrl(cfg.region ?? "eu");
    const items = iocs.map(ioc => ({
      type: ioc.type,
      value: ioc.value,
      description: `CyberStep: ${ioc.description}`,
      scanAction: "block",
      riskLevel: "high",
      expiredUtc: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }));
    const res = await jsonRequest({
      hostname, port: "443", protocol: "https:",
      path: "/v3.0/threatintel/suspiciousObjectList",
      method: "PUT",
      headers: { "Authorization": `Bearer ${cfg.apiToken}`, "Content-Type": "application/json;charset=utf-8" },
    }, items);
    if (res.status < 300) return { ok: true, pushed: iocs.length, message: `${iocs.length} IOC Trend Micro'ya yüklendi` };
    return { ok: false, pushed: 0, message: `Trend Micro hatası: HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, pushed: 0, message: String(e) };
  }
}

// ─── Dispatcher: test + push based on type ────────────────────────────────────

export type AnyIntegrationConfig = Record<string, string>;

export async function testIntegration(type: string, config: AnyIntegrationConfig): Promise<{ ok: boolean; message: string }> {
  switch (type) {
    case "jira":          return jiraTestConnection(config as unknown as JiraConfig);
    case "forti_manager": return fortiManagerTestConnection(config as unknown as FortiManagerConfig);
    case "qradar":        return qradarTestConnection(config as unknown as QRadarConfig);
    case "forti_siem":    return fortiSIEMTestConnection(config as unknown as FortiSIEMConfig);
    case "crowdstrike":   return crowdStrikeTestConnection(config as unknown as CrowdStrikeConfig);
    case "trend_micro":   return trendMicroTestConnection(config as unknown as TrendMicroConfig);
    default:              return { ok: false, message: "Bilinmeyen entegrasyon türü" };
  }
}
