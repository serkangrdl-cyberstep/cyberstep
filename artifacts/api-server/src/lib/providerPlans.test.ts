// Çalıştırma: pnpm --filter @workspace/api-server run test:score
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { dailyLimitFor, providerUsable, currentPlan, providerSummary } from "./providerPlans";
import { sourceEntry } from "./scanSources";

const KEYS = ["COMMERCIAL_MODE", "SHODAN_PLAN", "SHODAN_DAILY_LIMIT", "VIRUSTOTAL_PLAN", "VIRUSTOTAL_API_KEY",
  "WEB_RISK_API_KEY", "GOOGLE_SAFE_BROWSING_API_KEY", "ABUSEIPDB_PLAN"];
beforeEach(() => { for (const k of KEYS) delete process.env[k]; });

test("paket seçilmemişse eski günlük kotalar korunur", () => {
  assert.equal(dailyLimitFor("shodan"), 100);
  assert.equal(dailyLimitFor("virustotal"), 500);
  assert.equal(dailyLimitFor("abuseipdb"), 1000);
});

test("paket seçilince kota paketten, elle sınır her şeyi ezer", () => {
  process.env["ABUSEIPDB_PLAN"] = "basic";
  assert.equal(dailyLimitFor("abuseipdb"), 10000);
  process.env["SHODAN_PLAN"] = "small_business";
  process.env["SHODAN_DAILY_LIMIT"] = "300";
  assert.equal(dailyLimitFor("shodan"), 300);
});

test("geçersiz paket adı varsayılana düşer", () => {
  process.env["SHODAN_PLAN"] = "yok-boyle-paket";
  assert.equal(currentPlan("shodan").id, "freelancer");
});

test("ticari modda VirusTotal Public lisans kısıtlı, Premium kullanılabilir", () => {
  process.env["VIRUSTOTAL_API_KEY"] = "x";
  assert.equal(providerUsable("virustotal").usable, true);
  process.env["COMMERCIAL_MODE"] = "true";
  assert.deepEqual(providerUsable("virustotal"), { usable: false, reason: "license_restricted" });
  assert.equal(sourceEntry("virustotal", null).status, "license_restricted");
  process.env["VIRUSTOTAL_PLAN"] = "premium";
  assert.equal(providerUsable("virustotal").usable, true);
});

test("ticari modda Safe Browsing yerine Web Risk gerekir", () => {
  process.env["GOOGLE_SAFE_BROWSING_API_KEY"] = "x";
  process.env["COMMERCIAL_MODE"] = "true";
  assert.equal(sourceEntry("safebrowsing", null).status, "license_restricted");
  process.env["WEB_RISK_API_KEY"] = "y";
  assert.equal(sourceEntry("safebrowsing", { flagged: false }).status, "ok");
});

test("özet: lisans uyarısı ve sabit maliyet", () => {
  process.env["VIRUSTOTAL_API_KEY"] = "x";
  const s = providerSummary();
  assert.ok(s.licenseWarnings.some((w) => w.startsWith("VirusTotal")));
  assert.equal(s.commercialMode, false);
});
