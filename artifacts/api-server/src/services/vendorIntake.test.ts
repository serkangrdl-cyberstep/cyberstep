import test from "node:test";
import assert from "node:assert/strict";
import { parseRiskDomains, suggestCriticality, effectiveCriticality } from "./vendorIntake";

const d = (o: Record<string, boolean>) => parseRiskDomains(o);
test("parseRiskDomains: geçersiz null, eksik anahtar false", () => {
  assert.equal(parseRiskDomains(null), null);
  assert.equal(parseRiskDomains("x"), null);
  assert.deepEqual(d({ data: true }), { data: true, cyber: false, operational: false, compliance: false, ai: false, fourthParty: false });
});
test("suggestCriticality kuralları", () => {
  assert.equal(suggestCriticality(null), "standart");
  assert.equal(suggestCriticality(d({})), "standart");
  assert.equal(suggestCriticality(d({ data: true })), "standart");
  assert.equal(suggestCriticality(d({ data: true, cyber: true })), "onemli");
  assert.equal(suggestCriticality(d({ operational: true })), "onemli");
  assert.equal(suggestCriticality(d({ operational: true, data: true })), "kritik");
  assert.equal(suggestCriticality(d({ data: true, ai: true, compliance: true, fourthParty: true })), "kritik");
});
test("effectiveCriticality yükseltir, düşürmez", () => {
  assert.equal(effectiveCriticality("standart", d({ operational: true, cyber: true })), "kritik");
  assert.equal(effectiveCriticality("kritik", d({})), "kritik");
});
