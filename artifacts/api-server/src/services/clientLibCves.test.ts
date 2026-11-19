import { test } from "node:test";
import assert from "node:assert/strict";
import { detectJsLibraries, matchClientLibCves, fetchHomepageHtml } from "./clientLibCves";

test("jQuery sürümü script adresi ve başlık yorumundan okunur", () => {
  assert.deepEqual(detectJsLibraries('<script src="/js/jquery-3.3.1.min.js"></script>').map((l) => l.version), ["3.3.1"]);
  assert.deepEqual(detectJsLibraries('<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.4/jquery.min.js"></script>').map((l) => l.version), ["1.12.4"]);
  assert.deepEqual(detectJsLibraries('<script src="/wp-includes/js/jquery/jquery.min.js?ver=3.6.0"></script>').map((l) => l.version), ["3.6.0"]);
  assert.deepEqual(detectJsLibraries('<script>/*! jQuery v3.4.1 | (c) JS Foundation */</script>').map((l) => l.version), ["3.4.1"]);
  assert.deepEqual(detectJsLibraries('<script src="/js/plugin.js?ver=9.9.9"></script>'), []);
  assert.deepEqual(detectJsLibraries("<html></html>"), []);
});

test("CVE-2020-11023: yalnızca >= 1.0.3 ve < 3.5.0 sürümleri eşleşir", () => {
  const hit = (v: string) => matchClientLibCves([{ library: "jquery", version: v, source: "t" }]).length;
  for (const v of ["1.0.3", "1.10.1", "2.2.4", "3.3.1", "3.4.1"]) assert.equal(hit(v), 1, v);
  for (const v of ["1.0.2", "3.5.0", "3.5.1", "3.6.0", "3.7.1"]) assert.equal(hit(v), 0, v);
  const f = matchClientLibCves([{ library: "jquery", version: "3.3.1", source: "script adresi" }])[0]!;
  assert.equal(f.cveId, "CVE-2020-11023");
  assert.equal(f.range, ">= 1.0.3, < 3.5.0");
  assert.equal(f.evidence, "verified");
  assert.equal(f.kev, true);
});

test("ana sayfa çekimi: yönlendirmede her sıçrama public olmalı, dahili adres reddedilir", async () => {
  const mk = (map: Record<string, { status: number; loc?: string; body?: string }>) => async (url: string) => {
    const r = map[url] ?? { status: 404 };
    return { status: r.status, headers: { get: (k: string) => (k === "location" ? r.loc ?? null : null) }, text: async () => r.body ?? "" };
  };
  const pub = async (h: string) => h !== "internal.local";
  assert.equal(await fetchHomepageHtml("a.com", mk({ "https://a.com/": { status: 301, loc: "https://www.a.com/" }, "https://www.a.com/": { status: 200, body: "OK" } }), pub), "OK");
  assert.equal(await fetchHomepageHtml("a.com", mk({ "https://a.com/": { status: 302, loc: "https://internal.local/" } }), pub), null);
  assert.equal(await fetchHomepageHtml("a.com", mk({ "https://a.com/": { status: 500 } }), pub), null);
});

test("aralıksız NVD kaydına elle doğrulanmış aralık uygulanır", async () => {
  const { withCuratedRange } = await import("./clientLibCves");
  const p = withCuratedRange("CVE-2020-11023", { product: "JQuery" } as { product: string; versionEndExcluding?: string });
  assert.equal(p.versionEndExcluding, "3.5.0");
  assert.equal(p.curated, true);
  const other = { product: "JQuery" };
  assert.equal(withCuratedRange("CVE-2099-1", other), other);
  const ranged = { product: "jquery", versionEndExcluding: "9.9" };
  assert.equal(withCuratedRange("CVE-2020-11023", ranged), ranged);
});

test("mevcut eşleşme satırı: yamalı sürüm silinir, aralıktaki doğrulanır", async () => {
  const { revalidateMatchRow } = await import("./clientLibCves");
  const { evaluateVersionEvidence } = await import("./cve/versionEvidence");
  const run = (v: string | null) => revalidateMatchRow("CVE-2020-11023", "JQuery", v, 55, "Kategori uyumlu · Sürüm tespit edildi (x); CVE aralık verisi yok, doğrulanamadı", evaluateVersionEvidence);
  assert.equal(run("3.6.0").action, "delete");
  const ok = run("3.3.1");
  assert.equal(ok.action, "update");
  assert.equal(ok.confidence, 55);
  assert.equal(ok.note, "Kategori uyumlu · Sürüm aralığı doğrulandı (3.3.1)");
  assert.equal(run(null).action, "update");
  assert.equal(revalidateMatchRow("CVE-2099-1", "JQuery", "3.6.0", 55, null, evaluateVersionEvidence).action, "none");
});
