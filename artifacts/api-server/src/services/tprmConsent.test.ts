import test from "node:test";
import assert from "node:assert/strict";
import { validateConsentInput, hasValidConsent } from "./tprmConsent";
import { validateEvidence, sniffMime, safeFileName } from "./tprmEvidence";

const now = new Date("2026-06-01T00:00:00Z");
const good = { scopes: ["active_vuln"], signerName: "Ayşe Y.", validFrom: "2026-06-01", validUntil: "2026-09-01" };

test("onay girişi: geçerli ve geçersiz durumlar", () => {
  assert.equal(validateConsentInput(good, now).ok, true);
  assert.equal(validateConsentInput({ ...good, scopes: ["x"] }, now).ok, false);
  assert.equal(validateConsentInput({ ...good, signerName: " " }, now).ok, false);
  assert.equal(validateConsentInput({ ...good, validUntil: "2026-05-01" }, now).ok, false);
  assert.equal(validateConsentInput({ ...good, validUntil: "2028-01-01" }, now).ok, false);
});
test("hasValidConsent: kapsam, süre, iptal", () => {
  const r = { scopes: ["active_vuln"], validFrom: new Date("2026-06-01"), validUntil: new Date("2026-09-01"), revokedAt: null };
  assert.equal(hasValidConsent([r], "active_vuln", now), true);
  assert.equal(hasValidConsent([r], "config_readonly", now), false);
  assert.equal(hasValidConsent([r], "active_vuln", new Date("2026-10-01")), false);
  assert.equal(hasValidConsent([r], "active_vuln", new Date("2026-05-01")), false);
  assert.equal(hasValidConsent([{ ...r, revokedAt: new Date("2026-06-02") }], "active_vuln", now), false);
  assert.equal(hasValidConsent([], "active_vuln", now), false);
});
test("kanıt belgesi: magic byte ve boyut", () => {
  const pdf = Buffer.from("%PDF-1.4 test").toString("base64");
  assert.equal(validateEvidence({ dataBase64: pdf, fileName: "../x/iso.pdf", kind: "iso27001" }).ok, true);
  assert.equal(validateEvidence({ dataBase64: Buffer.from("MZ exe").toString("base64") }).ok, false);
  assert.equal(validateEvidence({ dataBase64: "" }).ok, false);
  assert.equal(sniffMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(safeFileName("../../a<b>.pdf"), "a_b_.pdf");
});
