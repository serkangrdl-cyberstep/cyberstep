import test from "node:test";
import assert from "node:assert/strict";
import { buildFactCheckPrompt, parseFactCheckOutput } from "./blogFactCheck";

const orig = "<article><h2>A</h2><p>" + "metin ".repeat(40) + "</p></article>";

test("istem olgu, kural ve yazıyı içerir", () => {
  const p = buildFactCheckPrompt(orig, "OLGU-X", "KURAL-Y");
  assert.match(p, /OLGU-X/); assert.match(p, /KURAL-Y/); assert.ok(p.includes(orig));
});
test("geçerli çıktı ayrıştırılır", () => {
  const fixed = orig.replace("metin", "düzeltilmiş");
  const r = parseFactCheckOutput(`===DEGISIKLIKLER===\n- ilk cümle düzeltildi\n===ICERIK===\n${fixed}`, orig);
  assert.deepEqual(r?.changes, ["ilk cümle düzeltildi"]);
  assert.equal(r?.content, fixed);
});
test("'yok' değişiklik sayılmaz", () => {
  const r = parseFactCheckOutput(`===DEGISIKLIKLER===\nyok\n===ICERIK===\n${orig}`, orig);
  assert.deepEqual(r?.changes, []);
});
test("bozuk veya kısalmış çıktı reddedilir", () => {
  assert.equal(parseFactCheckOutput("herhangi bir şey", orig), null);
  assert.equal(parseFactCheckOutput("===DEGISIKLIKLER===\nx\n===ICERIK===\n<p>kısa</p>", orig), null);
  assert.equal(parseFactCheckOutput("===DEGISIKLIKLER===\nx\n===ICERIK===\nmetin metin", orig), null);
});
