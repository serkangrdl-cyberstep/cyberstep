import { Router } from "express";
import type { Request, Response } from "express";
import { createHmac, randomBytes } from "node:crypto";
import { db, pool } from "@workspace/db";
import { customersTable, domainScansTable, tprmVendorTable } from "@workspace/db";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { requireAdmin } from "../../middleware/auth";
import { isScanCompleteAndFresh } from "../../lib/scoring/scoreV2Loader";
import { TPRM_QUESTIONS } from "../../services/tprmQuestions";

const router = Router();

const DEMO_EMAIL = "sasa-demo@cyberstep.io";
const DEMO_COMPANY = "SASA Polyester Sanayi A.Ş.";
const DEMO_SECTOR = "Kimya / Tekstil Hammaddesi";

const FIRST = ["Ahmet", "Ayşe", "Mehmet", "Elif", "Mustafa", "Zeynep", "Can", "Deniz", "Burak", "Selin", "Emre", "Gül"];
const LAST = ["Yılmaz", "Kaya", "Demir", "Şahin", "Çelik", "Aydın", "Öztürk", "Arslan", "Koç", "Polat"];
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)]!;

/** Beyan profili: olgunluk p → her soru için evet/kısmen/hayır. */
function randomAnswers(): Array<{ questionId: number; answer: "evet" | "kismen" | "hayir" }> {
  const p = 0.1 + Math.random() * 0.85;
  return TPRM_QUESTIONS.map((q) => {
    const r = Math.random();
    const answer = r < p * 0.75 ? "evet" : r < p * 0.75 + 0.25 ? "kismen" : "hayir";
    return { questionId: q.id, answer: answer as "evet" | "kismen" | "hayir" };
  });
}

function sign(sid: string, secret: string): string {
  return "s:" + sid + "." + createHmac("sha256", secret).update(sid).digest("base64").replace(/=+$/, "");
}

/**
 * POST /api/admin-panel/tprm-demo-seed  { count?: number }
 * Sasa demo müşterisiyle gerçek müşteri akışını (portföye ekle → anket linki → tedarikçi doldurur → sonuç/PDF)
 * sunucu içinden gerçek API uçlarını çağırarak koşturur. Yeni tarama başlatılmaz: yalnızca mevcut, tam ve taze taramaları olan domainler seçilir.
 */
router.post("/admin-panel/tprm-demo-seed", requireAdmin, async (req: Request, res: Response) => {
  const count = Math.min(Math.max(Number((req.body as { count?: number })?.count ?? 50), 1), 100);
  const secret = process.env["SESSION_SECRET"]!;
  const port = process.env["PORT"] ?? "3000";
  const base = `http://127.0.0.1:${port}`;

  // 1) Demo müşteri (profesyonel TPRM paketi: 100 tedarikçi)
  let [cust] = await db.select().from(customersTable).where(eq(customersTable.email, DEMO_EMAIL)).limit(1);
  if (!cust) {
    [cust] = await db.insert(customersTable).values({
      email: DEMO_EMAIL,
      passwordHash: "!" + randomBytes(24).toString("hex"), // giriş yapılamaz; yalnızca test
      fullName: "Sasa Demo",
      companyName: DEMO_COMPANY,
      subscriptionPlan: "tprm_profesyonel",
      subscriptionStatus: "active",
    }).returning();
  }
  const customerId = cust!.id;

  // 2) Oturum çerezi (gerçek müşteri oturumu gibi)
  const sid = randomBytes(18).toString("hex");
  const expire = new Date(Date.now() + 60 * 60 * 1000);
  const sess = { cookie: { originalMaxAge: 3600000, expires: expire.toISOString(), httpOnly: true, path: "/" }, customerId };
  await pool.query("INSERT INTO sessions (sid, sess, expire) VALUES ($1, $2, $3)", [sid, JSON.stringify(sess), expire]);
  const cookie = `cstep.sid=${encodeURIComponent(sign(sid, secret))}`;
  const call = (path: string, init: RequestInit = {}) =>
    fetch(base + path, { ...init, redirect: "manual", headers: { "Content-Type": "application/json", Cookie: cookie, ...(init.headers ?? {}) } });

  try {
    // 3) Aday domainler: tam ve taze taraması olan, v2 skoru hesaplanmış
    const rows = await db.select({
      domain: domainScansTable.domain, score: domainScansTable.scoreV2,
      createdAt: domainScansTable.createdAt, referralSource: domainScansTable.referralSource,
    }).from(domainScansTable).where(isNotNull(domainScansTable.scoreV2)).orderBy(desc(domainScansTable.createdAt)).limit(5000);
    const latest = new Map<string, { domain: string; score: number }>();
    for (const r of rows) {
      const d = r.domain.toLowerCase().replace(/^www\./, "");
      if (latest.has(d)) continue; // en son tarama
      if (!isScanCompleteAndFresh(r)) { latest.set(d, { domain: d, score: -1 }); continue; }
      latest.set(d, { domain: d, score: r.score! });
    }
    const cands = [...latest.values()].filter((c) => c.score >= 0).sort(() => Math.random() - 0.5);
    const buckets: Array<typeof cands> = [[], [], [], [], []];
    for (const c of cands) buckets[Math.min(4, Math.floor(c.score / 20))]!.push(c);
    const chosen: typeof cands = [];
    const per = Math.ceil(count / 5);
    for (const b of buckets) chosen.push(...b.slice(0, per));
    for (const c of cands) { if (chosen.length >= count) break; if (!chosen.includes(c)) chosen.push(c); }
    chosen.length = Math.min(chosen.length, count);

    // 4) Her tedarikçi için gerçek akış
    const results: Array<Record<string, unknown>> = [];
    for (const c of chosen) {
      const r: Record<string, unknown> = { domain: c.domain, scanScore: c.score };
      try {
        const add = await call("/api/tprm/vendors", { method: "POST", body: JSON.stringify({ supplierDomain: c.domain, criticality: pick(["low", "medium", "high"]) }) });
        const v = (await add.json()) as { id?: number; scanPending?: boolean; error?: string };
        r["add"] = add.status; if (!v.id) { r["error"] = v.error; results.push(r); continue; }
        r["vendorId"] = v.id; r["scanPending"] = !!v.scanPending;

        const send = await call(`/api/tprm/vendors/${v.id}/send-questionnaire`, { method: "POST", body: JSON.stringify({ companyName: DEMO_COMPANY, companySector: DEMO_SECTOR }) });
        const link = (await send.json()) as { token?: string };
        r["send"] = send.status; if (!link.token) { results.push(r); continue; }

        // Tedarikçi (oturumsuz): sayfa verisi skor içermemeli
        const pub = await fetch(`${base}/api/tprm/questionnaire/${link.token}`);
        const pubBody = await pub.text();
        r["supplierGet"] = pub.status; r["supplierSeesScore"] = /scanScore|combinedScore|riskLevel/.test(pubBody);

        const name = `${pick(FIRST)} ${pick(LAST)}`;
        const sub = await fetch(`${base}/api/tprm/questionnaire/${link.token}/submit`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ supplierContactName: name, supplierContactEmail: `anket-test-${v.id}@example.com`, answers: randomAnswers() }),
        });
        const subBody = await sub.text();
        r["submit"] = sub.status; r["supplierSubmitLeaks"] = /selfScore|combinedScore|riskLevel|aiRiskComment/.test(subBody);

        const again = await fetch(`${base}/api/tprm/questionnaire/${link.token}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
        r["secondSubmit"] = again.status;

        const q = await call(`/api/tprm/vendors/${v.id}/questionnaire`);
        const qb = (await q.json()) as { questionnaire?: { status: string; selfScore: number | null; contradictions: unknown[] } | null };
        r["customerView"] = q.status; r["selfScore"] = qb.questionnaire?.selfScore ?? null; r["contradictions"] = qb.questionnaire?.contradictions?.length ?? null;

        let pdf = await call(`/api/tprm/vendors/${v.id}/report.pdf`);
        if (pdf.status >= 300 && pdf.status < 400) {
          const loc = pdf.headers.get("location") ?? "";
          pdf = await fetch(loc.startsWith("http") ? loc : base + loc, { headers: { Cookie: cookie }, redirect: "manual" });
        }
        const buf = Buffer.from(await pdf.arrayBuffer());
        r["pdf"] = pdf.status; r["pdfBytes"] = buf.length; r["pdfValid"] = buf.subarray(0, 4).toString() === "%PDF";
      } catch (e) { r["error"] = (e as Error).message; }
      results.push(r);
    }

    // 5) Toplu PDF + portföy listesi
    let bulk = await call("/api/tprm/vendors/report.pdf");
    if (bulk.status >= 300 && bulk.status < 400) bulk = await fetch(base + (bulk.headers.get("location") ?? ""), { headers: { Cookie: cookie } });
    const bulkBuf = Buffer.from(await bulk.arrayBuffer());
    const list = await call("/api/tprm/vendors");

    const ok = results.filter((r) => r["submit"] === 200 && r["pdfValid"]).length;
    res.json({
      customer: DEMO_EMAIL, requested: count, selected: chosen.length, completedEndToEnd: ok,
      bucketSizes: buckets.map((b) => b.length),
      portfolioStatus: list.status, bulkPdf: { status: bulk.status, bytes: bulkBuf.length, valid: bulkBuf.subarray(0, 4).toString() === "%PDF" },
      leaks: results.filter((r) => r["supplierSeesScore"] || r["supplierSubmitLeaks"]).length,
      results,
    });
  } finally {
    await pool.query("DELETE FROM sessions WHERE sid = $1", [sid]).catch(() => {});
  }
});

/** POST /api/admin-panel/tprm-demo-seed/password — demo müşteriye giriş şifresi atar (yalnızca test). */
router.post("/admin-panel/tprm-demo-seed/password", requireAdmin, async (_req: Request, res: Response) => {
  const r = await db.update(customersTable).set({ passwordHash: "$2b$12$mr6MHx/JQc74r0VWGuNUEenP1uUaf2tMfNmJs03HQbGFDJnCu7lJe" }).where(eq(customersTable.email, DEMO_EMAIL)).returning({ id: customersTable.id });
  res.json({ updated: r.length });
});

/** POST /api/admin-panel/tprm-demo-seed/reassess { count } — düzeltme/yeniden değerlendirme döngüsünü gerçek akışla dener. */
router.post("/admin-panel/tprm-demo-seed/reassess", requireAdmin, async (req: Request, res: Response) => {
  const count = Math.min(Math.max(Number((req.body as { count?: number })?.count ?? 2), 1), 5);
  const [cust] = await db.select().from(customersTable).where(eq(customersTable.email, DEMO_EMAIL)).limit(1);
  if (!cust) { res.status(404).json({ error: "Demo müşteri yok" }); return; }
  const secret = process.env["SESSION_SECRET"]!;
  const base = `http://127.0.0.1:${process.env["PORT"] ?? "3000"}`;
  const sid = randomBytes(18).toString("hex");
  const expire = new Date(Date.now() + 30 * 60 * 1000);
  await pool.query("INSERT INTO sessions (sid, sess, expire) VALUES ($1, $2, $3)", [sid, JSON.stringify({ cookie: { originalMaxAge: 1800000, expires: expire.toISOString(), httpOnly: true, path: "/" }, customerId: cust.id }), expire]);
  const cookie = `cstep.sid=${encodeURIComponent(sign(sid, secret))}`;
  const call = (path: string, init: RequestInit = {}) => fetch(base + path, { ...init, headers: { "Content-Type": "application/json", Cookie: cookie, ...(init.headers ?? {}) } });
  try {
    const vs = await db.select().from(tprmVendorTable).where(eq(tprmVendorTable.customerEmail, DEMO_EMAIL)).limit(count);
    const out: Array<Record<string, unknown>> = [];
    for (const v of vs) {
      const r: Record<string, unknown> = { vendorId: v.id, domain: v.supplierDomain, scoreBefore: v.lastScanScore };
      try {
        const sl = await call(`/api/tprm/vendors/${v.id}/supplier-link`, { method: "POST" });
        const { token } = (await sl.json()) as { token?: string };
        r["link"] = sl.status; if (!token) { out.push(r); continue; }
        const pub = await fetch(`${base}/api/tprm/questionnaire/${token}`);
        const pd = (await pub.json()) as { kind?: string; report?: { score?: number; actions?: unknown[] } | null; previousAnswers?: unknown[] };
        r["supplierView"] = { status: pub.status, kind: pd.kind, reportScore: pd.report?.score ?? null, actions: pd.report?.actions?.length ?? 0, prefilled: pd.previousAnswers?.length ?? 0 };
        const pdf = await fetch(`${base}/api/tprm/questionnaire/${token}/report.pdf`);
        const buf = Buffer.from(await pdf.arrayBuffer());
        r["supplierPdf"] = { status: pdf.status, valid: buf.subarray(0, 4).toString() === "%PDF", bytes: buf.length };
        const sub = await fetch(`${base}/api/tprm/questionnaire/${token}/submit`, { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ supplierContactName: "Test Tedarikçi", supplierContactEmail: `anket-test-${v.id}@example.com`, answers: randomAnswers() }) });
        r["submit"] = sub.status;
        const again = await fetch(`${base}/api/tprm/questionnaire/${token}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        r["secondSubmit"] = again.status;
        const mail = await call(`/api/tprm/vendors/${v.id}/send-to-supplier`, { method: "POST", body: JSON.stringify({ email: "x@example.com" }) });
        r["sendToSupplier"] = mail.status;
      } catch (e) { r["error"] = (e as Error).message; }
      out.push(r);
    }
    // Tarama tamamlanana kadar bekle (en fazla ~4 dk)
    for (let i = 0; i < 24; i++) {
      const rows = await db.select().from(tprmVendorTable).where(inArray(tprmVendorTable.id, out.map((o) => o["vendorId"] as number)));
      if (rows.every((x) => x.remediationStatus !== "requested")) break;
      await new Promise((r) => setTimeout(r, 10000));
    }
    const rows = await db.select().from(tprmVendorTable).where(inArray(tprmVendorTable.id, out.map((o) => o["vendorId"] as number)));
    for (const o of out) {
      const x = rows.find((y) => y.id === o["vendorId"]);
      o["after"] = { remediationStatus: x?.remediationStatus, scoreNow: x?.lastScanScore, scoreBeforeRemediation: x?.scoreBeforeRemediation, contactEmail: x?.supplierContactEmail };
      const [sc] = await db.select({ x: domainScansTable.tprmExtra, u: domainScansTable.uncheckedSources, at: domainScansTable.createdAt }).from(domainScansTable).where(eq(domainScansTable.domain, String(o["domain"]))).orderBy(desc(domainScansTable.createdAt)).limit(1);
      o["scanExtra"] = sc ? { at: sc.at, unchecked: sc.u, extra: sc.x } : null;
      const ev = await call(`/api/tprm/vendors/${o["vendorId"]}/events`);
      o["events"] = ((await ev.json()) as { events: Array<{ kind: string }> }).events.map((e) => e.kind);
    }
    res.json({ results: out });
  } finally {
    await pool.query("DELETE FROM sessions WHERE sid = $1", [sid]).catch(() => {});
  }
});

/** DELETE /api/admin-panel/tprm-demo-seed — yalnızca Sasa demo müşterisinin tedarikçilerini siler. */
router.post("/admin-panel/tprm-demo-seed/add-vendors", requireAdmin, async (req: Request, res: Response) => {
  const domains = ((req.body as { domains?: string[] })?.domains ?? []).map((d) => String(d).toLowerCase().trim()).filter(Boolean).slice(0, 5);
  const [cust] = await db.select().from(customersTable).where(eq(customersTable.email, DEMO_EMAIL)).limit(1);
  if (!cust) { res.status(404).json({ error: "Demo müşteri yok" }); return; }
  const secret = process.env["SESSION_SECRET"]!;
  const base = `http://127.0.0.1:${process.env["PORT"] ?? "3000"}`;
  const sid = randomBytes(18).toString("hex");
  const expire = new Date(Date.now() + 30 * 60 * 1000);
  await pool.query("INSERT INTO sessions (sid, sess, expire) VALUES ($1, $2, $3)", [sid, JSON.stringify({ cookie: { originalMaxAge: 1800000, expires: expire.toISOString(), httpOnly: true, path: "/" }, customerId: cust.id }), expire]);
  const cookie = `cstep.sid=${encodeURIComponent(sign(sid, secret))}`;
  try {
    const out: Array<Record<string, unknown>> = [];
    for (const d of domains) {
      const r: Record<string, unknown> = { domain: d };
      const add = await fetch(`${base}/api/tprm/vendors`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ supplierDomain: d, criticality: "high" }) });
      const v = (await add.json()) as { id?: number; error?: string };
      r["add"] = add.status; r["vendorId"] = v.id ?? null; r["error"] = v.error;
      out.push(r);
    }
    // Taramaların bitmesini bekle (en fazla ~4 dk)
    for (let i = 0; i < 24; i++) {
      const rows = await db.select().from(tprmVendorTable).where(inArray(tprmVendorTable.id, out.map((o) => o["vendorId"] as number).filter(Boolean)));
      if (rows.length > 0 && rows.every((x) => x.lastScanAt)) break;
      await new Promise((r) => setTimeout(r, 10000));
    }
    for (const o of out) {
      const [sc] = await db.select({ score: domainScansTable.overallScore, cve: domainScansTable.cveSummary, x: domainScansTable.tprmExtra, u: domainScansTable.uncheckedSources, at: domainScansTable.createdAt }).from(domainScansTable).where(eq(domainScansTable.domain, String(o["domain"]))).orderBy(desc(domainScansTable.createdAt)).limit(1);
      o["scan"] = sc ? { at: sc.at, score: sc.score, unchecked: sc.u, cves: sc.cve, extra: sc.x } : null;
    }
    res.json({ results: out });
  } finally {
    await pool.query("DELETE FROM sessions WHERE sid = $1", [sid]).catch(() => {});
  }
});

router.delete("/admin-panel/tprm-demo-seed", requireAdmin, async (_req: Request, res: Response) => {
  const vs = await db.select({ id: tprmVendorTable.id }).from(tprmVendorTable).where(eq(tprmVendorTable.customerEmail, DEMO_EMAIL));
  if (vs.length) await db.delete(tprmVendorTable).where(and(eq(tprmVendorTable.customerEmail, DEMO_EMAIL), inArray(tprmVendorTable.id, vs.map((v) => v.id))));
  res.json({ deleted: vs.length });
});

export default router;
