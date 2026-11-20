import test from "node:test";
import assert from "node:assert/strict";
import { isSourceLicensed, licenseStatus } from "./dataSourceLicenses";

test("varsayılan: tüm kaynaklar çalışır", () => {
  assert.equal(isSourceLicensed("virustotal", {}), true);
});
test("ENFORCE açıkken yalnızca lisanslı işaretli kaynak çalışır", () => {
  const env = { DATASOURCE_LICENSE_ENFORCE: "1", DATASOURCE_LICENSE_OTX: "1" };
  assert.equal(isSourceLicensed("otx", env), true);
  assert.equal(isSourceLicensed("censys", env), false);
  assert.equal(licenseStatus(env).filter((s) => s.active).length, 1);
});
