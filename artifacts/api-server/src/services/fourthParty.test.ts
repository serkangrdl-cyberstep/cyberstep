import test from "node:test";
import assert from "node:assert/strict";
import { providerOf, extractWebHosts, extractSpfIncludes, detectFourthParties, portfolioConcentration } from "./fourthParty";

test("providerOf: sonek ve en uzun eşleşme", () => {
  assert.equal(providerOf("aspmx.l.google.com")?.provider, "Google");
  assert.equal(providerOf("x.mail.protection.outlook.com")?.provider, "Microsoft 365");
  assert.equal(providerOf("ns-123.awsdns-45.org")?.provider, "Amazon Route 53");
  assert.equal(providerOf("bilinmeyen-host.example"), null);
  assert.equal(providerOf("notgoogle.com"), null);
});
test("extractWebHosts: kendi alan adı hariç, protokolsüz adres dahil", () => {
  const html = '<script src="https://www.googletagmanager.com/gtm.js?id=X"></script><script src="/a.js"></script><script src="//cdn.jsdelivr.net/x.js"></script><iframe src="https://app.acme.com/f"></iframe>';
  assert.deepEqual(extractWebHosts(html, "acme.com").sort(), ["cdn.jsdelivr.net", "www.googletagmanager.com"]);
});
test("extractSpfIncludes", () => {
  assert.deepEqual(extractSpfIncludes("v=spf1 include:_spf.google.com include:sendgrid.net ~all"), ["_spf.google.com", "sendgrid.net"]);
});
test("detectFourthParties: aynı sağlayıcı tek satır, via birleşir", () => {
  const r = detectFourthParties({ domain: "acme.com", mxHosts: ["aspmx.l.google.com"], spfRecord: "v=spf1 include:_spf.google.com ~all", webHosts: ["www.googletagmanager.com"] });
  const g = r.find((x) => x.provider === "Google Workspace" || x.provider === "Google");
  assert.ok(g);
  assert.ok(r.find((x) => x.provider === "Google Tag Manager"));
});
test("portfolioConcentration: >=3 tedarikçi ve >=%25 ise yüksek", () => {
  const p = [{ provider: "Google", category: "e-posta" as const, via: ["mx" as const] }];
  const v = [1, 2, 3, 4].map((i) => ({ vendorId: i, vendorName: `V${i}`, parties: i <= 3 ? p : [] }));
  const c = portfolioConcentration(v);
  assert.equal(c[0]!.vendorCount, 3);
  assert.equal(c[0]!.high, true);
  const c2 = portfolioConcentration([...v, ...[5, 6, 7, 8, 9, 10, 11, 12, 13].map((i) => ({ vendorId: i, vendorName: `V${i}`, parties: [] }))]);
  assert.equal(c2[0]!.high, false);
});
