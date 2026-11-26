import test from "node:test";
import assert from "node:assert/strict";
import { fixVeriIsleyenPost } from "./blogFixupText";

test("olgu dışı ifadeler kaldırılır, tekrar çalıştırmak zararsızdır", () => {
  const tr = "<p>Bu üç vakada ortak bir örüntü var: x.</p><p>A. Kayıtların veri işleyende tutulması, ihlali bildirme ve müdahale süreçlerini de karmaşık hale getirdi.</p><p>Yasa sizi tedarikçiyi <em>seçme</em> ve <em>denetleme</em> sürecinde de sorumlu tutuyor.</p>";
  const en = "<p>There is a common pattern across: x.</p><p>B. The fact that the records were held at the data processor's side also complicated the breach notification and response processes.</p><p>The law holds you responsible for the process of <em>selecting</em> and <em>auditing</em> your supplier as well.</p>";
  const r = fixVeriIsleyenPost(tr, en);
  assert.ok(!/Bu üç vakada|karmaşık hale|seçme/.test(r.tr));
  assert.ok(!/common pattern|complicated|selecting/.test(r.en));
  assert.deepEqual(fixVeriIsleyenPost(r.tr, r.en), r);
});
