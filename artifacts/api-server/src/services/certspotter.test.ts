import test from "node:test";
import assert from "node:assert/strict";
import { parseCertspotter } from "./certspotter";
test("alan adına ait, joker olmayan adlar tekil döner", () => {
  const b = [{ dns_names: ["a.x.com", "*.x.com", "x.com", "evil.com"] }, { dns_names: ["a.x.com"] }];
  assert.deepEqual(parseCertspotter(b, "x.com").sort(), ["a.x.com", "x.com"]);
  assert.deepEqual(parseCertspotter(null, "x.com"), []);
});
