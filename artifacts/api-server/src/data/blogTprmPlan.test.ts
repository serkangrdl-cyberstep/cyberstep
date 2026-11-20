import test from "node:test";
import assert from "node:assert/strict";
import { TPRM_PLAN, TPRM_VERIFIED_FACTS } from "./blogTprmPlan";

test("TPRM planındaki tüm konular TPRM kategorisinde ve başlıkları benzersiz", () => {
  assert.ok(TPRM_PLAN.length >= 10);
  assert.ok(TPRM_PLAN.every((t) => t.category === "TPRM"));
  assert.equal(new Set(TPRM_PLAN.map((t) => t.title)).size, TPRM_PLAN.length);
});

test("doğrulanmış olgular editör notu veya yer tutucu içermez", () => {
  assert.ok(!/\[(DOĞRULA|VERIFY|KAYNAK)/i.test(TPRM_VERIFIED_FACTS));
  assert.ok(TPRM_VERIFIED_FACTS.includes("KVKK madde 12"));
});
