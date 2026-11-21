import test from "node:test";
import assert from "node:assert/strict";
import { matchRansomPosts } from "./ransomLook";

test("yalnız tam alan adı geçen başlık eşleşir", () => {
  const body = [
    { group_name: "x", post_title: "acme.com.tr", discovered: "2026-01-01" },
    { group_name: "y", post_title: "notacme.com.tr" },
    { group_name: "z", post_title: "Acme Corp" },
    { group_name: "w", post_title: "www.acme.com.tr " },
  ];
  assert.deepEqual(matchRansomPosts("acme.com.tr", body).map((h) => h.group), ["x", "w"]);
  assert.deepEqual(matchRansomPosts("acme.com.tr", null), []);
});

import { normalizeCompanyName, matchRansomPostsByName } from "./ransomLook";

test("normalizeCompanyName: şirket türü ekleri ve Türkçe karakterler", () => {
  assert.equal(normalizeCompanyName("Örnek Lojistik Sanayi ve Ticaret A.Ş."), "ornek lojistik");
  assert.equal(normalizeCompanyName("ÖRNEK  Lojistik Ltd. Şti."), "ornek lojistik");
});

test("matchRansomPostsByName: yalnızca tam ad eşleşmesi; kısa/genel adlar atlanır", () => {
  const body = [
    { post_title: "Örnek Lojistik", group_name: "grupA", discovered: "2026-10-01T00:00:00" },
    { post_title: "Örnek Lojistik Ambalaj", group_name: "grupB" },
    { post_title: "abc", group_name: "grupC" },
  ];
  const hits = matchRansomPostsByName("Örnek Lojistik Ltd. Şti.", body);
  assert.equal(hits.length, 1);
  assert.equal(hits[0]!.group, "grupA");
  assert.deepEqual(matchRansomPostsByName("ABC A.Ş.", body), []);
});
