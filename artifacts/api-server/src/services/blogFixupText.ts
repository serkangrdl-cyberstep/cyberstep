/** "KVKK'da Veri İşleyen Tedarikçi" yazısındaki olgu dışı ifadeleri düzeltir (saf fonksiyon; tekrar çalıştırılabilir). */
export function fixVeriIsleyenPost(tr: string, en: string): { tr: string; en: string } {
  const t = tr
    .replace(/<p>Bu üç vakada[^]*?<\/p>/, "<p>İlk iki vakada KVKK duyurusu, ihlalin veri işleyen nezdinde barındırılan chat kayıtlarında yaşandığını belirtiyor. VodafoneNet'te ise kaynağın veri işleyen olması henüz kesin değil. Birkaç vakadan genel bir kural çıkarmak doğru olmaz; ama bu örnekler, tedarikçi güvenliğini veri yönetiminin ayrılmaz bir parçası olarak ele almanın neden önemli olduğunu gösteriyor.</p>")
    .replace(/ Kayıtların veri işleyende tutulması, ihlali bildirme ve müdahale süreçlerini de karmaşık hale getirdi\./, "")
    .replace(/Yasa sizi tedarikçiyi <em>seçme<\/em> ve <em>denetleme<\/em> sürecinde de sorumlu tutuyor\./, "Bu nedenle tedarikçinizin tedbirlerini yalnızca sözleşmeye bırakmayıp zaman içinde denetlemeniz önerilir.");
  const e = en
    .replace(/<p>There is a common pattern[^]*?<\/p>/, "<p>In the first two cases, the KVKK announcement states that the breach occurred in chat records hosted by a data processor. In the VodafoneNet case, it is not yet certain that the source was a data processor. It would not be appropriate to draw a general rule from a few cases; but these examples show why it is important to treat supplier security as an integral part of data governance.</p>")
    .replace(/ The fact that the records were held at the data processor's side also complicated the breach notification and response processes\./, "")
    .replace(/The law holds you responsible for the process of <em>selecting<\/em> and <em>auditing<\/em> your supplier as well\./, "It is therefore advisable not to leave your supplier's measures to the contract alone, but to review them over time.");
  return { tr: t, en: e };
}

