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
