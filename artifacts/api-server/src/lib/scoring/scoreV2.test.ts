// Çalıştırma: pnpm --filter @workspace/api-server run test:score
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeScoreV2, riskWithFloor, parseDmarcPolicy, parseSpfPolicy, type ScoreV2Input } from "./scoreV2";

const clean: ScoreV2Input = {
  referralSource: "user",
  spfRecord: "v=spf1 include:_spf.google.com -all",
  dmarcRecord: "v=DMARC1; p=reject; rua=mailto:d@x.com",
  dmarcPass: true,
  dkimPass: true,
  mxPass: true,
  sslDaysUntilExpiry: 80,
  httpHeadersScore: 100,
  cveSummary: [],
  shodanOpenPorts: [{ port: 443, protocol: "tcp", service: "https", product: "", version: "" }],
  blacklisted: false,
  usomListed: false,
  urlhausListed: false,
  safeBrowsingFlagged: false,
  virusTotalReputation: 0,
  virusTotalMalicious: 0,
  abuseIpdbScore: 0,
  hibpBreachCount: 0,
};

test("temiz ve tam ölçülmüş domain 100 alır, A notu", () => {
  const r = computeScoreV2(clean);
  assert.equal(r.score, 100);
  assert.equal(r.grade, "A");
  assert.equal(r.coverage, 100);
  assert.equal(r.findings.length, 0);
});

test("hafif tarama: ölçülmeyen kategoriler temiz sayılmaz, kapsama düşer", () => {
  const r = computeScoreV2({ ...clean, referralSource: "discovery_pipeline", hibpBreachCount: 0, httpHeadersScore: 0, shodanOpenPorts: null });
  const byKey = Object.fromEntries(r.categories.map((c) => [c.key, c]));
  assert.equal(byKey["breaches"]!.measured, false);
  assert.equal(byKey["network"]!.measured, false);
  // Başlıklar ölçülmediği için web kategorisi 7 puan üzerinden
  assert.equal(byKey["web"]!.maxPoints, 7);
  assert.equal(r.score, 100);
  assert.ok(r.coverage < 100);
  assert.equal(r.coverage, 67); // 30 + 15 + 15 + 7 = 67
});

test("KEV zafiyeti skoru 49 ile sınırlar", () => {
  const r = computeScoreV2(
    { ...clean, cveSummary: [{ cveId: "CVE-2024-21762", cvssScore: 9.8 }] },
    new Map([["CVE-2024-21762", { ransomware: false }]]),
  );
  assert.ok(r.score <= 49, `score=${r.score}`);
  assert.equal(r.caps.length, 1);
  assert.equal(r.findings[0]!.severity, "critical");
});

test("VulnCheck KEV kaynağı bulguda ve tavanda görünür", () => {
  const r = computeScoreV2(
    { ...clean, cveSummary: [{ cveId: "CVE-2025-0001", cvssScore: 8.0 }] },
    new Map([["CVE-2025-0001", { ransomware: false, source: "vulncheck" as const }]]),
  );
  assert.ok(r.score <= 49);
  assert.match(r.findings[0]!.title, /VulnCheck KEV/);
  assert.ok(r.caps.some((c) => String(c).includes("VulnCheck KEV")));
});

test("fidye yazılımı KEV'i skoru 39 ile sınırlar", () => {
  const r = computeScoreV2(
    { ...clean, cveSummary: [{ cveId: "CVE-2023-27997", cvssScore: 9.8 }] },
    new Map([["CVE-2023-27997", { ransomware: true }]]),
  );
  assert.ok(r.score <= 39);
  assert.equal(r.grade, "F");
});

test("WAF ile hafifletilmiş CVE düzeltilmiş CVSS üzerinden puanlanır", () => {
  const raw = computeScoreV2({ ...clean, cveSummary: [{ cveId: "CVE-1", cvssScore: 9.5 }] });
  const mitigated = computeScoreV2({ ...clean, cveSummary: [{ cveId: "CVE-1", cvssScore: 9.5, adjustedCvssScore: 6.0, wafMitigated: true }] });
  assert.ok(mitigated.score > raw.score);
});

test("aynı CVE iki kez sayılmaz", () => {
  const once = computeScoreV2({ ...clean, cveSummary: [{ cveId: "CVE-1", cvssScore: 9.5 }] });
  const twice = computeScoreV2({ ...clean, cveSummary: [{ cveId: "CVE-1", cvssScore: 9.5 }, { cveId: "CVE-1", cvssScore: 9.5 }] });
  assert.equal(once.score, twice.score);
});

test("internete açık RDP kritik bulgu ve 59 tavanı", () => {
  const r = computeScoreV2({ ...clean, shodanOpenPorts: [{ port: 3389, protocol: "tcp", service: "rdp", product: "", version: "" }] });
  assert.ok(r.score <= 59);
  assert.ok(r.findings.some((f) => f.category === "network" && f.severity === "critical"));
});

test("USOM kaydı skoru 39 ile sınırlar", () => {
  const r = computeScoreV2({ ...clean, usomListed: true });
  assert.ok(r.score <= 39);
});

test("e-posta: SPF/DMARC yokluğu puan düşürür", () => {
  const r = computeScoreV2({ ...clean, spfRecord: null, dmarcRecord: null, dmarcPass: false });
  const email = r.categories.find((c) => c.key === "email")!;
  assert.equal(email.points, 4); // DKIM 3 + MX 1
  assert.ok(r.score < 100);
});

test("skor 0–100 aralığında kalır", () => {
  const worst = computeScoreV2({
    ...clean,
    spfRecord: null, dmarcRecord: null, dmarcPass: false, dkimPass: false,
    sslDaysUntilExpiry: null, httpHeadersScore: 0,
    cveSummary: Array.from({ length: 10 }, (_, i) => ({ cveId: `CVE-${i}`, cvssScore: 9.9 })),
    shodanOpenPorts: [3389, 445, 23, 6379].map((port) => ({ port, protocol: "tcp", service: "x", product: "", version: "" })),
    blacklisted: true, usomListed: true, urlhausListed: true, safeBrowsingFlagged: true,
    virusTotalMalicious: 5, abuseIpdbScore: 90, hibpBreachCount: 10,
  });
  assert.ok(worst.score >= 0 && worst.score <= 100);
  assert.equal(worst.grade, "F");
});

test("SPF ve DMARC ayrıştırma", () => {
  assert.equal(parseSpfPolicy("v=spf1 mx -all"), "hardfail");
  assert.equal(parseSpfPolicy("v=spf1 mx ~all"), "softfail");
  assert.equal(parseSpfPolicy("v=spf1 mx ?all"), "neutral");
  assert.equal(parseSpfPolicy("v=spf1 +all"), "pass_all");
  assert.equal(parseSpfPolicy("v=spf1 all"), "pass_all");
  assert.equal(parseSpfPolicy(null), "none");
  assert.equal(parseDmarcPolicy("v=DMARC1; p=quarantine; pct=100"), "quarantine");
  assert.equal(parseDmarcPolicy("v=DMARC1;p=REJECT"), "reject");
  assert.equal(parseDmarcPolicy("v=DMARC1; sp=reject"), null);
});

test("çözümlenemeyen domain: veri yetersiz işaretlenir", () => {
  const r = computeScoreV2({ referralSource: "discovery_pipeline", spfRecord: null, dmarcRecord: null, dmarcPass: false, dkimPass: false, mxPass: false, sslDaysUntilExpiry: null, cveSummary: [], shodanOpenPorts: null });
  assert.equal(r.insufficientData, true);
  assert.equal(computeScoreV2(clean).insufficientData, false);
});

test("ölçülemeyen e-posta (DNS hatası): 'SPF/DMARC yok' bulgusu üretilmez, kategori skora girmez", () => {
  const r = computeScoreV2({ ...clean, spfRecord: null, dmarcRecord: null, dmarcPass: false, dkimPass: false, uncheckedSources: ["email"] });
  assert.equal(r.categories.find((c) => c.key === "email")!.measured, false);
  assert.equal(r.findings.filter((f) => f.category === "email").length, 0);
  assert.equal(r.score, 100);
});

test("HIBP ölçülemediyse veri sızıntısı kategorisi 'temiz' sayılmaz", () => {
  const r = computeScoreV2({ ...clean, uncheckedSources: ["hibp"] });
  const b = r.categories.find((c) => c.key === "breaches")!;
  assert.equal(b.measured, false);
  assert.ok(r.coverage < 100);
});

test("ana sayfa alınamadıysa (shadowit) zafiyet kategorisi ölçülmedi sayılır", () => {
  const r = computeScoreV2({ ...clean, uncheckedSources: ["shadowit"] });
  assert.equal(r.categories.find((c) => c.key === "vulnerabilities")!.measured, false);
});

test("DNSBL ve USOM birlikte ölçülemediyse itibar ölçülmedi; biri ölçülmüşse ölçülmüş kalır", () => {
  assert.equal(computeScoreV2({ ...clean, uncheckedSources: ["dnsbl", "usom"] }).categories.find((c) => c.key === "reputation")!.measured, false);
  assert.equal(computeScoreV2({ ...clean, uncheckedSources: ["dnsbl"] }).categories.find((c) => c.key === "reputation")!.measured, true);
});

test("SPF redirect= takip edilmiş birleşik kayıtta hedefin -all politikası geçerli sayılır", () => {
  assert.equal(parseSpfPolicy("v=spf1 redirect=_spf.example.com → v=spf1 include:_a.example.com -all"), "hardfail");
});

test("risk etiketi bulgu şiddetini gizlemez: yüksek bulgu varken 'Düşük' olmaz", () => {
  assert.equal(riskWithFloor(90, [{ severity: "high" }]), "Orta");
  assert.equal(riskWithFloor(90, [{ severity: "critical" }]), "Yüksek");
  assert.equal(riskWithFloor(30, [{ severity: "high" }]), "Kritik");
  assert.equal(riskWithFloor(90, [{ severity: "medium" }]), "Düşük");
});

test("Feodo C2 eşleşmesi skoru 39'a sınırlar ve kritik bulgu üretir", () => {
  const r = computeScoreV2({ ...clean, feodoC2Ips: ["1.2.3.4"] });
  assert.ok(r.score <= 39);
  assert.ok(r.findings.some((f) => /botnet C2/i.test(f.title)));
});

test("ThreatFox IOC skoru 49'a sınırlar", () => {
  const r = computeScoreV2({ ...clean, threatFoxIocCount: 2 });
  assert.ok(r.score <= 49);
});

test("sahipsiz CNAME ağ bulgusu üretir ve risk en az Orta olur", () => {
  const r = computeScoreV2({ ...clean, shodanOpenPorts: [], danglingCnames: ["old.x.com → gone.herokuapp.com"] });
  assert.ok(r.findings.some((f) => /subdomain takeover/i.test(f.title)));
  assert.notEqual(r.risk, "Düşük");
});

test("NVD sorgusu başarısızsa zafiyet kategorisi ölçülmedi sayılır", () => {
  const r = computeScoreV2({ ...clean, uncheckedSources: ["nvd"] });
  assert.equal(r.categories.find((c) => c.key === "vulnerabilities")?.measured, false);
});

test("HIBP bulgusu e-posta değil alan adı hizmetine atfedilir", () => {
  const r = computeScoreV2({ ...clean, hibpBreachCount: 5 });
  const f = r.findings.find((x) => x.category === "breaches");
  assert.ok(f && /Alan adına ait hizmet 5 bilinen veri ihlalinde/.test(f.title));
});

test("SSL Labs notu F ise web puanı düşer ve bulgu üretir; A ise etkilemez", () => {
  const good = computeScoreV2({ ...clean, sslDaysUntilExpiry: 90, sslLabsGrade: "A" });
  const bad = computeScoreV2({ ...clean, sslDaysUntilExpiry: 90, sslLabsGrade: "F" });
  assert.ok(bad.score < good.score);
  assert.ok(bad.findings.some((f) => /SSL Labs notu F/.test(f.title)));
  assert.ok(!good.findings.some((f) => /SSL Labs/.test(f.title)));
});

test("istemci kitaplığı KEV bulgusu: puan keser ama skor tavanı koymaz", () => {
  const base = computeScoreV2(clean);
  const r = computeScoreV2({ ...clean, clientLibCves: [{ cveId: "CVE-2020-11023", cvss: 6.9, kev: true, library: "jquery", version: "3.3.1" }] });
  assert.equal(r.caps.length, 0);
  assert.equal(base.score - r.score, 8);
  assert.ok(r.findings.some((f) => f.title.includes("jQuery 3.3.1")));
  assert.ok(r.score > 49);
});
