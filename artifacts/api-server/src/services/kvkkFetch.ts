/**
 * kvkk.gov.tr sunucusu sertifika zincirinde ara sertifikayı (GlobalSign) göndermiyor; tarayıcılar bunu AIA ile tamamlıyor, Node tamamlamıyor.
 * Burada tarayıcıdakiyle aynı yapılır: sunucunun sertifikasındaki "CA Issuers" adresinden ara sertifika indirilir ve güvenilen
 * kök sertifikalara ek olarak verilir. Doğrulama kapatılmaz: zincir yine bir güvenilen köke bağlanmak zorundadır.
 */
import https from "node:https";
import http from "node:http";
import tls from "node:tls";
import { X509Certificate } from "node:crypto";

let issuerPem: string | null = null;

export function derToPem(der: Buffer): string {
  return new X509Certificate(der).toString();
}

function getIssuerUrl(host: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Yalnızca sertifika bilgisini okumak için el sıkışma; hiçbir istek gönderilmez ve yanıt kullanılmaz.
    const socket = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: false }, () => {
      const cert = socket.getPeerCertificate(true);
      socket.destroy();
      const info = cert.infoAccess?.["CA Issuers - URI"];
      const url = Array.isArray(info) ? info[0] : info;
      url ? resolve(url) : reject(new Error("Sertifikada CA Issuers adresi yok"));
    });
    socket.setTimeout(15_000, () => { socket.destroy(); reject(new Error("TLS zaman aşımı")); });
    socket.on("error", reject);
  });
}

function download(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https:") ? https : http;
    mod.get(url, { timeout: 15_000 }, res => {
      if (res.statusCode !== 200) { reject(new Error(`Ara sertifika indirilemedi: HTTP ${res.statusCode}`)); res.resume(); return; }
      const chunks: Buffer[] = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    }).on("error", reject).on("timeout", function (this: http.ClientRequest) { this.destroy(new Error("İndirme zaman aşımı")); });
  });
}

async function ensureIssuer(host: string): Promise<string> {
  if (issuerPem) return issuerPem;
  const url = await getIssuerUrl(host);
  const der = await download(url);
  issuerPem = derToPem(der);
  return issuerPem;
}

function request(url: string, ca: string[], headers: Record<string, string>): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { ca, headers, timeout: 20_000 }, res => {
      const chunks: Buffer[] = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("error", reject).on("timeout", () => req.destroy(new Error("İstek zaman aşımı")));
  });
}

export async function kvkkGet(url: string, headers: Record<string, string>): Promise<string> {
  const host = new URL(url).hostname;
  const ca = [...tls.rootCertificates, await ensureIssuer(host)];
  const r = await request(url, ca, headers);
  if (r.status !== 200) throw new Error(`HTTP ${r.status} ${url}`);
  return r.body;
}
