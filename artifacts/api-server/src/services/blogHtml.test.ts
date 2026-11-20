import test from "node:test";
import assert from "node:assert/strict";
import { normalizeBlogHtml } from "./blogHtml";

test("HTML içerik değişmez", () => {
  const h = "<h2>Başlık</h2><p>Metin</p><p>İki</p>";
  assert.equal(normalizeBlogHtml(h), h);
});
test("düz metin satırları paragraf ve başlık olur", () => {
  const out = normalizeBlogHtml("TPRM Nedir?\nBirinci paragraf burada biter.\n\nİkinci paragraf.");
  assert.equal(out, "<h2>TPRM Nedir?</h2>\n<p>Birinci paragraf burada biter.</p>\n<p>İkinci paragraf.</p>");
});
test("tek <p> içindeki satır sonları açılır", () => {
  const out = normalizeBlogHtml("<p>A cümlesi.<br>B cümlesi.</p>");
  assert.equal(out, "<p>A cümlesi.</p>\n<p>B cümlesi.</p>");
});
test("tek satır düz metin tek paragraf", () => {
  assert.equal(normalizeBlogHtml("Merhaba <dünya>"), "<p>Merhaba &lt;dünya&gt;</p>");
});
