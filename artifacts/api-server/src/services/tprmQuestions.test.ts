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
