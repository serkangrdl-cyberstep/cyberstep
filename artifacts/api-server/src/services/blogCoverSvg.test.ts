import test from "node:test";
import assert from "node:assert/strict";
import { wrapTitle, buildCoverSvg } from "./blogCoverSvg";

test("başlık satırlara bölünür ve satır sınırı aşılınca kırpılır", () => {
  const lines = wrapTitle("Tedarikçi Güvenlik Anketi Neden Tek Başına Yetmez ve Dışarıdan Doğrulama Neden Gerekir Bu Konuda");
  assert.ok(lines.length <= 4);
  assert.ok(lines.every((l) => l.length <= 26));
  assert.ok(lines[lines.length - 1].endsWith("…"));
});

test("kısa başlık tek satırda kalır", () => {
  assert.deepEqual(wrapTitle("TPRM Nedir?"), ["TPRM Nedir?"]);
});

test("SVG Türkçe karakterleri ve özel karakterleri doğru gömer", () => {
  const svg = buildCoverSvg({ title: "Üçüncü Taraf & <Risk>", label: "Tedarikçi" });
  assert.ok(svg.includes("Üçüncü Taraf &amp; &lt;Risk&gt;"));
  assert.ok(svg.includes("TEDARİKÇİ"));
});
