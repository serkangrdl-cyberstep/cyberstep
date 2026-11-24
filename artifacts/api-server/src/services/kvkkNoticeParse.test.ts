import test from "node:test";
import assert from "node:assert/strict";
import { parseTrDate, parseNoticeList, parseNoticeDetail, classifyNotice, companyFromTitle, looksLikeTurkishCompany } from "./kvkkNoticeParse";

const LIST = `<div class="col-lg-3"><div class="news__box"><a href="https://www.kvkk.gov.tr/Icerik/9100/kamuoyu-duyurusu-veri-ihlali-bildirimi-sadunoglu-insaat-taah-day-tuk-mallari-san-ve-tic-as-mard-inn-hotel" title="Kamuoyu Duyurusu (Veri İhlali Bildirimi) – Sadunoğlu İnşaat Taah.Day. Tük. Malları San. ve Tic. AŞ (Mard-Inn Hotel)"><img src="x.jpg"/></a><div class="news__box-meta"><a href="https://www.kvkk.gov.tr/Icerik/9100/kamuoyu-duyurusu-veri-ihlali-bildirimi-sadunoglu-insaat-taah-day-tuk-mallari-san-ve-tic-as-mard-inn-hotel" title="t"> t </a> <p class="date">11 Kasım 2026, Çarşamba</p> </div></div></div>
<div class="col-lg-3"><div class="news__box"><a href="https://www.kvkk.gov.tr/Icerik/9099/kamuoyu-duyurusu-veri-ihlali-bildirimi-air-india-limited" title="Kamuoyu Duyurusu (Veri İhlali Bildirimi) – Air India Limited"><img/></a><div class="news__box-meta"><p class="date">11 Kasım 2026, Çarşamba</p></div></div></div>`;

const DETAIL = `<div class="news__detail-article"><p>Bilindiği üzere ...</p><p>Veri sorumlusu sıfatını haiz Deniz Deniz Butik Tekstil Sanayi ve Ticaret Anonim Şirketi tarafından Kurula iletilen veri ihlal bildiriminde özetle;</p><p>Veri sorumlusuna ait verilerin bulunduğu veri işleyen sistemlerindeki bir sunucuya kullanılan üçüncü parti bir yazılım kütüphanesindeki güvenlik zafiyetini istismar etmek suretiyle yetkisiz erişim sağlanması sonucunda ihlalin gerçekleştiği,</p><p>İhlalden etkilenen ilgili kişi sayısının 1.271.096 olduğu,</p><p>bilgilerine yer verilmiştir.</p><p>Konuya ilişkin inceleme devam etmekle birlikte, Kişisel Verileri Koruma Kurulunun 16.09.2026 tarih ve 2026/2039 sayılı Kararı ile ilan edilmesine karar verilmiştir.</p><p>Kamuoyuna saygıyla duyurulur.</p></div></div>`;

test("tarih ayrıştırma", () => {
  assert.equal(parseTrDate("11 Kasım 2026, Çarşamba"), "2026-11-11");
  assert.equal(parseTrDate("1 Ocak 2027"), "2027-01-01");
  assert.equal(parseTrDate("yok"), null);
});
test("liste ayrıştırma", () => {
  const l = parseNoticeList(LIST);
  assert.equal(l.length, 2);
  assert.equal(l[0].noticeId, 9100);
  assert.match(l[0].company, /^Sadunoğlu İnşaat/);
  assert.equal(l[1].company, "Air India Limited");
  assert.equal(l[0].dateText, "11 Kasım 2026, Çarşamba");
});
test("duyuru ayrıştırma ve sınıflama", () => {
  const d = parseNoticeDetail(DETAIL)!;
  assert.equal(d.affectedCount, 1271096);
  assert.equal(d.decisionNo, "2026/2039");
  assert.ok(!d.summary.includes("Kamuoyuna saygıyla"));
  const c = classifyNotice("Deniz Deniz Butik Tekstil Sanayi ve Ticaret Anonim Şirketi", d.summary);
  assert.equal(c.isLead, true);
  assert.ok(c.signals.includes("veri işleyen"));
});
test("doğrudan saldırı lead olmaz; yabancı ve şahıs firma olmaz", () => {
  const direct = "Veri sorumlusu bünyesinde bulunan sunucu sistemlerine yönelik siber saldırı neticesinde ...";
  assert.equal(classifyNotice("X Sanayi Anonim Şirketi", direct).isLead, false);
  assert.equal(looksLikeTurkishCompany("Air India Limited"), false);
  assert.equal(looksLikeTurkishCompany("Choice Hotels International, Inc."), false);
  assert.equal(looksLikeTurkishCompany("Çiğdem Kaya (Ortobella Comfort Medikal Sağlık Ürünleri)"), false);
  assert.equal(companyFromTitle("Kamuoyu Duyurusu (Veri İhlali Bildirimi) – Foo AŞ"), "Foo AŞ");
});
