import test from "node:test";
import assert from "node:assert/strict";
import { verificationOf, parseEvidence } from "./tprmVerificationStatus";

const now = new Date("2026-11-24T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);

test("doğrulama durumu: hiç, geçerli, yaklaşan, süresi dolmuş", () => {
  assert.equal(verificationOf(null, now).status, "never");
  assert.equal(verificationOf(daysAgo(10), now).status, "verified");
  assert.equal(verificationOf(daysAgo(340), now).status, "expiring");
  assert.equal(verificationOf(daysAgo(366), now).status, "expired");
});
test("bitiş tarihi 365 gün sonradır", () => {
  const v = verificationOf(daysAgo(0), now);
  assert.equal(Math.round(((v.dueAt as Date).getTime() - now.getTime()) / 86400000), 365);
});

test("bağımsız rapor bitişi doğrulamayı kısaltır, uzatmaz", () => {
  const inTwenty = new Date(now.getTime() + 20 * 86400000);
  assert.equal(verificationOf(daysAgo(10), now, inTwenty).status, "expiring");
  assert.equal(verificationOf(daysAgo(10), now, new Date(now.getTime() - 1000)).status, "expired");
  const far = new Date(now.getTime() + 900 * 86400000);
  assert.equal(verificationOf(daysAgo(10), now, far).status, "verified");
  assert.equal(Math.round(((verificationOf(daysAgo(10), now, far).dueAt as Date).getTime() - now.getTime()) / 86400000), 355);
});
test("rapor bilgisi ayıklama", () => {
  assert.deepEqual(parseEvidence(undefined, undefined, now), { ok: true, type: null, until: null });
  assert.equal(parseEvidence("iso27001", "", now).ok, false);
  assert.equal(parseEvidence("iso27001", "2025-01-01", now).ok, false);
  assert.equal(parseEvidence("xyz", "2027-01-01", now).ok, false);
  const r = parseEvidence("soc2", "2027-06-30", now);
  assert.equal(r.ok && r.type, "soc2");
});
