import test from "node:test";
import assert from "node:assert/strict";
import { parseVulnCheckKevHit, checkVulnCheckKev, parseHudsonRock, parseObservatoryV2, checkHudsonRock, type FetchLike } from "./tprmIntel";

const ok = (body: unknown, status = 200): FetchLike => async () => ({ ok: status < 400, status, json: async () => body });

test("VulnCheck KEV: cve dizisinde eşleşme", () => {
  assert.equal(parseVulnCheckKevHit({ data: [{ cve: ["CVE-2021-44228"] }] }, "CVE-2021-44228"), true);
  assert.equal(parseVulnCheckKevHit({ data: [] }, "CVE-2021-44228"), false);
  assert.equal(parseVulnCheckKevHit(null, "CVE-1"), false);
});

test("VulnCheck KEV: token yoksa null, hata failed", async () => {
  assert.equal(await checkVulnCheckKev(["CVE-1"], undefined, ok({})), null);
  const r = await checkVulnCheckKev(["CVE-1"], "t", ok({}, 500));
  assert.deepEqual(r, { kev: [], failed: true });
  const hit = await checkVulnCheckKev(["CVE-1"], "t", ok({ data: [{ cve: ["CVE-1"] }] }));
  assert.deepEqual(hit, { kev: ["CVE-1"], failed: false });
});

test("Hudson Rock: parse ve hata", async () => {
  assert.deepEqual(parseHudsonRock({ employees: 3, users: 10, totalStealers: 5 }), { employees: 3, users: 10, stealers: 5 });
  assert.equal(parseHudsonRock({ foo: 1 }), null);
  assert.equal(await checkHudsonRock("a.com", ok({}, 429)), null);
});

test("Observatory v2 parse", () => {
  assert.deepEqual(parseObservatoryV2({ grade: "B+", score: 80 }), { grade: "B+", score: 80 });
  assert.equal(parseObservatoryV2({ error: "x" }), null);
});

// ── Yeniden deneme: geçici hata (ağ/429/5xx) bir kez daha denenir, kalıcı hata denenmez ──
import { isTransient, checkVulnCheckKev as _kev, checkHudsonRock as _hr, checkObservatoryV2 as _obs, type FetchLike as _Fetch } from "./tprmIntel";

const scripted = (steps: Array<{ status: number; body?: unknown } | "throw">): { fetcher: _Fetch; calls: () => number } => {
  let i = 0;
  const fetcher: _Fetch = async () => {
    const step = steps[Math.min(i++, steps.length - 1)]!;
    if (step === "throw") throw new Error("network");
    return { ok: step.status < 400, status: step.status, json: async () => step.body ?? null };
  };
  return { fetcher, calls: () => i };
};
const fast = { retryDelayMs: 0 };

test("isTransient: ağ hatası, 429 ve 5xx geçici; diğer 4xx kalıcı", () => {
  assert.equal(isTransient(null), true);
  assert.equal(isTransient({ status: 429 }), true);
  assert.equal(isTransient({ status: 503 }), true);
  assert.equal(isTransient({ status: 404 }), false);
  assert.equal(isTransient({ status: 200 }), false);
});

test("Mozilla Observatory: ilk deneme 503 ise tekrar dener ve not alır", async () => {
  const s = scripted([{ status: 503 }, { status: 200, body: { grade: "B+", score: 70 } }]);
  assert.deepEqual(await _obs("a.com", s.fetcher, fast), { grade: "B+", score: 70 });
  assert.equal(s.calls(), 2);
});

test("Hudson Rock: ağ hatasından sonra başarılı; kalıcı 404'te yeniden denemez", async () => {
  const ok = scripted(["throw", { status: 200, body: { employees: 1, users: 2, totalStealers: 3 } }]);
  assert.deepEqual(await _hr("a.com", ok.fetcher, fast), { employees: 1, users: 2, stealers: 3 });
  assert.equal(ok.calls(), 2);
  const perm = scripted([{ status: 404 }]);
  assert.equal(await _hr("a.com", perm.fetcher, fast), null);
  assert.equal(perm.calls(), 1);
});

test("VulnCheck KEV: her CVE için tek yeniden deneme; iki denemede de hata → failed", async () => {
  const flaky = scripted([{ status: 502 }, { status: 200, body: { data: [{ cve: ["CVE-2020-1"] }] } }]);
  assert.deepEqual(await _kev(["CVE-2020-1"], "tok", flaky.fetcher, fast), { kev: ["CVE-2020-1"], failed: false });
  const down = scripted([{ status: 500 }]);
  assert.deepEqual(await _kev(["CVE-2020-1"], "tok", down.fetcher, fast), { kev: [], failed: true });
  assert.equal(down.calls(), 2);
});
