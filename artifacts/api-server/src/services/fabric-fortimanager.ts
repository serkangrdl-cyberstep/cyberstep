import https from "https";
import { logger } from "../lib/logger";

// JSON-RPC client for the customer's FortiManager.
// Self-signed certs are common, so rejectUnauthorized is disabled.
// NOTE: Replit egress IPs are not static — the customer must allow our
// outbound traffic in FortiManager "Trusted Hosts" (documented in the wizard).

export interface FortiManagerCreds {
  url: string;
  username: string;
  password: string;
  adom: string;
  blockGroup: string;
}

interface RpcResult {
  status: number;
  data: unknown;
}

// FortiManager returns HTTP 200 even on logical failure; the real outcome is in
// the JSON body at result[0].status.code (0 = success). Always validate this,
// never just the transport status.
function rpcStatus(res: RpcResult): { code: number; message: string } {
  const r = res.data as { result?: Array<{ status?: { code?: number; message?: string } }> };
  const s = r?.result?.[0]?.status;
  return { code: s?.code ?? -1, message: s?.message ?? "Bilinmeyen FortiManager yanıtı" };
}

function rpc(urlStr: string, payload: unknown): Promise<RpcResult> {
  return new Promise((resolve, reject) => {
    let u: URL;
    try { u = new URL(urlStr); } catch { reject(new Error("Geçersiz FortiManager URL")); return; }
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: u.hostname,
      port: u.port || "443",
      path: `${u.pathname.replace(/\/$/, "")}/jsonrpc`,
      method: "POST",
      rejectUnauthorized: false,
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body).toString() },
      timeout: 15000,
    }, (res) => {
      let raw = "";
      res.on("data", (c) => { raw += c.toString(); });
      res.on("end", () => {
        try { resolve({ status: res.statusCode ?? 0, data: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode ?? 0, data: raw }); }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(new Error("FortiManager zaman aşımı")); });
    req.write(body);
    req.end();
  });
}

async function login(creds: FortiManagerCreds): Promise<string | null> {
  const res = await rpc(creds.url, {
    id: 1, method: "exec",
    params: [{ url: "/sys/login/user", data: { user: creds.username, passwd: creds.password } }],
  });
  const r = res.data as { result?: Array<{ status?: { code?: number }; }>; session?: string };
  const code = r?.result?.[0]?.status?.code;
  if (code === 0 && r.session) return r.session;
  return null;
}

async function logout(creds: FortiManagerCreds, session: string): Promise<void> {
  try {
    await rpc(creds.url, { id: 99, method: "exec", session, params: [{ url: "/sys/logout" }] });
  } catch { /* ignore */ }
}

export async function fmTestConnection(creds: FortiManagerCreds): Promise<{ ok: boolean; message: string }> {
  try {
    const session = await login(creds);
    if (!session) return { ok: false, message: "Kimlik doğrulama başarısız — kullanıcı adı/parola veya Trusted Hosts kontrol edin" };
    await logout(creds, session);
    return { ok: true, message: "FortiManager bağlantısı başarılı" };
  } catch (e) {
    return { ok: false, message: String(e) };
  }
}

// Push a single IP into the block address group and install policy.
export async function fmBlockIp(creds: FortiManagerCreds, ip: string, reason: string): Promise<{ ok: boolean; message: string }> {
  let session: string | null = null;
  try {
    session = await login(creds);
    if (!session) return { ok: false, message: "FortiManager oturumu açılamadı" };

    const adom = creds.adom || "root";
    const addrName = `CS-${ip.replace(/[.:]/g, "-")}`;

    // 1) Create/update address object
    const addrRes = rpcStatus(await rpc(creds.url, {
      id: 2, method: "set", session,
      params: [{
        url: `/pm/config/adom/${adom}/obj/firewall/address`,
        data: { name: addrName, subnet: `${ip}/32`, type: 0, comment: `CyberStep auto-block: ${reason}`.slice(0, 255) },
      }],
    }));
    if (addrRes.code !== 0) {
      await logout(creds, session);
      return { ok: false, message: `Adres nesnesi oluşturulamadı: ${addrRes.message}` };
    }

    // 2) Ensure block group exists and append member
    const grpRes = rpcStatus(await rpc(creds.url, {
      id: 3, method: "set", session,
      params: [{
        url: `/pm/config/adom/${adom}/obj/firewall/addrgrp`,
        data: { name: creds.blockGroup, "member": [addrName], comment: "CyberStep threat auto-blocklist" },
      }],
    }));
    if (grpRes.code !== 0) {
      await logout(creds, session);
      return { ok: false, message: `Engelleme grubu güncellenemedi: ${grpRes.message}` };
    }

    // 3) Install policy package — required for the block to take effect on devices
    const installRes = rpcStatus(await rpc(creds.url, {
      id: 4, method: "exec", session,
      params: [{ url: "/securityconsole/install/package", data: { adom, flags: ["none"] } }],
    }).catch(() => ({ status: 0, data: {} } as RpcResult)));
    if (installRes.code !== 0) {
      await logout(creds, session);
      return { ok: false, message: `${ip} gruba eklendi ancak politika kurulumu başarısız: ${installRes.message}` };
    }

    await logout(creds, session);
    logger.info({ ip, group: creds.blockGroup }, "FortiManager block pushed");
    return { ok: true, message: `${ip} "${creds.blockGroup}" grubuna eklendi ve politika kuruldu` };
  } catch (e) {
    if (session) await logout(creds, session);
    return { ok: false, message: String(e) };
  }
}

// Verify an IP is present in the block group.
export async function fmVerifyBlock(creds: FortiManagerCreds, ip: string): Promise<{ ok: boolean; present: boolean; message: string }> {
  let session: string | null = null;
  try {
    session = await login(creds);
    if (!session) return { ok: false, present: false, message: "Oturum açılamadı" };
    const adom = creds.adom || "root";
    const res = await rpc(creds.url, {
      id: 5, method: "get", session,
      params: [{ url: `/pm/config/adom/${adom}/obj/firewall/addrgrp/${encodeURIComponent(creds.blockGroup)}` }],
    });
    await logout(creds, session);
    const st = rpcStatus(res);
    if (st.code !== 0) return { ok: false, present: false, message: `Grup okunamadı: ${st.message}` };
    const data = res.data as { result?: Array<{ data?: { member?: string[] } }> };
    const members = data?.result?.[0]?.data?.member ?? [];
    const addrName = `CS-${ip.replace(/[.:]/g, "-")}`;
    const present = members.includes(addrName);
    return { ok: true, present, message: present ? "Doğrulandı" : "Grupta bulunamadı" };
  } catch (e) {
    if (session) await logout(creds, session);
    return { ok: false, present: false, message: String(e) };
  }
}

// Discover Security Fabric devices via FortiManager device list.
export async function fmDiscoverDevices(creds: FortiManagerCreds): Promise<Array<{ name: string; type: string; serial?: string; ip?: string; version?: string }>> {
  let session: string | null = null;
  try {
    session = await login(creds);
    if (!session) return [];
    const res = await rpc(creds.url, {
      id: 6, method: "get", session,
      params: [{ url: "/dvmdb/device", option: ["get meta"] }],
    });
    await logout(creds, session);
    if (rpcStatus(res).code !== 0) return [];
    const data = res.data as { result?: Array<{ data?: Array<Record<string, unknown>> }> };
    const devices = data?.result?.[0]?.data ?? [];
    return devices.slice(0, 50).map((d) => ({
      name: String(d["name"] ?? "bilinmiyor"),
      type: String(d["os_type"] ?? d["platform_str"] ?? "FortiGate"),
      serial: d["sn"] ? String(d["sn"]) : undefined,
      ip: d["ip"] ? String(d["ip"]) : undefined,
      version: d["os_ver"] ? String(d["os_ver"]) : undefined,
    }));
  } catch (e) {
    if (session) await logout(creds, session);
    logger.warn({ err: e }, "FortiManager device discovery failed");
    return [];
  }
}
