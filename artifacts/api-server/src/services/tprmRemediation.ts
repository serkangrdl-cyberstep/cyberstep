import { createHmac, randomBytes } from "node:crypto";
import { db, pool, customersTable, tprmVendorTable, tprmVendorEventTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

/** E-posta servisi (SMTP) tanımlı mı? Değilse e-posta gönderen düğmeler pasif kalır. */
export function isEmailConfigured(): boolean {
  return !!(process.env["SMTP_USER"] && process.env["SMTP_PASS"]);
}

export function appBaseUrl(): string {
  const first = (process.env["REPLIT_DOMAINS"] ?? "").split(",")[0]?.trim();
  return first ? `https://${first}` : "";
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function recordEvent(vendorId: number, kind: string, detail?: Record<string, unknown>): Promise<void> {
  try {
    await db.insert(tprmVendorEventTable).values({ vendorId, kind, detail: (detail ?? null) as never });
  } catch (err) {
    logger.error({ err, vendorId, kind }, "TPRM event kaydedilemedi");
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseEmails(raw: string | null | undefined): string[] {
  return [...new Set((raw ?? "").split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter((e) => EMAIL_RE.test(e)))];
}

/** Müşteri tarafında tanımlı TPRM bildirim kişileri; tanımlı değilse hesap e-postası. */
export async function customerContacts(customerEmail: string): Promise<string[]> {
  const [c] = await db.select({ emails: customersTable.tprmNotifyEmails }).from(customersTable)
    .where(eq(customersTable.email, customerEmail)).limit(1);
  const list = parseEmails(c?.emails);
  return list.length ? list : [customerEmail];
}

/** Düzeltme sonrası yeni tarama tamamlandı: müşteri ilgililerine bilgi gider (SMTP yoksa yalnızca panelde görünür). */
export async function notifyRescanDone(vendor: { id: number; customerEmail: string; supplierDomain: string; supplierName: string | null }, before: number | null, after: number | null): Promise<boolean> {
  if (!isEmailConfigured()) return false;
  try {
    const { sendMail } = await import("./email");
    const to = await customerContacts(vendor.customerEmail);
    const name = escapeHtml(vendor.supplierName || vendor.supplierDomain);
    const delta = before !== null && after !== null ? ` Skor: ${before} → ${after}.` : "";
    const url = `${appBaseUrl()}/hesabim/tedarikci-portfoyu`;
    for (const addr of to) {
      await sendMail({
        to: addr,
        subject: `${vendor.supplierName || vendor.supplierDomain}: düzenlemeler tamamlandı, yeni tarama yapıldı`,
        html: `<p><strong>${name}</strong> tedarikçisi ile ilgili düzenlemelerin tamamlandığı bildirildi ve yeni bir tarama yapıldı.${delta}</p>
<p>Lütfen sonucu kontrol edin: <a href="${url}">Tedarikçi Portföyü</a></p>`,
      });
    }
    return true;
  } catch (err) {
    logger.error({ err, vendorId: vendor.id }, "TPRM yeniden tarama bildirimi gönderilemedi");
    return false;
  }
}

/** Sunucu içinden, müşteri oturumuyla (kısa ömürlü) tedarikçi PDF'ini üretir; e-posta eki ve tedarikçi indirmesi için. */
export async function fetchVendorPdf(vendorId: number, customerId: number): Promise<Buffer | null> {
  const secret = process.env["SESSION_SECRET"];
  if (!secret) return null;
  const sid = randomBytes(18).toString("hex");
  const expire = new Date(Date.now() + 5 * 60 * 1000);
  const sess = { cookie: { originalMaxAge: 300000, expires: expire.toISOString(), httpOnly: true, path: "/" }, customerId };
  await pool.query("INSERT INTO sessions (sid, sess, expire) VALUES ($1, $2, $3)", [sid, JSON.stringify(sess), expire]);
  const cookie = `cstep.sid=${encodeURIComponent("s:" + sid + "." + createHmac("sha256", secret).update(sid).digest("base64").replace(/=+$/, ""))}`;
  const base = `http://127.0.0.1:${process.env["PORT"] ?? "3000"}`;
  try {
    let r = await fetch(`${base}/api/tprm/vendors/${vendorId}/report.pdf`, { headers: { Cookie: cookie }, redirect: "manual" });
    if (r.status >= 300 && r.status < 400) {
      const loc = r.headers.get("location") ?? "";
      r = await fetch(loc.startsWith("http") ? loc : base + loc, { headers: { Cookie: cookie }, redirect: "manual" });
    }
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return buf.subarray(0, 4).toString() === "%PDF" ? buf : null;
  } catch (err) {
    logger.error({ err, vendorId }, "TPRM tedarikçi PDF üretilemedi");
    return null;
  } finally {
    await pool.query("DELETE FROM sessions WHERE sid = $1", [sid]).catch(() => {});
  }
}

export async function getVendorById(id: number) {
  const [v] = await db.select().from(tprmVendorTable).where(eq(tprmVendorTable.id, id));
  return v ?? null;
}
