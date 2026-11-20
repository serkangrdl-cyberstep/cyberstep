import test from "node:test";
import assert from "node:assert/strict";
import { bandOf, interpret } from "./tprmInterpretation";

test("bant eşikleri", () => {
  assert.equal(bandOf(80), "guclu"); assert.equal(bandOf(79), "orta");
  assert.equal(bandOf(60), "orta"); assert.equal(bandOf(59), "zayif");
});
test("kategori puanı ve kırmızı bayrak", () => {
  const r = interpret([{ questionId: 2, answer: "hayir" }, { questionId: 12, answer: "evet" }, { questionId: 1, answer: "evet" }], 90);
  const kimlik = r.categories.find((c) => c.category === "Erişim ve kimlik")!;
  assert.equal(kimlik.score, 50);
  assert.equal(kimlik.band, "zayif");
  assert.deepEqual(r.redFlags.map((f) => f.questionId), [2]);
  assert.match(r.guidance, /Kırmızı bayraklı/);
});
test("güçlü beyan + zayıf tarama uyarı verir; çelişki notu", () => {
  const r = interpret([{ questionId: 1, answer: "evet" }], 90, { scanScore: 40, contradictionCount: 1 });
  assert.equal(r.scanBand, "zayif");
  assert.match(r.guidance, /kanıt belgesi/);
  assert.match(r.guidance, /çelişen/);
  assert.equal(interpret([{ questionId: 1, answer: "evet" }], 90, { scanScore: 85 }).scanBand, "iyi");
});
