import test from "node:test";
import assert from "node:assert/strict";
import { normalizeBlogHtml, prepareBlogContent } from "./blogHtml";

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
  assert.equal(normalizeBlogHtml("Merhaba & dünya"), "<p>Merhaba &amp; dünya</p>");
});
test("sanitize: p/h2/ul korunur, script ve on* gider", () => {
  const out = prepareBlogContent('<h2>B</h2><p onclick="x()">A<script>alert(1)</script></p><ul><li>1</li></ul><a href="javascript:alert(1)">l</a>');
  assert.match(out, /<h2>B<\/h2>/);
  assert.match(out, /<p>A<\/p>/);
  assert.match(out, /<ul><li>1<\/li><\/ul>/);
  assert.doesNotMatch(out, /script|onclick|javascript:/);
});
