// Sektör normalizasyonu, benchmark ve tedarikçi uyarı kuralları
import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalSector } from "./sectors";
import { buildSnapshot, percentileInSector, MIN_SECTOR_SAMPLE } from "./benchmarkStats";
import { detectVendorAlert, shouldSendAlert, ALERT_COOLDOWN_MS } from "./vendorAlerts";
import { computeScoreV2, type ScoreV2Input } from "./scoreV2";

test("iki farklı sektör sözlüğü aynı slug'a iner", () => {
  assert.equal(canonicalSector("Sağlık")?.slug, "saglik");
  assert.equal(canonicalSector("Sağlık & Klinik")?.slug, "saglik");
  assert.equal(canonicalSector("Üretim/Sanayi")?.slug, "imalat");
  assert.equal(canonicalSector("Üretim & Sanayi")?.slug, "imalat");
  assert.equal(canonicalSector("Telecom/ISP")?.slug, "bilisim");
  assert.equal(canonicalSector("Teknoloji & Yazılım")?.slug, "bilisim");
  assert.equal(canonicalSector("teknoloji")?.slug, "bilisim");
  assert.equal(canonicalSector("İNŞAAT & GAYRİMENKUL")?.slug, "insaat");
  assert.equal(canonicalSector("Kamu & Belediye")?.slug, "kamu");
  assert.equal(canonicalSector("Belediye")?.slug, "kamu");
  assert.equal(canonicalSector("Diğer"), null);
  assert.equal(canonicalSector(""), null);
  assert.equal(canonicalSector(null), null);
});

test("benchmark sektörlere ayrılır, küçük örneklem yayınlanmaz", () => {
  const rows = [
    ...Array.from({ length: 40 }, (_, i) => ({ score: 40 + i, sector: "Sağlık & Klinik" })),   // 40..79
    ...Array.from({ length: 35 }, (_, i) => ({ score: 80 + (i % 20), sector: "Finans & Bankacılık" })),
    ...Array.from({ length: 5 }, () => ({ score: 10, sector: "Tarım" })),                         // < MIN
    ...Array.from({ length: 10 }, () => ({ score: 50, sector: null })),
  ];
  const snap = buildSnapshot(rows);
  assert.equal(snap.all.sampleSize, 90);
  assert.ok(snap.sectors["saglik"]);
  assert.ok(snap.sectors["finans"]);
  assert.equal(snap.sectors["tarim"], undefined, `tarım ${MIN_SECTOR_SAMPLE}'dan az`);
  assert.equal(snap.sectors["saglik"]!.sampleSize, 40);
  assert.equal(snap.sectors["saglik"]!.median, 60); // 40..79 medyanı 59.5 → 60
  assert.ok(snap.sectors["finans"]!.median > snap.sectors["saglik"]!.median);
});

test("sektör içi yüzdelik", () => {
  const rows = Array.from({ length: 100 }, (_, i) => ({ score: i, sector: "Lojistik" }));
  const snap = buildSnapshot(rows);
  assert.equal(percentileInSector(snap, "lojistik", 0), 1);
  assert.equal(percentileInSector(snap, "lojistik", 50), 51);
  assert.equal(percentileInSector(snap, "lojistik", 100), 100);
  assert.equal(percentileInSector(snap, "saglik", 50), null);
});

const base: ScoreV2Input = {
  referralSource: "user",
  spfRecord: "v=spf1 -all", dmarcRecord: "v=DMARC1; p=reject", dkimPass: true, mxPass: true,
  sslDaysUntilExpiry: 90, httpHeadersScore: 100, cveSummary: [], shodanOpenPorts: [],
  hibpBreachCount: 0, virusTotalReputation: 0, abuseIpdbScore: 0, safeBrowsingFlagged: false,
};

test("uyarı: yeni kritik bulgu acildir", () => {
  const prev = computeScoreV2(base);
  const next = computeScoreV2({ ...base, shodanOpenPorts: [{ port: 3389, protocol: "tcp", service: "rdp", product: "", version: "" }] });
  const d = detectVendorAlert(prev, next);
  assert.ok(d.urgent);
  assert.ok(d.reasons.some(r => r.kind === "new_critical"));
  // soğuma süresi içinde olsa bile gönderilir
  assert.equal(shouldSendAlert(d, new Date()), true);
});

test("uyarı: aynı kritik bulgu tekrar uyarı üretmez", () => {
  const withRdp = { ...base, shodanOpenPorts: [{ port: 3389, protocol: "tcp", service: "rdp", product: "", version: "" }] };
  const d = detectVendorAlert(computeScoreV2(withRdp), computeScoreV2(withRdp));
  assert.equal(d.reasons.length, 0);
  assert.equal(shouldSendAlert(d, null), false);
});

test("uyarı: risk seviyesi Yüksek/Kritik'e çıkınca", () => {
  const prev = computeScoreV2(base);
  const next = computeScoreV2({ ...base, usomListed: true });
  const d = detectVendorAlert(prev, next);
  assert.ok(d.reasons.some(r => r.kind === "risk_escalation"));
});

test("uyarı: acil olmayan sebep soğuma süresine tabi", () => {
  const prev = computeScoreV2(base);
  const next = computeScoreV2({ ...base, spfRecord: null, dmarcRecord: null, dmarcPass: false, sslDaysUntilExpiry: 5 });
  const d = detectVendorAlert(prev, next);
  assert.ok(d.reasons.some(r => r.kind === "score_drop"));
  assert.equal(d.urgent, false);
  assert.equal(shouldSendAlert(d, new Date()), false);
  assert.equal(shouldSendAlert(d, new Date(Date.now() - ALERT_COOLDOWN_MS - 1000)), true);
});

test("uyarı: önceki v2 sonucu yoksa (v1'den geçiş) uyarı yok", () => {
  const d = detectVendorAlert(null, computeScoreV2({ ...base, usomListed: true }));
  assert.equal(d.reasons.length, 0);
});
