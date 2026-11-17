import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateVersionEvidence } from "./versionEvidence";

test("sürüm yoksa güven 50'yi geçmez ve doğrulanmadı notu düşer", () => {
  const r = evaluateVersionEvidence(null, { versionEndExcluding: "3.5.0" }, 85, null);
  assert.equal(r.skip, false);
  assert.equal(r.confidence, 50);
  assert.match(r.note, /doğrulanmadı/);
});

test("sürüm aralık dışındaysa eşleşme reddedilir", () => {
  assert.equal(evaluateVersionEvidence("3.6.1", { versionEndExcluding: "3.5.0" }, 80, null).skip, true);
});

test("sürüm aralık içindeyse doğrulandı", () => {
  const r = evaluateVersionEvidence("3.4.1", { versionEndExcluding: "3.5.0" }, 80, "x");
  assert.equal(r.skip, false);
  assert.equal(r.confidence, 80);
  assert.match(r.note, /Sürüm aralığı doğrulandı/);
});

test("sürüm var ama aralık verisi yoksa güven 65 ile sınırlanır", () => {
  const r = evaluateVersionEvidence("1.2.3", {}, 90, null);
  assert.equal(r.confidence, 65);
  assert.match(r.note, /doğrulanamadı/);
});
