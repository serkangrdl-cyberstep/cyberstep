import { logger } from "../lib/logger";

export interface FgCredentials {
  host: string;   // https://192.168.1.1
  apiKey: string; // REST API key (created under System > Admin Profiles)
}

const TIMEOUT_MS = 10_000;

async function fgGet(creds: FgCredentials, path: string): Promise<unknown> {
  const url = `${creds.host.replace(/\/$/, "")}${path}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${creds.apiKey}` },
    });
    if (!res.ok) {
      throw new Error(`FortiOS ${res.status} ${res.statusText} at ${path}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ─── Connection test ──────────────────────────────────────────────────────────

export async function fgTestConnection(creds: FgCredentials): Promise<{
  connected: boolean; version?: string; hostname?: string; error?: string;
}> {
  try {
    const data = await fgGet(creds, "/api/v2/monitor/system/status") as {
      results?: { version?: string; hostname?: string };
      status?: string;
    };
    const version = data?.results?.version ?? undefined;
    const hostname = data?.results?.hostname ?? undefined;
    return { connected: true, version, hostname };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ err, host: creds.host }, "FortiGate connection test failed");
    return { connected: false, error: msg };
  }
}

// ─── Firmware version analysis ────────────────────────────────────────────────

const EOL_VERSIONS = ["6.0", "6.2", "6.4"];
const OUTDATED_THRESHOLD = "7.2";

function parseVersion(v: string): number[] {
  return v.replace(/^v/i, "").split(".").slice(0, 2).map(Number);
}

function compareVersion(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function analyzeFirmware(version: string): { eol: boolean; outdated: boolean } {
  const parsed = parseVersion(version);
  const eol = EOL_VERSIONS.some((v) => compareVersion(parsed, parseVersion(v)) === 0 ||
    (parsed[0] !== undefined && parsed[0] < parseVersion(v)[0]!));
  const outdated = !eol && compareVersion(parsed, parseVersion(OUTDATED_THRESHOLD)) < 0;
  return { eol, outdated };
}

// ─── Policy analysis ──────────────────────────────────────────────────────────

export async function fgAnalyzePolicies(creds: FgCredentials): Promise<{
  total: number; any_source: number; any_destination: number;
  logging_disabled: number; disabled_policies: number; implicit_deny_exists: boolean;
}> {
  const data = await fgGet(creds, "/api/v2/cmdb/firewall/policy") as {
    results?: Array<{
      srcaddr?: Array<{ name: string }>;
      dstaddr?: Array<{ name: string }>;
      logtraffic?: string;
      status?: string;
      action?: string;
    }>;
  };
  const policies = data?.results ?? [];
  return {
    total: policies.length,
    any_source: policies.filter((p) =>
      p.srcaddr?.some((s) => s.name === "all")).length,
    any_destination: policies.filter((p) =>
      p.dstaddr?.some((d) => d.name === "all")).length,
    logging_disabled: policies.filter((p) =>
      p.logtraffic === "disable").length,
    disabled_policies: policies.filter((p) =>
      p.status === "disable").length,
    implicit_deny_exists: policies.some((p) =>
      p.action === "deny" && p.srcaddr?.[0]?.name === "all"),
  };
}

// ─── VPN analysis ─────────────────────────────────────────────────────────────

export async function fgAnalyzeVpn(creds: FgCredentials): Promise<{
  ssl_vpn_active_users: number; ipsec_tunnels_up: number;
  ssl_vpn_enabled: boolean; mfa_enabled?: boolean;
}> {
  let sslActiveUsers = 0;
  let ipsecUp = 0;
  let mfaEnabled: boolean | undefined;

  try {
    const sslData = await fgGet(creds, "/api/v2/monitor/vpn/ssl") as {
      results?: unknown[];
    };
    sslActiveUsers = sslData?.results?.length ?? 0;
  } catch { /* VPN SSL might not be licensed */ }

  try {
    const ipsecData = await fgGet(creds, "/api/v2/monitor/vpn/ipsec") as {
      results?: Array<{ proxyid?: Array<{ status?: string }> }>;
    };
    ipsecUp = ipsecData?.results?.filter(
      (t) => t.proxyid?.[0]?.status === "up",
    ).length ?? 0;
  } catch { /* IPsec might not exist */ }

  return {
    ssl_vpn_active_users: sslActiveUsers,
    ipsec_tunnels_up: ipsecUp,
    ssl_vpn_enabled: sslActiveUsers > 0,
    mfa_enabled: mfaEnabled,
  };
}

// ─── Session / threat summary ─────────────────────────────────────────────────

export async function fgAnalyzeThreats(creds: FgCredentials): Promise<{
  active_sessions: number | null; note?: string;
}> {
  try {
    const data = await fgGet(creds, "/api/v2/monitor/firewall/session/statistics") as {
      results?: { total?: number };
    };
    return { active_sessions: data?.results?.total ?? null };
  } catch {
    return { active_sessions: null, note: "IPS log erişimi yok" };
  }
}

// ─── FortiClient endpoint list ────────────────────────────────────────────────

export async function fgGetEndpoints(creds: FgCredentials): Promise<{
  total_endpoints: number | null; compliant: number;
  non_compliant: number; note?: string;
}> {
  try {
    const data = await fgGet(
      creds, "/api/v2/monitor/endpoint-control/registered",
    ) as { results?: Array<{ is_compliant?: boolean }> };
    const endpoints = data?.results ?? [];
    return {
      total_endpoints: endpoints.length,
      compliant: endpoints.filter((e) => e.is_compliant).length,
      non_compliant: endpoints.filter((e) => !e.is_compliant).length,
    };
  } catch {
    return {
      total_endpoints: null,
      compliant: 0,
      non_compliant: 0,
      note: "FortiClient EMS bağlı değil",
    };
  }
}

// ─── Full sync ────────────────────────────────────────────────────────────────

export async function fgFullSync(creds: FgCredentials): Promise<{
  firmwareVersion: string | null; firmwareEol: boolean; firmwareOutdated: boolean;
  policyAnalysis: Awaited<ReturnType<typeof fgAnalyzePolicies>> | null;
  vpnData: Awaited<ReturnType<typeof fgAnalyzeVpn>> | null;
  threats: Awaited<ReturnType<typeof fgAnalyzeThreats>>;
  endpoints: Awaited<ReturnType<typeof fgGetEndpoints>>;
  errors: string[];
}> {
  const errors: string[] = [];

  const test = await fgTestConnection(creds);
  if (!test.connected) {
    return {
      firmwareVersion: null, firmwareEol: false, firmwareOutdated: false,
      policyAnalysis: null, vpnData: null,
      threats: { active_sessions: null, note: "Bağlantı kurulamadı" },
      endpoints: { total_endpoints: null, compliant: 0, non_compliant: 0, note: "Bağlantı kurulamadı" },
      errors: [test.error ?? "Bağlantı başarısız"],
    };
  }

  const fw = test.version ? analyzeFirmware(test.version) : { eol: false, outdated: false };

  let policyAnalysis: Awaited<ReturnType<typeof fgAnalyzePolicies>> | null = null;
  try { policyAnalysis = await fgAnalyzePolicies(creds); }
  catch (e) { errors.push(`Policy: ${e instanceof Error ? e.message : String(e)}`); }

  let vpnData: Awaited<ReturnType<typeof fgAnalyzeVpn>> | null = null;
  try { vpnData = await fgAnalyzeVpn(creds); }
  catch (e) { errors.push(`VPN: ${e instanceof Error ? e.message : String(e)}`); }

  const [threats, endpoints] = await Promise.all([
    fgAnalyzeThreats(creds),
    fgGetEndpoints(creds),
  ]);

  return {
    firmwareVersion: test.version ?? null,
    firmwareEol: fw.eol,
    firmwareOutdated: fw.outdated,
    policyAnalysis,
    vpnData,
    threats,
    endpoints,
    errors,
  };
}
