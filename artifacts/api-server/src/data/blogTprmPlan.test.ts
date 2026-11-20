import test from "node:test";
import assert from "node:assert/strict";
import { TPRM_PLAN, TPRM_VERIFIED_FACTS } from "./blogTprmPlan";

test("TPRM planındaki tüm konular TPRM kategorisinde ve başlıkları benzersiz", () => {
  assert.ok(TPRM_PLAN.length >= 10);
  assert.ok(TPRM_PLAN.every((t) => t.category === "TPRM"));
  assert.equal(new Set(TPRM_PLAN.map((t) => t.title)).size, TPRM_PLAN.length);
});

test("doğrulanmış olgular editör notu veya yer tutucu içermez", () => {
  assert.ok(!/\[(DOĞRULA|VERIFY|KAYNAK)/i.test(TPRM_VERIFIED_FACTS));
  assert.ok(TPRM_VERIFIED_FACTS.includes("KVKK madde 12"));
});

import { selectFactsForTopic, TPRM_FACT_ITEMS } from "./blogTprmPlan";

test("her plan konusuna atanan olgular geçerli ve çoğu yazıda farklı", () => {
  const ids = new Set(TPRM_FACT_ITEMS.map((f) => f.id));
  assert.ok(TPRM_PLAN.every((t) => (t.facts ?? []).every((id) => ids.has(id))));
  const combos = new Set(TPRM_PLAN.map((t) => (t.facts ?? []).join("|")));
  assert.ok(combos.size >= TPRM_PLAN.length - 1);
  // Aynı vaka çoğu yazıda tekrarlanmaz
  const counts = new Map<string, number>();
  for (const t of TPRM_PLAN) for (const id of t.facts ?? []) counts.set(id, (counts.get(id) ?? 0) + 1);
  assert.ok([...counts.values()].every((n) => n <= 3));
});

test("olgu seçimi: atanmışsa yalnızca onlar, KVKK konularında md.12 eklenir, plan dışı konu döndürülür", () => {
  const kvkk = TPRM_PLAN.find((t) => /KVKK/.test(t.title))!;
  const text = selectFactsForTopic(kvkk, TPRM_PLAN.indexOf(kvkk));
  assert.ok(text.includes("KVKK madde 12"));
  assert.ok(!text.includes("Verizon"));
  const free = selectFactsForTopic({ category: "TPRM", title: "X", keywords: "", angle: "" }, -1);
  assert.ok(free.split("\n").length === 2);
});
