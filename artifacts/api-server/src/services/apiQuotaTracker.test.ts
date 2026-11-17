import { test } from "node:test";
import assert from "node:assert/strict";
import { checkAndConsumeQuota, getQuotaStatus } from "./apiQuotaTracker";

test("öncelikli olmayan çağrılar kotanın son %40'ına dokunamaz; öncelikli çağrılar kullanır", () => {
  const limit = getQuotaStatus()["shodan"]!.limit;
  const nonPriorityMax = Math.floor(limit * 0.6);
  let ok = 0;
  for (let i = 0; i < limit; i++) if (checkAndConsumeQuota("shodan")) ok++;
  assert.equal(ok, nonPriorityMax);
  assert.equal(checkAndConsumeQuota("shodan", { priority: true }), true);
  assert.equal(checkAndConsumeQuota("shodan"), false);
});
