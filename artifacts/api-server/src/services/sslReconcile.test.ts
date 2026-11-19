import { test } from "node:test";
import assert from "node:assert/strict";
import { reconcileSsl, NO_HTTPS_NOTE, BROKEN_TLS_NOTE } from "./sslReconcile";

const base = { pass: false, expiryDate: null, issuer: null, daysUntilExpiry: null, note: "x", unchecked: true };

test("ölçülmüş sonuca dokunulmaz", () => {
  const ok = { ...base, unchecked: undefined, pass: true, daysUntilExpiry: 90 };
  assert.equal(reconcileSsl(ok, []), ok);
});

test("ECONNREFUSED: HTTPS yok bulgusu", () => {
  const r = reconcileSsl({ ...base, errorCode: "ECONNREFUSED" }, null);
  assert.equal(r.unchecked, false);
  assert.equal(r.note, NO_HTTPS_NOTE);
});

test("443 port listesinde yok: HTTPS yok; listede var: bozuk TLS", () => {
  assert.equal(reconcileSsl({ ...base, errorCode: "ETIMEDOUT" }, [{ port: 80 }, { port: 3306 }]).note, NO_HTTPS_NOTE);
  const broken = reconcileSsl({ ...base, errorCode: "ECONNRESET" }, [{ port: 80 }, { port: 443 }]);
  assert.equal(broken.unchecked, false);
  assert.equal(broken.note, BROKEN_TLS_NOTE);
  assert.equal(broken.daysUntilExpiry, null);
});

test("kanıt yoksa ölçülemedi kalır (geçici ağ hatası bulgu sayılmaz)", () => {
  assert.equal(reconcileSsl({ ...base, errorCode: "ETIMEDOUT" }, null).unchecked, true);
  assert.equal(reconcileSsl({ ...base, errorCode: "ETIMEDOUT" }, []).unchecked, true);
});
