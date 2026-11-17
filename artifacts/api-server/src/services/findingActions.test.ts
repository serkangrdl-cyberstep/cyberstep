import { test } from "node:test";
import assert from "node:assert/strict";
import { actionsFromFindings } from "./findingActions";

test("bulgulardan öncelik sırasıyla aksiyon üretir, CVE ve portları birleştirir", () => {
  const a = actionsFromFindings([
    { category: "email", severity: "low", title: "DMARC p=quarantine (p=reject önerilir)", deduction: 1 },
    { category: "vulnerabilities", severity: "critical", title: "CVE-2024-0001 kritik zafiyet (CVSS 9.8)", deduction: 10 },
    { category: "vulnerabilities", severity: "critical", title: "CVE-2024-0002 kritik zafiyet (CVSS 9.1)", deduction: 10 },
    { category: "network", severity: "high", title: "3389/rdp internete açık", deduction: 5 },
    { category: "network", severity: "high", title: "22/ssh internete açık", deduction: 5 },
  ]);
  assert.equal(a[0]!.oncelik, 1);
  assert.match(a[0]!.aksiyon, /CVE-2024-0001, CVE-2024-0002/);
  assert.match(a[1]!.aksiyon, /3389, 22/);
  assert.match(a[2]!.aksiyon, /DMARC/);
  assert.equal(a.length, 3);
});

test("bulgu yoksa aksiyon üretilmez; puan düşürmeyen bulgular dikkate alınmaz", () => {
  assert.equal(actionsFromFindings([]).length, 0);
  assert.equal(actionsFromFindings([{ category: "web", severity: "low", title: "X-Powered-By başlığı", deduction: 0 }]).length, 0);
});
