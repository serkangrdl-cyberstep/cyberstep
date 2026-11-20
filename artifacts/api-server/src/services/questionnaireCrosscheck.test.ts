import { test } from "node:test";
import assert from "node:assert/strict";
import { crosscheckAnswers } from "./questionnaireCrosscheck";

test("e-posta beyanı taramayla çelişirse işaretlenir", () => {
  const r = crosscheckAnswers([{ questionId: 3, answer: "evet" }], { spfRecord: "v=spf1 -all", dmarcRecord: null });
  assert.equal(r.length, 1);
  assert.match(r[0]!.bulgu, /DMARC kaydı bulunamadı/);
});

test("tarama beyanı doğruluyorsa veya e-posta ölçülemediyse çelişki yok", () => {
  assert.equal(crosscheckAnswers([{ questionId: 3, answer: "evet" }], { spfRecord: "v=spf1 -all", dmarcRecord: "v=DMARC1; p=reject" }).length, 0);
  assert.equal(crosscheckAnswers([{ questionId: 3, answer: "evet" }], { spfRecord: null, dmarcRecord: null, uncheckedSources: ["email"] }).length, 0);
});

test("güncelleme beyanı ve yüksek CVE çelişir; 'kısmen' çelişki sayılmaz", () => {
  const scan = { cveSummary: [{ cveId: "CVE-2024-1", cvssScore: 9.8 }] };
  assert.equal(crosscheckAnswers([{ questionId: 4, answer: "evet" }], scan).length, 1);
  assert.equal(crosscheckAnswers([{ questionId: 4, answer: "kismen" }], scan).length, 0);
});

test("soru 14: infostealer kaydı varken izliyorum beyanı çelişir", () => {
  const r = crosscheckAnswers([{ questionId: 14, answer: "evet" }], { hudsonEmployees: 3 });
  assert.equal(r.length, 1);
  assert.equal(r[0]!.questionId, 14);
  assert.equal(crosscheckAnswers([{ questionId: 14, answer: "evet" }], { hudsonEmployees: 0 }).length, 0);
  assert.equal(crosscheckAnswers([{ questionId: 14, answer: "evet" }], { hudsonEmployees: null }).length, 0);
});
test("soru 11: liste beyanı var ama alt sağlayıcı paylaşılmadı", () => {
  assert.equal(crosscheckAnswers([{ questionId: 11, answer: "evet" }], { subprocessorCount: 0 }).length, 1);
  assert.equal(crosscheckAnswers([{ questionId: 11, answer: "evet" }], { subprocessorCount: 2 }).length, 0);
  assert.equal(crosscheckAnswers([{ questionId: 11, answer: "evet" }], { subprocessorCount: null }).length, 0);
});
