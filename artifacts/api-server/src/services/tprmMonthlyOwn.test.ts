import test from "node:test";
import assert from "node:assert/strict";
import { ownDomainLine } from "./tprmOwnLine";

test("aylık özet satırı: skor, risk ve değişim", () => {
  assert.match(ownDomainLine({ supplierDomain: "a.com.tr", lastScanScore: 72, prevScanScore: 80, riskLevel: "Orta" }), /72\/100, Orta risk \(önceki taramaya göre -8\)/);
  assert.match(ownDomainLine({ supplierDomain: "a.com.tr", lastScanScore: 80, prevScanScore: 80, riskLevel: null }), /^<li>a\.com\.tr: 80\/100<\/li>$/);
  assert.match(ownDomainLine({ supplierDomain: "x.com", lastScanScore: null, prevScanScore: null, riskLevel: null }), /henüz skorlanmadı/);
});
