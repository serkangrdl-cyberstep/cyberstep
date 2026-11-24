import test from "node:test";
import assert from "node:assert/strict";
import { parseTranslation, sameLinks } from "./blogTranslateParse";

const ok = `<<<TITLE>>>\nFourth-Party Risk\n<<<EXCERPT>>>\nShort.\n<<<SEO_TITLE>>>\nSEO\n<<<META_DESCRIPTION>>>\nMeta\n<<<FOCUS_KEYWORD>>>\nfourth party risk\n<<<CONTENT>>>\n<p>Hello <a href="https://a.com">x</a></p>`;

test("bölümler ayrıştırılır", () => {
  const r = parseTranslation(ok);
  assert.equal(r?.titleEn, "Fourth-Party Risk");
  assert.equal(r?.seoTitleEn, "SEO");
  assert.ok(r?.contentEn.startsWith("<p>Hello"));
});
test("eksik veya kesik çıktı reddedilir", () => {
  assert.equal(parseTranslation("<<<TITLE>>>\nx"), null);
  assert.equal(parseTranslation("<<<TITLE>>>\nx\n<<<EXCERPT>>>\ny\n<<<CONTENT>>>\nsadece metin"), null);
});
test("opsiyonel bölümler boş olabilir", () => {
  const r = parseTranslation("<<<TITLE>>>\nT\n<<<EXCERPT>>>\nE\n<<<CONTENT>>>\n<p>x</p>");
  assert.equal(r?.seoTitleEn, null);
});
test("bağlantılar değişmişse reddedilir", () => {
  assert.equal(sameLinks('<a href="https://a.com">x</a>', '<a href="https://a.com">y</a>'), true);
  assert.equal(sameLinks('<a href="https://a.com">x</a>', '<a href="https://b.com">y</a>'), false);
});
