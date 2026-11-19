import { test } from "node:test";
import assert from "node:assert/strict";
import { buildVendorCves, buildVendorPorts, labelUnchecked } from "./vendorFindings";

test("CVE'ler KEV önce, sonra CVSS'e göre; yinelenenler tekilleşir; EPSS eklenir", () => {
  const kev = new Map([["CVE-2", { ransomware: true }], ["CVE-3", { ransomware: false, source: "vulncheck" as const }]]);
  const r = buildVendorCves(
    [
      { service: "nginx 1.18", cveId: "CVE-1", description: "a", cvssScore: 9.8 },
      { service: "nginx 1.18", cveId: "CVE-2", description: "b", cvssScore: 7.5 },
      { service: "nginx 1.18", cveId: "CVE-2", description: "b", cvssScore: 7.5 },
      { service: "ssh", cveId: "CVE-3", description: "c", cvssScore: 5, adjustedCvssScore: 3, wafMitigated: true },
    ],
    kev,
    { "CVE-1": { score: 0.9, percentile: 0.99 } },
  );
  assert.deepEqual(r.map((c) => c.cveId), ["CVE-2", "CVE-3", "CVE-1"]);
  assert.equal(r[0]!.kevRansomware, true);
  assert.equal(r[0]!.kevSource, "cisa");
  assert.equal(r[1]!.kevSource, "vulncheck");
  assert.equal(r[1]!.cvss, 3);
  assert.equal(r[1]!.wafMitigated, true);
  assert.equal(r[2]!.epss, 0.9);
});

test("portlar riske göre sıralanır; bilinmeyen port düşük risk", () => {
  const r = buildVendorPorts([
    { port: 443, protocol: "tcp", service: "https", product: "", version: "" },
    { port: 22, protocol: "tcp", service: "ssh", product: "", version: "" },
    { port: 3389, protocol: "tcp", service: "rdp", product: "", version: "" },
  ]);
  assert.deepEqual(r.map((p) => [p.port, p.risk]), [[3389, "high"], [22, "medium"], [443, "low"]]);
});

test("ölçülemeyen kaynaklar okunur etiketle döner; null güvenli", () => {
  assert.deepEqual(labelUnchecked(["shodan", "xyz"]), ["Shodan (açık portlar)", "xyz"]);
  assert.deepEqual(labelUnchecked(null), []);
  assert.deepEqual(buildVendorPorts(null), []);
  assert.deepEqual(buildVendorCves(undefined, new Map(), null), []);
});
