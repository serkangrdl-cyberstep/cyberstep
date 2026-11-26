import test from "node:test";
import assert from "node:assert/strict";
import { isSnapshotUrl, needsArchive, archivedTitle, applyArchive } from "./webArchiveParse";

test("arşiv kopyası ve gereksinim ayrımı", () => {
  assert.equal(isSnapshotUrl("https://web.archive.org/web/20261126151317/https://www.kvkk.gov.tr/x"), true);
  assert.equal(isSnapshotUrl("https://www.kvkk.gov.tr/x"), false);
  assert.equal(needsArchive("https://www.kvkk.gov.tr/x"), true);
  assert.equal(needsArchive("https://web.archive.org/web/20261126151317/https://a.b/c"), false);
});

test("başlığa arşiv notu bir kez eklenir", () => {
  assert.equal(archivedTitle("KVKK duyurusu (4 Kasım 2026)"), "KVKK duyurusu (4 Kasım 2026; arşiv kopyası)");
  assert.equal(archivedTitle("CNBC-e: Haber"), "CNBC-e: Haber (arşiv kopyası)");
  assert.equal(archivedTitle("X (arşiv kopyası)"), "X (arşiv kopyası)");
});

test("applyArchive yalnızca eşlenenleri değiştirir", () => {
  const out = applyArchive([{ title: "A (1)", url: "https://a.com" }, { title: "B", url: "https://b.com" }], { "https://a.com": "https://web.archive.org/web/20261126151317/https://a.com" });
  assert.equal(out[0].url, "https://web.archive.org/web/20261126151317/https://a.com");
  assert.equal(out[1].url, "https://b.com");
});
