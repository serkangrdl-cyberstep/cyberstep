import test from "node:test";
import assert from "node:assert/strict";
import { verificationOf } from "./tprmVerificationStatus";

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
