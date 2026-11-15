// Çalıştırma: pnpm --filter @workspace/api-server run test:score
import { test } from "node:test";
import assert from "node:assert/strict";
import { sourceEntry, sourceMeasured, missingScanSourceKeys } from "./scanSources";
import { computeScoreV2 } from "./scoring/scoreV2";

test("key tanımlı değilse not_configured", () => {
  delete process.env["VIRUSTOTAL_API_KEY"];
  assert.equal(sourceEntry("virustotal", null).status, "not_configured");
  assert.ok(missingScanSourceKeys().some((m) => m.env === "VIRUSTOTAL_API_KEY"));
});

test("key var ama sonuç null/failed ise unavailable, aksi halde ok", () => {
  process.env["VIRUSTOTAL_API_KEY"] = "x";
  assert.equal(sourceEntry("virustotal", null).status, "unavailable");
  assert.equal(sourceEntry("virustotal", { malicious: 0 }).status, "ok");
  assert.equal(sourceEntry("hibp", { breachCount: 0 }, { failed: true }).status, "unavailable");
  assert.deepEqual(sourceEntry("hibp", { breachCount: 0 }), { status: "ok" });
  delete process.env["VIRUSTOTAL_API_KEY"];
});

test("durum kaydı olmayan eski taramalar ölçülmüş sayılır", () => {
  assert.equal(sourceMeasured(null, "shodan"), true);
  assert.equal(sourceMeasured({ shodan: { status: "unavailable" } }, "shodan"), false);
  assert.equal(sourceMeasured({ shodan: { status: "ok" } }, "shodan"), true);
});

test("HTTP başlık skoru 0–5 ölçeğinde: 5/5 tam puan, 1/5 bulgu üretir", () => {
  const base = { referralSource: "tprm_monitoring", spfRecord: "v=spf1 -all", dmarcRecord: "v=DMARC1; p=reject", mxPass: true, dkimPass: true, sslDaysUntilExpiry: 90, hibpBreachCount: 0, shodanOpenPorts: [] };
  const full = computeScoreV2({ ...base, httpHeadersScore: 5 });
  assert.equal(full.categories.find((c) => c.key === "web")!.points, 10);
  const weak = computeScoreV2({ ...base, httpHeadersScore: 1 });
  assert.ok(weak.findings.some((f) => f.title.startsWith("HTTP güvenlik başlıkları")));
});
