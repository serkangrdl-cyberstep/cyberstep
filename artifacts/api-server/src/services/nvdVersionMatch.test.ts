import { test } from "node:test";
import assert from "node:assert/strict";
import { compareVersions, cveAffectsVersion } from "./nvdVersionMatch";

const cfg = (m: object) => [{ nodes: [{ cpeMatch: [{ vulnerable: true, ...m }] }] }];

test("sürüm karşılaştırma sayısal yapılır", () => {
  assert.equal(compareVersions("6.10", "6.9"), 1);
  assert.equal(compareVersions("3.4.1", "3.5.0"), -1);
  assert.equal(compareVersions("5.0", "5.0.0"), 0);
});

test("sürüm aralığı dışındaysa etkilenmez, içindeyse etkilenir", () => {
  const c = cfg({ criteria: "cpe:2.3:a:wordpress:wordpress:*:*:*:*:*:*:*:*", versionEndExcluding: "6.4.3" });
  assert.equal(cveAffectsVersion(c, "wordpress:wordpress", "6.4.2"), true);
  assert.equal(cveAffectsVersion(c, "wordpress:wordpress", "6.5.0"), false);
});

test("tam sürüm eşleşmesi", () => {
  const c = cfg({ criteria: "cpe:2.3:a:jquery:jquery:3.4.1:*:*:*:*:*:*:*" });
  assert.equal(cveAffectsVersion(c, "jquery:jquery", "3.4.1"), true);
  assert.equal(cveAffectsVersion(c, "jquery:jquery", "3.5.0"), false);
});

test("yapılandırma yoksa doğrulanamaz (null); başka ürünse null", () => {
  assert.equal(cveAffectsVersion(undefined, "jquery:jquery", "3.4.1"), null);
  assert.equal(cveAffectsVersion(cfg({ criteria: "cpe:2.3:a:other:thing:*:*:*:*:*:*:*:*" }), "jquery:jquery", "3.4.1"), null);
});

test("ürün yalnızca platform (vulnerable:false) ise etkilenmez — eklenti CVE'si WordPress'e atfedilmez", () => {
  const cfg = [{ nodes: [{ cpeMatch: [
    { vulnerable: true, criteria: "cpe:2.3:a:ninjaforms:ninja_forms:*:*:*:*:*:wordpress:*:*", versionEndExcluding: "2.9.42" },
    { vulnerable: false, criteria: "cpe:2.3:a:wordpress:wordpress:*:*:*:*:*:*:*:*" },
  ] }] }];
  assert.equal(cveAffectsVersion(cfg, "wordpress:wordpress", "6.4.2"), false);
});
