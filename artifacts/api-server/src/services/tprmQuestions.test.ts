import test from "node:test";
import assert from "node:assert/strict";
import { selfScoreOf } from "./tprmQuestions";

test("10 soruda eski hesapla aynı: hepsi evet = 100", () => {
  assert.equal(selfScoreOf(Array(10).fill({ answer: "evet" }), 10), 100);
  assert.equal(selfScoreOf([...Array(5).fill({ answer: "evet" }), ...Array(5).fill({ answer: "hayir" })], 10), 50);
});
test("11 soruda ölçek 100'de kalır", () => {
  assert.equal(selfScoreOf(Array(11).fill({ answer: "evet" }), 11), 100);
  assert.equal(selfScoreOf(Array(11).fill({ answer: "kismen" }), 11), 50);
  assert.equal(selfScoreOf(Array(11).fill({ answer: "hayir" }), 11), 0);
});

import { questionsFor, TPRM_QUESTIONS } from "./tprmQuestions";
test("sözleşme ve zafiyet soruları yalnızca veri/siber alanı işaretliyse sorulur; alan yoksa tümü", () => {
  const none = { data: false, cyber: false, operational: false, compliance: false, ai: false, fourthParty: false };
  const ids = (d: typeof none | null) => questionsFor(d).filter((q) => q.category === "Sözleşme ve zafiyet yönetimi").map((q) => q.id);
  assert.deepEqual(ids(none), []);
  assert.deepEqual(ids({ ...none, data: true }), [30, 31, 32]);
  assert.deepEqual(ids({ ...none, cyber: true }), [30, 31, 32, 33]);
  assert.equal(ids(null).length, 4);
  assert.equal(new Set(TPRM_QUESTIONS.map((q) => q.id)).size, TPRM_QUESTIONS.length);
});
