import test from "node:test";
import assert from "node:assert/strict";
import { needsFollowUp } from "./followUpScan";

test("geçici kaynak eksikse takip gerekir", () => {
  assert.equal(needsFollowUp(["otx"], false), true);
  assert.equal(needsFollowUp(["ssllabs", "email"], false), true);
});
test("kalıcı/boş listede ya da takip taramasında gerekmez", () => {
  assert.equal(needsFollowUp(["email", "ssl", "shadowit"], false), false);
  assert.equal(needsFollowUp([], false), false);
  assert.equal(needsFollowUp(null, false), false);
  assert.equal(needsFollowUp(["otx"], true), false);
});
