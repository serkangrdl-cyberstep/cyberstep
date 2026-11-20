import test from "node:test";
import assert from "node:assert/strict";
import { suggestActions, validateActionItems, isOverdue } from "./tprmActions";

test("öneriler: eksik DMARC/SPF, CVE, infostealer, kırmızı bayrak, çelişki, ISO", () => {
  const s = suggestActions({
    spfRecord: null, dmarcRecord: null, cveSummary: [{ cveId: "CVE-1", cvssScore: 9 }, { cveId: "CVE-2", cvssScore: 3 }],
    hudsonEmployees: 2, answers: [{ questionId: 22, answer: "hayir" }],
    interpretation: { redFlags: [{ questionId: 2, text: "MFA?" }] }, contradictions: [{ questionId: 3, text: "SPF?", bulgu: "yok" }],
  });
  assert.deepEqual(s.map((x) => x.sourceKey).sort(), ["cve", "cx-3", "dmarc", "infostealer", "iso", "rf-2", "spf"]);
  assert.match(s.find((x) => x.sourceKey === "cve")!.detail, /CVE-1/);
  assert.doesNotMatch(s.find((x) => x.sourceKey === "cve")!.detail, /CVE-2/);
});
test("sorun yoksa öneri yok", () => {
  assert.equal(suggestActions({ spfRecord: "v=spf1 -all", dmarcRecord: "v=DMARC1", cveSummary: [], hudsonEmployees: 0, answers: [{ questionId: 22, answer: "evet" }] }).length, 0);
});
test("validateActionItems: başlıksız atılır, geçmiş tarih 30 güne çekilir", () => {
  const now = new Date("2026-06-01T00:00:00Z");
  const r = validateActionItems([{ title: " A ", dueDate: "2020-01-01" }, { title: "" }, { title: "B", dueDate: "2026-07-01", sourceKey: "dmarc" }], now);
  assert.equal(r.length, 2);
  assert.equal(r[0]!.dueDate.toISOString().slice(0, 10), "2026-07-01");
  assert.equal(r[1]!.sourceKey, "dmarc");
});
test("isOverdue", () => {
  assert.equal(isOverdue("open", new Date("2026-01-01"), new Date("2026-02-01")), true);
  assert.equal(isOverdue("verified", new Date("2026-01-01"), new Date("2026-02-01")), false);
});

import { autoVerifiableIds } from "./tprmActions";
test("autoVerifiableIds: giderilen madde doğrulanır, ölçülemeyen ve anket maddesi dokunulmaz", () => {
  const acts = [
    { id: 1, sourceKey: "spf", status: "supplier_done" },
    { id: 2, sourceKey: "dmarc", status: "open" },
    { id: 3, sourceKey: "cve", status: "open" },
    { id: 4, sourceKey: "infostealer", status: "open" },
    { id: 5, sourceKey: "rf-2", status: "open" },
    { id: 6, sourceKey: "spf", status: "verified" },
  ];
  const ok = { reliable: true, spfRecord: "v=spf1 -all", dmarcRecord: null, cveSummary: [], hudsonEmployees: null };
  assert.deepEqual(autoVerifiableIds(acts, ok), [1, 3]);
  assert.deepEqual(autoVerifiableIds(acts, { ...ok, reliable: false }), []);
});
