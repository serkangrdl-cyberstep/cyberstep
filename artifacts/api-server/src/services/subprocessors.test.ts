import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeSubprocessors, normalizeDomainLoose, inPortfolio } from "./subprocessors";

test("normalizeDomainLoose", () => {
  assert.equal(normalizeDomainLoose("https://www.Acme.com/path?x"), "acme.com");
  assert.equal(normalizeDomainLoose("acme"), null);
  assert.equal(normalizeDomainLoose(5), null);
});
test("sanitizeSubprocessors: adsız atılır, 20 sınır, geçersiz alan adı null", () => {
  const r = sanitizeSubprocessors([{ name: "  Acme ", domain: "bad domain", dataTypes: "e-posta", country: "ABD" }, { name: "" }, null, { name: "B", domain: "b.io" }]);
  assert.deepEqual(r, [{ name: "Acme", domain: null, dataTypes: "e-posta", country: "ABD" }, { name: "B", domain: "b.io", dataTypes: null, country: null }]);
  assert.equal(sanitizeSubprocessors(Array.from({ length: 30 }, (_, i) => ({ name: `n${i}` }))).length, 20);
  assert.deepEqual(sanitizeSubprocessors("x"), []);
});
test("inPortfolio", () => {
  const s = sanitizeSubprocessors([{ name: "A", domain: "a.com" }, { name: "B", domain: "b.com" }]);
  assert.deepEqual([...inPortfolio(s, ["A.com", "z.com"])], ["a.com"]);
});
